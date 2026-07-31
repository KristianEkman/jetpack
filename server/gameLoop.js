/* ==========================================================================
   SERVER FIXED TICK GAME LOOP (60 Hz Engine)
   ========================================================================== */

import { GAME_EVENTS } from '../js/shared/constants.js';

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

            // 2. Build world snapshot
            const snapshot = {
                roomId: room.id,
                tick: room.tickCount,
                timestamp: Date.now(),
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

            // 3. Broadcast snapshot to room socket channel
            if (this.io) {
                this.io.to(room.id).emit(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', snapshot);
            }
        }
    }
}
