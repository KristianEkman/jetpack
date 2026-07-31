/* ==========================================================================
   MULTI-PLAYER ENTITY MANAGER MODULE
   ========================================================================== */

import { Player } from './player.js';

export class PlayerManager {
    constructor(audio = null, tileMap = null) {
        this.audio = audio;
        this.tileMap = tileMap;
        this.localSocketId = null;
        this.players = new Map(); // socketId -> Player instance
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
        // Fallback to first player if localSocketId not set yet
        return this.players.values().next().value || null;
    }

    updateFromSnapshot(snapshotPlayersList) {
        if (!Array.isArray(snapshotPlayersList)) return;

        const activeSocketIds = new Set();

        for (const pData of snapshotPlayersList) {
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

            // For the local player, only apply server state when the server signals
            // a respawn (isDead transitions from true → false). Otherwise skip to
            // prevent flicker — the local player runs its own physics.
            if (socketId === this.localSocketId) {
                if (player.isDead && pData.isDead === false) {
                    // Server has respawned us — apply position, state, and fuel
                    player.applySnapshot(pData);
                }
            } else {
                player.applySnapshot(pData);
            }
        }

        // Clean up disconnected players not in latest room snapshot
        for (const sId of this.players.keys()) {
            if (!activeSocketIds.has(sId)) {
                this.players.delete(sId);
            }
        }
    }

    update(dt) {
        for (const [sId, player] of this.players.entries()) {
            if (sId !== this.localSocketId && !player.isLocal) {
                player.animTimer += dt;
                player.phaseBeamTimer = Math.max(0, player.phaseBeamTimer - dt);
                player.phaseCooldown = Math.max(0, player.phaseCooldown - dt);
                player.teleportCooldown = Math.max(0, player.teleportCooldown - dt);
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
    }
}
