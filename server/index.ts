/* ==========================================================================
   NODE.JS BACKEND MULTIPLAYER SERVER (Express + Socket.IO)
   ========================================================================== */

import express from 'express';
import { createServer } from 'node:http';
import { DefaultEventsMap, Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';
import { execSync } from 'node:child_process';

import { RoomManager, ServerRoom } from './roomManager.js';
import { GameLoop } from './gameLoop.js';
import { GAME_EVENTS, MULTIPLAYER_MODES, TILES } from '../js/shared/constants.js';
import { CAMPAIGN_LEVELS } from '../js/levels/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

let serverCommitHash = 'dev';
let deployedAt = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

function loadVersionInfo(): void {
    const distVersionFile = path.join(distDir, 'version.json');
    const rootVersionFile = path.join(rootDir, 'version.json');

    if (fs.existsSync(distVersionFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(distVersionFile, 'utf8'));
            if (data.commitHash) serverCommitHash = data.commitHash;
            if (data.deployedAt) deployedAt = data.deployedAt;
            return;
        } catch (e) {}
    }

    if (fs.existsSync(rootVersionFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(rootVersionFile, 'utf8'));
            if (data.commitHash) serverCommitHash = data.commitHash;
            if (data.deployedAt) deployedAt = data.deployedAt;
            return;
        } catch (e) {}
    }

    try {
        const gitHash = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim();
        if (gitHash) serverCommitHash = gitHash;
    } catch (e) {}
}

loadVersionInfo();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
}
app.use(express.static(rootDir));

app.get('/api/version', (req, res) => {
    res.json({
        commitHash: serverCommitHash,
        deployedAt: deployedAt
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeRooms: roomManager.rooms.size
    });
});

export const roomManager = new RoomManager();
export const gameLoop = new GameLoop(roomManager, io, 60);

