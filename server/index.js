/* ==========================================================================
   NODE.JS BACKEND MULTIPLAYER SERVER (Express + Socket.IO)
   ========================================================================== */

import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RoomManager } from './roomManager.js';
import { GameLoop } from './gameLoop.js';
import { GAME_EVENTS, TILES } from '../js/shared/constants.js';
import { CAMPAIGN_LEVELS } from '../js/levels/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Serve static frontend assets
app.use(express.static(rootDir));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeRooms: roomManager.rooms.size
    });
});

export const roomManager = new RoomManager();
export const gameLoop = new GameLoop(roomManager, io, 60);

// Initialize Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Handshake / Latency check
    socket.on('ping_handshake', (callback) => {
        const reply = { pong: true, serverTime: Date.now(), socketId: socket.id };
        if (typeof callback === 'function') {
            callback(reply);
        } else {
            socket.emit('pong_handshake', reply);
        }
    });

    // Create Room
    socket.on('create_room', (data = {}, callback) => {
        const room = roomManager.createRoom(socket.id, data);
        socket.join(room.id);

        // Bind world state tilemap events to broadcast across room
        room.tileMap.on(GAME_EVENTS.TILE_PHASED, (payload) => {
            io.to(room.id).emit(GAME_EVENTS.TILE_PHASED, payload);
        });
        room.tileMap.on(GAME_EVENTS.TILE_RESTORED, (payload) => {
            io.to(room.id).emit(GAME_EVENTS.TILE_RESTORED, payload);
        });
        room.tileMap.on(GAME_EVENTS.ITEM_COLLECTED, (payload) => {
            io.to(room.id).emit(GAME_EVENTS.ITEM_COLLECTED, payload);
        });

        const response = {
            success: true,
            roomId: room.id,
            room: roomManager.serializeRoom(room),
            socketId: socket.id
        };

        if (typeof callback === 'function') callback(response);
        socket.emit('room_created', response);
        io.emit('room_list_updated', roomManager.listRooms());
        console.log(`🏠 Room created: ${room.id} by Host ${socket.id}`);
    });

    // Join Room
    socket.on('join_room', (data = {}, callback) => {
        const roomId = data.roomId;
        if (!roomId) {
            const errResponse = { success: false, error: 'Room ID required' };
            if (typeof callback === 'function') callback(errResponse);
            socket.emit('join_error', errResponse);
            return;
        }

        const result = roomManager.joinRoom(roomId, socket.id, data);
        if (!result.success) {
            if (typeof callback === 'function') callback(result);
            socket.emit('join_error', result);
            return;
        }

        socket.join(result.room.id);

        if (typeof callback === 'function') callback(result);
        socket.emit('room_joined', result);

        // Notify room participants
        io.to(result.room.id).emit('player_joined', {
            player: result.player,
            room: result.room
        });

        io.emit('room_list_updated', roomManager.listRooms());
        console.log(`👥 Client ${socket.id} joined Room ${result.room.id}`);
    });

    // Leave Room
    socket.on('leave_room', (callback) => {
        const result = roomManager.leaveRoom(socket.id);
        if (result) {
            socket.leave(result.roomId);
            const response = { success: true, roomId: result.roomId };
            if (typeof callback === 'function') callback(response);
            socket.emit('room_left', response);

            if (!result.roomDestroyed && result.room) {
                io.to(result.roomId).emit('player_left', {
                    socketId: socket.id,
                    leavingPlayer: result.leavingPlayer,
                    newHostSocketId: result.newHostSocketId,
                    room: result.room
                });
            }
            io.emit('room_list_updated', roomManager.listRooms());
            console.log(`🚪 Client ${socket.id} left Room ${result.roomId}`);
        }
    });

    // List Public Lobbies
    socket.on('list_rooms', (callback) => {
        const list = roomManager.listRooms();
        if (typeof callback === 'function') callback(list);
        socket.emit('room_list', list);
    });

    // Start Multiplayer Match (Host only)
    socket.on(GAME_EVENTS.START_MATCH || 'start_match', (data = {}, callback) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) {
            const errRes = { success: false, error: 'Room not found' };
            if (typeof callback === 'function') callback(errRes);
            return;
        }

        if (room.hostSocketId !== socket.id) {
            const errRes = { success: false, error: 'Only the room host can start the match' };
            if (typeof callback === 'function') callback(errRes);
            return;
        }

        room.status = 'playing';

        // Re-load level tileMap data on server at match start
        const levelData = room.customMapData || CAMPAIGN_LEVELS[room.levelIndex] || CAMPAIGN_LEVELS[0];
        room.tileMap.loadLevelData(levelData);

        // Find spawn points from SPAWN tile or default
        let spawnX = 128;
        let spawnY = 100;
        for (let r = 0; r < room.tileMap.rows; r++) {
            for (let c = 0; c < room.tileMap.cols; c++) {
                if (room.tileMap.getTile(c, r) === TILES.SPAWN) {
                    spawnX = c * 32 + 4;
                    spawnY = r * 32 + 2;
                    break;
                }
            }
        }

        for (const [sId, playerEntity] of room.players.entries()) {
            playerEntity.spawn(spawnX, spawnY);
            playerEntity.lives = 3;
            playerEntity.score = 0;
            playerEntity.isDead = false;
        }

        const payload = {
            success: true,
            room: roomManager.serializeRoom(room),
            levelIndex: room.levelIndex,
            customMapData: room.customMapData
        };

        if (typeof callback === 'function') callback(payload);
        io.to(room.id).emit(GAME_EVENTS.GAME_STARTED || 'game_started', payload);
        io.emit('room_list_updated', roomManager.listRooms());
        console.log(`🚀 Match started in Room ${room.id} by Host ${socket.id}`);
    });

    // Player Input Handler (Client -> Server)
    socket.on(GAME_EVENTS.PLAYER_INPUT || 'player_input', (inputState) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const playerEntity = room.players.get(socket.id);
        const config = room.playerConfigs.get(socket.id);

        if (playerEntity && inputState) {
            if (config && inputState.sequenceId !== undefined) {
                config.lastSequenceId = inputState.sequenceId;
            }
            // Execute input update on player entity
            playerEntity.update(gameLoop.dt, inputState, null);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        const result = roomManager.leaveRoom(socket.id);
        if (result && !result.roomDestroyed && result.room) {
            io.to(result.roomId).emit('player_left', {
                socketId: socket.id,
                leavingPlayer: result.leavingPlayer,
                newHostSocketId: result.newHostSocketId,
                room: result.room
            });
            io.emit('room_list_updated', roomManager.listRooms());
        }
    });
});

const PORT = process.env.PORT || 3000;

// Start game loop & server when executed directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
    gameLoop.start();
    httpServer.listen(PORT, () => {
        console.log(`🚀 Jetpack Multiplayer Server listening on http://localhost:${PORT}`);
    });
}

export { app, httpServer, io };
