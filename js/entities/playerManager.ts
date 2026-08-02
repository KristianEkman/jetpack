import { Player } from './player.js';
import { PLAYER_FLAGS } from '../shared/constants.js';
import { TileMap } from '../world/tilemap.js';

export interface UnpackedPlayerSnapshot {
    socketId: string;
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fuel: number;
    lives: number;
    score: number;
    facingRight: boolean;
    isGrounded: boolean;
    isThrusting: boolean;
    isClimbing: boolean;
    isPhasing: boolean;
    isDead: boolean;
    respawnInvulnerability: number;
    lastSequenceId: number;
    name?: string;
    color?: string;
}

export function unpackPlayerSnapshot(p: any): UnpackedPlayerSnapshot {
    if (!Array.isArray(p)) return p;
    const flags = p[9] || 0;
    return {
        socketId: p[0],
        id: p[1],
        x: p[2],
        y: p[3],
        vx: p[4],
        vy: p[5],
        fuel: p[6],
        lives: p[7],
        score: p[8],
        facingRight: (flags & PLAYER_FLAGS.FACING_RIGHT) !== 0,
        isGrounded:  (flags & PLAYER_FLAGS.IS_GROUNDED) !== 0,
        isThrusting: (flags & PLAYER_FLAGS.IS_THRUSTING) !== 0,
        isClimbing:  (flags & PLAYER_FLAGS.IS_CLIMBING) !== 0,
        isPhasing:   (flags & PLAYER_FLAGS.IS_PHASING) !== 0,
        isDead:      (flags & PLAYER_FLAGS.IS_DEAD) !== 0,
        respawnInvulnerability: p[10],
        lastSequenceId: p[11]
    };
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export interface SnapshotBufferItem {
    tick: number;
    timestamp: number;
    players: UnpackedPlayerSnapshot[];
}

export class PlayerManager {
    audio: any;
    tileMap: TileMap;
    localSocketId: string | null;
    players: Map<string, Player>;
    snapshotBuffer: SnapshotBufferItem[];
    interpolationDelay: number;

    constructor(audio: any = null, tileMap: TileMap) {
        this.audio = audio;
        this.tileMap = tileMap;
        this.localSocketId = null;
        this.players = new Map();
        this.snapshotBuffer = [];
        this.interpolationDelay = 100;
    }

    setLocalSocketId(socketId: string): void {
        this.localSocketId = socketId;
        for (const [sId, player] of this.players.entries()) {
            player.isLocal = (sId === socketId);
        }
    }

    addPlayer(socketId: string, options: any = {}): Player {
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

    removePlayer(socketId: string): void {
        this.players.delete(socketId);
    }

    getPlayer(socketId: string): Player | undefined {
        return this.players.get(socketId);
    }

    getLocalPlayer(): Player | null {
        if (this.localSocketId && this.players.has(this.localSocketId)) {
            return this.players.get(this.localSocketId) || null;
        }
        return this.players.values().next().value || null;
    }

    updateFromSnapshot(snapshotPayload: any): void {
        if (!snapshotPayload) return;

        const rawList = Array.isArray(snapshotPayload) ? snapshotPayload : (snapshotPayload.players || []);
        const playersList = rawList.map(unpackPlayerSnapshot);
        const timestamp = snapshotPayload.timestamp || Date.now();
        const tick = snapshotPayload.tick || 0;

        this.snapshotBuffer.push({
            tick,
            timestamp,
            players: playersList
        });

        if (this.snapshotBuffer.length > 30) {
            this.snapshotBuffer.shift();
        }

        const activeSocketIds = new Set<string>();

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

            if (socketId === this.localSocketId) {
                if (player.isDead) {
                    if (pData.isDead) {
                        player.serverAcknowledgedDeath = true;
                        if (pData.lives !== undefined) player.lives = pData.lives;
                    } else if (pData.isDead === false && (player.serverAcknowledgedDeath || (Date.now() - (player._localDeathTimestamp || 0) > 500))) {
                        player.applySnapshot(pData);
                        player.serverAcknowledgedDeath = false;
                    }
                } else if (pData.isDead) {
                    player.takeDamage();
                    player.serverAcknowledgedDeath = true;
                    if (pData.lives !== undefined) player.lives = pData.lives;
                } else {
                    player.serverAcknowledgedDeath = false;
                }
            } else {
                if (pData.name) player.name = pData.name;
                if (pData.color) player.color = pData.color;
                if (this.snapshotBuffer.length <= 1) {
                    player.applySnapshot(pData);
                }
            }
        }

        for (const sId of this.players.keys()) {
            if (!activeSocketIds.has(sId)) {
                this.players.delete(sId);
            }
        }
    }

    update(dt: number): void {
        const renderTime = Date.now() - this.interpolationDelay;

        let older: SnapshotBufferItem | null = null;
        let newer: SnapshotBufferItem | null = null;

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
                const t = Math.max(0, Math.min(1, (renderTime - older.timestamp) / (newer.timestamp - older.timestamp)));

                const pOld = older.players.find(p => (p.socketId || p.id) === sId);
                const pNew = newer.players.find(p => (p.socketId || p.id) === sId);

                if (pOld && pNew) {
                    const dx = pNew.x - pOld.x;
                    const dy = pNew.y - pOld.y;

                    if (dx * dx + dy * dy > 4096 || pOld.isDead !== pNew.isDead) {
                        player.applySnapshot(pNew as unknown as Player);
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
                        player.respawnInvulnerability = pNew.respawnInvulnerability;
                    }
                } else if (pNew) {
                    player.applySnapshot(pNew as unknown as Player);
                }
            } else if (latestSnap) {
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
                    player.respawnInvulnerability = pLatest.respawnInvulnerability;
                }
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        for (const player of this.players.values()) {
            player.render(ctx);
        }
    }

    clear(): void {
        this.players.clear();
        this.snapshotBuffer = [];
    }
}
