import { Player } from './player.js';

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export class PlayerManager {
    constructor(audio = null, tileMap = null) {
        this.audio = audio;
        this.tileMap = tileMap;
        this.localSocketId = null;
        this.players = new Map(); // socketId -> Player instance
        this.snapshotBuffer = [];
        this.interpolationDelay = 100; // ms render delay for remote entities
    }

    setLocalSocketId(socketId) {
        this.localSocketId = socketId;
        for (const [sId, player] of this.players.entries()) {
            player.isLocal = (sId === socketId);
        }
    }

    addPlayer(socketId, options = {}) {
        const isLocal = options.isLocal !== undefined ? options.isLocal : (socketId === this.localSocketId);
        const player = new Player(this.audio, this.tileMap, {
            id: options.id || socketId,
            name: options.name || 'Player',
            color: options.color || '#00f0ff',
            isLocal: isLocal
        });
        if (options.x !== undefined && options.y !== undefined) {
            player.spawn(options.x, options.y);
        }
        this.players.set(socketId, player);
        return player;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
    }

    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    getLocalPlayer() {
        if (this.localSocketId && this.players.has(this.localSocketId)) {
            return this.players.get(this.localSocketId);
        }
        return this.players.values().next().value || null;
    }

    updateFromSnapshot(snapshotPayload) {
        if (!snapshotPayload) return;

        const playersList = Array.isArray(snapshotPayload) ? snapshotPayload : (snapshotPayload.players || []);
        const timestamp = snapshotPayload.timestamp || Date.now();
        const tick = snapshotPayload.tick || 0;

        // Save to snapshot buffer for remote player interpolation
        this.snapshotBuffer.push({
            tick,
            timestamp,
            players: playersList
        });

        // Maintain buffer size (~1.5s of snapshots)
        if (this.snapshotBuffer.length > 30) {
            this.snapshotBuffer.shift();
        }

        const activeSocketIds = new Set();

        for (const pData of playersList) {
            const socketId = pData.socketId || pData.id;
            if (!socketId) continue;

            activeSocketIds.add(socketId);
            let player = this.players.get(socketId);

            if (!player) {
                player = this.addPlayer(socketId, {
                    id: pData.id,
                    name: pData.name,
                    color: pData.color,
                    isLocal: (socketId === this.localSocketId),
                    x: pData.x,
                    y: pData.y
                });
            }

            // Local player prediction reconciliation & death/respawn tracking
            if (socketId === this.localSocketId) {
                if (player.isDead) {
                    if (pData.isDead) {
                        player.serverAcknowledgedDeath = true;
                        if (pData.lives !== undefined) player.lives = pData.lives;
                    } else if (player.serverAcknowledgedDeath && pData.isDead === false) {
                        player.applySnapshot(pData);
                        player.serverAcknowledgedDeath = false;
                    }
                } else if (pData.isDead) {
                    player.takeDamage();
                    player.serverAcknowledgedDeath = true;
                    if (pData.lives !== undefined) player.lives = pData.lives;
                } else {
                    player.serverAcknowledgedDeath = false;
                    // Position is driven strictly by local inputs; ignore WebSocket position snapshot updates
                }
            } else {
                // Ensure metadata updates and initial position for remote players
                if (pData.name) player.name = pData.name;
                if (pData.color) player.color = pData.color;
                if (this.snapshotBuffer.length <= 1) {
                    player.applySnapshot(pData);
                }
            }
        }

        // Clean up disconnected players not in latest snapshot
        for (const sId of this.players.keys()) {
            if (!activeSocketIds.has(sId)) {
                this.players.delete(sId);
            }
        }
    }

    update(dt) {
        const renderTime = Date.now() - this.interpolationDelay;

        // Find surrounding snapshots in buffer for remote player interpolation
        let older = null;
        let newer = null;

        for (let i = this.snapshotBuffer.length - 1; i >= 0; i--) {
            const snap = this.snapshotBuffer[i];
            if (snap.timestamp <= renderTime) {
                older = snap;
                newer = this.snapshotBuffer[i + 1] || null;
                break;
            }
        }

        if (!older && this.snapshotBuffer.length > 0) {
            older = this.snapshotBuffer[0];
        }

        const latestSnap = this.snapshotBuffer[this.snapshotBuffer.length - 1];

        for (const [sId, player] of this.players.entries()) {
            if (sId === this.localSocketId || player.isLocal) continue;

            player.animTimer += dt;
            player.phaseBeamTimer = Math.max(0, player.phaseBeamTimer - dt);
            player.phaseCooldown = Math.max(0, player.phaseCooldown - dt);
            player.teleportCooldown = Math.max(0, player.teleportCooldown - dt);

            if (older && newer && newer.timestamp > older.timestamp) {
                // Smooth Snapshot Interpolation between older and newer snapshots
                const t = Math.max(0, Math.min(1, (renderTime - older.timestamp) / (newer.timestamp - older.timestamp)));

                const pOld = older.players.find(p => (p.socketId || p.id) === sId);
                const pNew = newer.players.find(p => (p.socketId || p.id) === sId);

                if (pOld && pNew) {
                    const dx = pNew.x - pOld.x;
                    const dy = pNew.y - pOld.y;

                    if (dx * dx + dy * dy > 4096 || pOld.isDead !== pNew.isDead) {
                        player.applySnapshot(pNew);
                    } else {
                        player.x = lerp(pOld.x, pNew.x, t);
                        player.y = lerp(pOld.y, pNew.y, t);
                        player.vx = lerp(pOld.vx, pNew.vx, t);
                        player.vy = lerp(pOld.vy, pNew.vy, t);
                        player.fuel = pNew.fuel;
                        player.lives = pNew.lives;
                        player.score = pNew.score;
                        player.facingRight = pNew.facingRight;
                        player.isGrounded = pNew.isGrounded;
                        player.isThrusting = pNew.isThrusting;
                        player.isClimbing = pNew.isClimbing;
                        player.isPhasing = pNew.isPhasing;
                        player.isDead = pNew.isDead;
                    }
                } else if (pNew) {
                    player.applySnapshot(pNew);
                }
            } else if (latestSnap) {
                // Extrapolation mode when snapshots are delayed
                const pLatest = latestSnap.players.find(p => (p.socketId || p.id) === sId);
                if (pLatest) {
                    const extrapTime = Math.min(0.10, Math.max(0, (renderTime - latestSnap.timestamp) / 1000));
                    player.x = pLatest.x + (pLatest.vx || 0) * extrapTime;
                    player.y = pLatest.y + (pLatest.vy || 0) * extrapTime;
                    player.vx = pLatest.vx || 0;
                    player.vy = pLatest.vy || 0;
                    player.fuel = pLatest.fuel;
                    player.lives = pLatest.lives;
                    player.score = pLatest.score;
                    player.facingRight = pLatest.facingRight;
                    player.isGrounded = pLatest.isGrounded;
                    player.isThrusting = pLatest.isThrusting;
                    player.isClimbing = pLatest.isClimbing;
                    player.isPhasing = pLatest.isPhasing;
                    player.isDead = pLatest.isDead;
                }
            }
        }
    }

    render(ctx) {
        for (const player of this.players.values()) {
            player.render(ctx);
        }
    }

    clear() {
        this.players.clear();
        this.snapshotBuffer = [];
    }
}
