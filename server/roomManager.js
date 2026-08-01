/* ==========================================================================
   SERVER ROOM & LOBBY MANAGER
   ========================================================================== */

import { TileMap } from '../js/world/tilemap.js';
import { Player } from '../js/entities/player.js';
import { EnemyManager } from '../js/entities/enemy.js';
import { CAMPAIGN_LEVELS } from '../js/levels/campaign.js';

const PLAYER_COLORS = ['#ff4444', '#44ff44', '#4488ff', '#ffff44', '#ff44ff', '#00ffff'];

export class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.socketToRoom = new Map();
    }

    /**
     * Generate a unique 4-character uppercase alphanumeric code.
     */
    generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let roomId;
        do {
            roomId = '';
            for (let i = 0; i < 4; i++) {
                roomId += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.rooms.has(roomId));
        return roomId;
    }

    /**
     * Create a new room with a host player.
     */
    createRoom(hostSocketId, options = {}) {
        const roomId = options.customCode ? options.customCode.toUpperCase() : this.generateRoomId();
        const levelIndex = options.levelIndex !== undefined ? options.levelIndex : 0;
        const maxPlayers = options.maxPlayers || 4;

        const tileMap = new TileMap();
        let levelData = CAMPAIGN_LEVELS[levelIndex] || CAMPAIGN_LEVELS[0];
        let customMapData = null;
        let mapName = levelData ? levelData.name || `Level ${levelIndex + 1}` : 'Campaign Level';

        if (options.customMapData && Array.isArray(options.customMapData.grid) && options.customMapData.grid.length === 540) {
            customMapData = options.customMapData;
            levelData = customMapData;
            mapName = customMapData.name || 'Custom Map';
        }

        tileMap.loadLevelData(levelData);

        const enemyManager = new EnemyManager(tileMap);

        const room = {
            id: roomId,
            hostSocketId: hostSocketId,
            maxPlayers: maxPlayers,
            levelIndex: levelIndex,
            customMapData: customMapData,
            mapName: mapName,
            tileMap: tileMap,
            enemyManager: enemyManager,
            players: new Map(),        // socketId -> Player instance
            playerConfigs: new Map(),  // socketId -> metadata ({ id, name, color, isReady, isHost })
            status: 'lobby',          // 'lobby' | 'playing' | 'finished'
            tickCount: 0,
            destroyedEnemyIds: new Set(),
            createdAt: Date.now()
        };

        this.rooms.set(roomId, room);

        // Add host player
        this.addPlayerToRoom(room, hostSocketId, {
            name: options.playerName || 'Player 1 (Host)',
            color: options.playerColor || PLAYER_COLORS[0],
            isHost: true
        });

        return room;
    }

    /**
     * Add a player to a room.
     */
    addPlayerToRoom(room, socketId, playerOptions = {}) {
        const playerIndex = room.players.size;
        const color = playerOptions.color || playerOptions.playerColor || PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
        const playerId = `player_${playerIndex + 1}_${socketId.substr(0, 4)}`;
        const name = playerOptions.name || playerOptions.playerName || `Player ${playerIndex + 1}`;

        const playerEntity = new Player(null, room.tileMap, {
            id: playerId,
            color: color,
            name: name,
            isLocal: false
        });

        // Spawn at map spawn coordinates or default
        const spawns = room.tileMap.spawnPoints || [{ x: 128, y: 100 }];
        const spawn = spawns[playerIndex % spawns.length] || spawns[0] || { x: 128, y: 100 };
        playerEntity.spawn(spawn.x, spawn.y);

        const playerConfig = {
            socketId: socketId,
            id: playerId,
            name: name,
            color: color,
            isReady: playerOptions.isHost || false,
            isHost: !!playerOptions.isHost,
            pendingInputs: [],
            lastInput: null,
            lastSequenceId: 0,
            lastReceivedSequenceId: 0
        };

        room.players.set(socketId, playerEntity);
        room.playerConfigs.set(socketId, playerConfig);
        this.socketToRoom.set(socketId, room.id);

        return playerConfig;
    }

    /**
     * Join an existing room by room ID.
     */
    joinRoom(roomId, socketId, playerOptions = {}) {
        const code = roomId.toUpperCase();
        const room = this.rooms.get(code);

        if (!room) {
            return { success: false, error: 'Room not found' };
        }

        if (room.players.size >= room.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }

        if (room.players.has(socketId)) {
            return { success: true, room: this.serializeRoom(room), player: room.playerConfigs.get(socketId) };
        }

        const playerConfig = this.addPlayerToRoom(room, socketId, playerOptions);

        return {
            success: true,
            room: this.serializeRoom(room),
            player: playerConfig
        };
    }

    /**
     * Remove a player from their room.
     */
    leaveRoom(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return null;

        const room = this.rooms.get(roomId);
        if (!room) {
            this.socketToRoom.delete(socketId);
            return null;
        }

        room.players.delete(socketId);
        const leavingConfig = room.playerConfigs.get(socketId);
        room.playerConfigs.delete(socketId);
        this.socketToRoom.delete(socketId);

        let roomDestroyed = false;
        let newHostSocketId = null;

        if (room.players.size === 0) {
            this.rooms.delete(roomId);
            roomDestroyed = true;
        } else if (room.hostSocketId === socketId) {
            // Transfer host to first remaining player
            newHostSocketId = room.players.keys().next().value;
            room.hostSocketId = newHostSocketId;
            const newHostConfig = room.playerConfigs.get(newHostSocketId);
            if (newHostConfig) {
                newHostConfig.isHost = true;
                newHostConfig.isReady = true;
            }
        }

        return {
            roomId,
            roomDestroyed,
            newHostSocketId,
            leavingPlayer: leavingConfig,
            room: roomDestroyed ? null : this.serializeRoom(room)
        };
    }

    /**
     * Get room instance.
     */
    getRoom(roomId) {
        return this.rooms.get(roomId.toUpperCase());
    }

    /**
     * Get room instance by socket ID.
     */
    getRoomBySocketId(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        return roomId ? this.rooms.get(roomId) : null;
    }

    /**
     * Serialize room state for network payload transmission.
     */
    serializeRoom(room) {
        if (!room) return null;

        const playersList = [];
        for (const [sId, config] of room.playerConfigs.entries()) {
            const playerEntity = room.players.get(sId);
            playersList.push({
                socketId: sId,
                id: config.id,
                name: config.name,
                color: config.color,
                isReady: config.isReady,
                isHost: config.isHost,
                x: playerEntity ? playerEntity.x : 0,
                y: playerEntity ? playerEntity.y : 0,
                vx: playerEntity ? playerEntity.vx : 0,
                vy: playerEntity ? playerEntity.vy : 0,
                fuel: playerEntity ? playerEntity.fuel : 100,
                lives: playerEntity ? playerEntity.lives : 3,
                score: playerEntity ? playerEntity.score : 0,
                facingRight: playerEntity ? playerEntity.facingRight : true
            });
        }

        return {
            id: room.id,
            hostSocketId: room.hostSocketId,
            maxPlayers: room.maxPlayers,
            levelIndex: room.levelIndex,
            customMapData: room.customMapData,
            mapName: room.mapName,
            status: room.status,
            tickCount: room.tickCount,
            players: playersList,
            destroyedEnemyIds: room.destroyedEnemyIds ? Array.from(room.destroyedEnemyIds) : []
        };
    }

    /**
     * List all active public rooms.
     */
    listRooms() {
        const list = [];
        for (const room of this.rooms.values()) {
            list.push({
                id: room.id,
                playerCount: room.players.size,
                maxPlayers: room.maxPlayers,
                status: room.status,
                levelIndex: room.levelIndex,
                mapName: room.mapName
            });
        }
        return list;
    }
}
