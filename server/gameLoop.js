/* ==========================================================================
   SERVER FIXED TICK GAME LOOP (60 Hz Engine)
   ========================================================================== */

import { GAME_EVENTS, TILE_SIZE, TILES } from '../js/shared/constants.js';

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

            // 1b. Handle player death timers & respawn
            for (const [socketId, playerEntity] of room.players.entries()) {
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

            // 3. Build world snapshot
            const snapshot = {
                roomId: room.id,
                tick: room.tickCount,
                timestamp: Date.now(),
                worldState: room.tileMap ? {
                    collectedEmeralds: room.tileMap.collectedEmeralds,
                    totalEmeralds: room.tileMap.totalEmeralds
                } : null,
                players: []
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
                    lastSequenceId: config ? config.lastSequenceId : 0
                });
            }

            // 4. Broadcast snapshot to room socket channel
            if (this.io) {
                this.io.to(room.id).emit(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', snapshot);
            }
        }
    }
}
