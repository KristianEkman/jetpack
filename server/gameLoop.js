/* ==========================================================================
   SERVER FIXED TICK GAME LOOP (60 Hz Engine)
   ========================================================================== */

import { GAME_EVENTS, TILE_SIZE, TILES, NETWORK_SETTINGS } from '../js/shared/constants.js';

export class GameLoop {
    constructor(roomManager, io, tickRate = 60) {
        this.roomManager = roomManager;
        this.io = io;
        this.tickRate = tickRate;
        this.dt = 1 / tickRate; // ~0.016667 seconds per tick
        this.intervalMs = 1000 / tickRate;
        this.timer = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.timer = setInterval(() => this.tick(), this.intervalMs);
        console.log(`⏱️ Server Game Loop running at ${this.tickRate} Hz (${Math.round(this.intervalMs)}ms interval)`);
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('🛑 Server Game Loop stopped.');
    }

    tick() {
        for (const room of this.roomManager.rooms.values()) {
            room.tickCount++;

            // 1. Update TileMap state (handles phase brick regeneration timers)
            if (room.tileMap) {
                room.tileMap.update(this.dt);
            }

            // 1a. Advance player physics or sync client-authoritative position inside server tick
            if (room.status === 'playing') {
                for (const [socketId, playerEntity] of room.players.entries()) {
                    const config = room.playerConfigs.get(socketId);
                    if (config && !playerEntity.isDead) {
                        const input = config.pendingInputs.shift() || config.lastInput;
                        if (input) {
                            if (typeof input.x === 'number' && typeof input.y === 'number') {
                                playerEntity.x = input.x;
                                playerEntity.y = input.y;
                                playerEntity.vx = input.vx || 0;
                                playerEntity.vy = input.vy || 0;
                                if (input.facingRight !== undefined) playerEntity.facingRight = input.facingRight;
                                if (input.isGrounded !== undefined) playerEntity.isGrounded = input.isGrounded;
                                if (input.isThrusting !== undefined) playerEntity.isThrusting = input.isThrusting;
                                if (input.isClimbing !== undefined) playerEntity.isClimbing = input.isClimbing;
                                if (input.isPhasing !== undefined) playerEntity.isPhasing = input.isPhasing;
                            } else {
                                playerEntity.simulateMovement(this.dt, input, room.enemyManager);
                            }
                            config.lastInput = input;
                            config.lastSequenceId = input.sequenceId || 0;
                        }
                        playerEntity.checkCollectibles();
                    }
                }
            }

            // 1b. Update server-authoritative enemies & check player collisions
            if (room.status === 'playing' && room.enemyManager) {
                const livingPlayers = Array.from(room.players.values()).filter(p => !p.isDead && (p.respawnInvulnerability || 0) <= 0);
                room.enemyManager.update(this.dt, livingPlayers);
            }

            // 1c. Handle player death timers, respawn, & invulnerability
            for (const [socketId, playerEntity] of room.players.entries()) {
                if (playerEntity.respawnInvulnerability > 0) {
                    playerEntity.respawnInvulnerability = Math.max(0, playerEntity.respawnInvulnerability - this.dt);
                }

                if (playerEntity.isDead) {
                    // Initialize death timer if not present
                    if (playerEntity._deathTimer === undefined) {
                        playerEntity._deathTimer = 0;
                    }
                    playerEntity._deathTimer += this.dt;

                    // After 2.0s death animation, respawn if player has lives left
                    if (playerEntity._deathTimer >= 2.0 && playerEntity.lives > 0) {
                        // Find SPAWN tile position
                        let spawnX = 128, spawnY = 100;
                        if (room.tileMap) {
                            for (let r = 0; r < room.tileMap.rows; r++) {
                                for (let c = 0; c < room.tileMap.cols; c++) {
                                    if (room.tileMap.getTile(c, r) === TILES.SPAWN) {
                                        spawnX = c * TILE_SIZE + 4;
                                        spawnY = r * TILE_SIZE + 2;
                                        break;
                                    }
                                }
                            }
                        }
                        playerEntity.spawn(spawnX, spawnY);
                        playerEntity._deathTimer = 0;
                    }
                } else {
                    // Reset timer when alive
                    playerEntity._deathTimer = 0;
                }
            }

            // 2. Check Level Clear Condition (Exit Portal reached with all emeralds)
            if (room.status === 'playing' && room.tileMap) {
                const allEmeraldsCaught = (room.tileMap.totalEmeralds > 0 && room.tileMap.collectedEmeralds >= room.tileMap.totalEmeralds) ||
                    (room.tileMap.totalEmeralds === 0 && room.tileMap.collectedEmeralds >= 4);

                if (allEmeraldsCaught) {
                    let levelCleared = false;
                    let clearingPlayer = null;

                    for (const playerEntity of room.players.values()) {
                        if (!playerEntity.isDead) {
                            const col = Math.floor((playerEntity.x + playerEntity.width / 2) / TILE_SIZE);
                            const row = Math.floor((playerEntity.y + playerEntity.height / 2) / TILE_SIZE);
                            if (room.tileMap.getTile(col, row) === TILES.EXIT_PORTAL) {
                                levelCleared = true;
                                clearingPlayer = playerEntity;
                                break;
                            }
                        }
                    }

                    if (levelCleared) {
                        room.status = 'finished';
                        const winnerList = [];
                        for (const [sId, p] of room.players.entries()) {
                            winnerList.push({ socketId: sId, name: p.name, score: p.score, fuel: p.fuel });
                        }
                        if (this.io) {
                            this.io.to(room.id).emit(GAME_EVENTS.LEVEL_COMPLETE || 'level_complete', {
                                roomId: room.id,
                                clearedBy: clearingPlayer ? clearingPlayer.name : 'Team',
                                players: winnerList,
                                levelIndex: room.levelIndex
                            });
                        }
                        console.log(`🏆 Level completed in Room ${room.id}!`);
                    }
                }
            }

            // 2b. Check Game Over Condition (All players eliminated)
            if (room.status === 'playing' && room.players.size > 0) {
                let allDead = true;
                for (const playerEntity of room.players.values()) {
                    if (!playerEntity.isDead || playerEntity.lives > 0) {
                        allDead = false;
                        break;
                    }
                }

                if (allDead) {
                    room.status = 'finished';
                    const playersList = [];
                    for (const [sId, p] of room.players.entries()) {
                        playersList.push({ socketId: sId, name: p.name, score: p.score, lives: p.lives });
                    }
                    if (this.io) {
                        this.io.to(room.id).emit(GAME_EVENTS.GAME_OVER || 'game_over', {
                            roomId: room.id,
                            reason: 'all_players_eliminated',
                            players: playersList
                        });
                    }
                    console.log(`💀 All players eliminated in Room ${room.id}! Game Over emitted.`);
                }
            }

            // 3. Build world snapshot (20 Hz snapshot emission)
            const snapshotInterval = NETWORK_SETTINGS?.SNAPSHOT_INTERVAL_TICKS || 3;
            if (room.tickCount % snapshotInterval === 0 && this.io) {
                const snapshot = {
                    roomId: room.id,
                    tick: room.tickCount,
                    timestamp: Date.now(),
                    worldState: room.tileMap ? {
                        collectedEmeralds: room.tileMap.collectedEmeralds,
                        totalEmeralds: room.tileMap.totalEmeralds
                    } : null,
                    players: [],
                    enemies: room.enemyManager ? room.enemyManager.serializeEnemies() : [],
                    projectiles: room.enemyManager ? room.enemyManager.serializeProjectiles() : []
                };

                for (const [socketId, playerEntity] of room.players.entries()) {
                    const config = room.playerConfigs.get(socketId);
                    snapshot.players.push({
                        socketId: socketId,
                        id: playerEntity.id,
                        name: config ? config.name : playerEntity.name,
                        color: config ? config.color : playerEntity.color,
                        x: Math.round(playerEntity.x * 100) / 100,
                        y: Math.round(playerEntity.y * 100) / 100,
                        vx: Math.round(playerEntity.vx * 100) / 100,
                        vy: Math.round(playerEntity.vy * 100) / 100,
                        fuel: Math.round(playerEntity.fuel * 10) / 10,
                        lives: playerEntity.lives,
                        score: playerEntity.score,
                        facingRight: playerEntity.facingRight,
                        isGrounded: playerEntity.isGrounded,
                        isThrusting: playerEntity.isThrusting,
                        isClimbing: playerEntity.isClimbing,
                        isPhasing: playerEntity.isPhasing,
                        isDead: playerEntity.isDead,
                        respawnInvulnerability: Math.round((playerEntity.respawnInvulnerability || 0) * 10) / 10,
                        lastSequenceId: config ? config.lastSequenceId : 0
                    });
                }

                // Broadcast volatile 20 Hz snapshot (drops stale queued snapshots during congestion)
                this.io.to(room.id).volatile.emit(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', snapshot);
            }
        }
    }
}