function initRoomEnemies(room: ServerRoom, levelData: any): void {
    if (!room.enemyManager) return;
    room.enemyManager.clear();
    if (levelData.flitzers) {
        levelData.flitzers.forEach((f: any) => room.enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
    }
    if (levelData.missiles) {
        levelData.missiles.forEach((m: any) => room.enemyManager.addHomingMissile(m.x, m.y));
    }
    if (levelData.turrets) {
        levelData.turrets.forEach((t: any) => room.enemyManager.addTurret(t.x, t.y, t.fireInterval));
    }
    for (let r = 0; r < room.tileMap.rows; r++) {
        for (let c = 0; c < room.tileMap.cols; c++) {
            const tile = room.tileMap.getTile(c, r);
            if (tile === TILES.ENEMY_FLITZER) {
                room.enemyManager.addFlitzer(c * 32 + 6, r * 32 + 6, 100, 100);
            } else if (tile === TILES.ENEMY_MISSILE) {
                room.enemyManager.addHomingMissile(c * 32 + 8, r * 32 + 8);
            } else if (tile === TILES.ENEMY_TURRET) {
                room.enemyManager.addTurret(c * 32 + 4, r * 32 + 4, 2.0);
            }
        }
    }
}

io.on('connection', (socket: any) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('ping_handshake', (callback: any) => {
        const reply = { pong: true, serverTime: Date.now(), socketId: socket.id };
        if (typeof callback === 'function') {
            callback(reply);
        } else {
            socket.emit('pong_handshake', reply);
        }
    });

    socket.on('create_room', (data: any = {}, callback: any) => {
        const room = roomManager.createRoom(socket.id, data);
        socket.join(room.id);

        room.tileMap.on(GAME_EVENTS.TILE_PHASED, (payload: any) => {
            io.to(room.id).emit(GAME_EVENTS.TILE_PHASED, payload);
        });
        room.tileMap.on(GAME_EVENTS.TILE_RESTORED, (payload: any) => {
            io.to(room.id).emit(GAME_EVENTS.TILE_RESTORED, payload);
        });
        room.tileMap.on(GAME_EVENTS.ITEM_COLLECTED, (payload: any) => {
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

    socket.on('join_room', (data: any = {}, callback: any) => {
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

        io.to(result.room.id).emit('player_joined', {
            player: result.player,
            room: result.room
        });

        io.emit('room_list_updated', roomManager.listRooms());
        console.log(`👥 Client ${socket.id} joined Room ${result.room.id}`);
    });

    socket.on('leave_room', (callback: any) => {
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

    socket.on('list_rooms', (callback: any) => {
        const list = roomManager.listRooms();
        if (typeof callback === 'function') callback(list);
        socket.emit('room_list', list);
    });

    socket.on(GAME_EVENTS.START_MATCH || 'start_match', (data: any = {}, callback: any) => {
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
        room.destroyedEnemyIds = new Set();

        const levelData = room.customMapData || CAMPAIGN_LEVELS[room.levelIndex] || CAMPAIGN_LEVELS[0];
        room.tileMap.loadLevelData(levelData);
        initRoomEnemies(room, levelData);

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

    socket.on(GAME_EVENTS.PLAYER_INPUT || 'player_input', (inputState: any) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !inputState) return;

        const config = room.playerConfigs.get(socket.id);
        if (!config) return;

        const sequenceId = inputState.sequenceId || 0;
        if (sequenceId <= (config.lastReceivedSequenceId || 0)) return;

        config.lastReceivedSequenceId = sequenceId;
        config.lastSequenceId = sequenceId;
        config.pendingInputs.push(inputState);
        if (config.pendingInputs.length > 30) {
            config.pendingInputs.shift();
        }
    });

    socket.on(GAME_EVENTS.PLAYER_DIED || 'player_died', (data: any = {}) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || room.status !== 'playing') return;

        const playerEntity = room.players.get(socket.id);
        if (!playerEntity || playerEntity.isDead) return;

        playerEntity.isDead = true;
        playerEntity.lives--;
        playerEntity.deathTimer = 0;
        console.log(`💀 Player ${socket.id} died (reason: ${data.reason || 'enemy'}, lives: ${playerEntity.lives})`);
    });

    socket.on(GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed', ({ enemyId }: { enemyId?: string } = {}, callback: any) => {
        const room = roomManager.getRoomBySocketId(socket.id);

        if (!room || room.status !== 'playing' || !enemyId) {
            callback?.({
                success: false,
                error: 'Invalid enemy destruction'
            });
            return;
        }

        room.destroyedEnemyIds ??= new Set();

        if (room.destroyedEnemyIds.has(enemyId)) {
            callback?.({
                success: true,
                duplicate: true
            });
            return;
        }

        room.destroyedEnemyIds.add(enemyId);

        if (room.enemyManager) {
            room.enemyManager.removeEnemyById(enemyId);
        }

        io.to(room.id).emit(GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed', {
            enemyId,
            killedBy: socket.id
        });

        callback?.({ success: true });
    });

    socket.on(GAME_EVENTS.COMPLETE_LEVEL || 'complete_level', (data: any = {}, callback: any) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || room.status !== 'playing') {
            const errRes = { success: false, error: 'Room not in playing state' };
            if (typeof callback === 'function') callback(errRes);
            return;
        }

        if (room.gameMode !== MULTIPLAYER_MODES.COOP) {
            const errRes = { success: false, error: 'Level completion is only available in co-op mode' };
            if (typeof callback === 'function') callback(errRes);
            return;
        }

        room.status = 'finished';
        const playerConfig = room.playerConfigs.get(socket.id);
        const playerName = playerConfig ? playerConfig.name : 'Player';

        const serializedRoom = roomManager.serializeRoom(room);
        const payload = {
            success: true,
            clearedBy: playerName,
            socketId: socket.id,
            room: serializedRoom,
            players: serializedRoom.players
        };

        if (typeof callback === 'function') callback(payload);
        io.to(room.id).emit(GAME_EVENTS.LEVEL_COMPLETE || 'level_complete', payload);
        console.log(`🏆 Level completed in Room ${room.id} by ${playerName}`);
    });

    socket.on(GAME_EVENTS.NEXT_LEVEL || 'next_level', (data: any = {}, callback: any) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) {
            const errRes = { success: false, error: 'Room not found' };
            if (typeof callback === 'function') callback(errRes);
            return;
        }

        if (room.hostSocketId !== socket.id) {
            const errRes = { success: false, error: 'Only the room host can advance to the next level' };
            if (typeof callback === 'function') callback(errRes);
            return;
        }

        if (!room.customMapData) {
            room.levelIndex = (room.levelIndex + 1) % CAMPAIGN_LEVELS.length;
        }

        room.status = 'playing';
        room.destroyedEnemyIds = new Set();

        const levelData = room.customMapData || CAMPAIGN_LEVELS[room.levelIndex] || CAMPAIGN_LEVELS[0];
        room.tileMap.loadLevelData(levelData);
        initRoomEnemies(room, levelData);

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
            playerEntity.isDead = false;
            playerEntity.fuel = 100;
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
        console.log(`🚀 Next level (${room.levelIndex}) started in Room ${room.id} by Host ${socket.id}`);
    });

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

if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
    gameLoop.start();
    httpServer.listen(PORT, () => {
        console.log(`🚀 Jetpack Multiplayer Server listening on http://localhost:${PORT}`);
    });
}

export { app, httpServer, io };
