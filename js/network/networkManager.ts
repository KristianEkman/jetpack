/* ==========================================================================
   NETWORK MANAGER MODULE (Socket.IO Multiplayer Sync)
   ========================================================================== */

import { GAME_EVENTS, NETWORK_SETTINGS } from '../shared/constants.js';
import { RoomInfo, SerializedInputState, WorldSnapshotPayload } from '../shared/types.js';

export class NetworkManager {
    socket: any;
    isConnected: boolean;
    socketId: string | null;
    currentRoom: RoomInfo | null;
    lastPing: number;
    jitter: number;
    pingHistory: number[];
    interpolationDelay: number;
    lastSentInput: SerializedInputState | null;
    lastInputTime: number;
    pingTimer: any;

    onRoomCreatedCb: ((data: any) => void) | null;
    onRoomJoinedCb: ((data: any) => void) | null;
    onPlayerJoinedCb: ((data: any) => void) | null;
    onPlayerLeftCb: ((data: any) => void) | null;
    onWorldSnapshotCb: ((snapshot: WorldSnapshotPayload) => void) | null;
    onRoomListCb: ((list: RoomInfo[]) => void) | null;
    onErrorCb: ((err: string) => void) | null;
    onGameStartedCb: ((payload: any) => void) | null;
    onTilePhasedCb: ((data: any) => void) | null;
    onTileRestoredCb: ((data: any) => void) | null;
    onItemCollectedCb: ((data: any) => void) | null;
    onLevelCompleteCb: ((data: any) => void) | null;
    onEnemyDestroyedCb: ((data: any) => void) | null;
    onGameOverCb: ((data: any) => void) | null;

    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.socketId = null;
        this.currentRoom = null;
        this.lastPing = 0;
        this.jitter = 0;
        this.pingHistory = [];
        this.interpolationDelay = NETWORK_SETTINGS?.DEFAULT_INTERPOLATION_DELAY || 100;
        this.lastSentInput = null;
        this.lastInputTime = 0;
        this.pingTimer = null;

        this.onRoomCreatedCb = null;
        this.onRoomJoinedCb = null;
        this.onPlayerJoinedCb = null;
        this.onPlayerLeftCb = null;
        this.onWorldSnapshotCb = null;
        this.onRoomListCb = null;
        this.onErrorCb = null;
        this.onGameStartedCb = null;
        this.onTilePhasedCb = null;
        this.onTileRestoredCb = null;
        this.onItemCollectedCb = null;
        this.onLevelCompleteCb = null;
        this.onEnemyDestroyedCb = null;
        this.onGameOverCb = null;
    }

    connect(serverUrl: string = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'): void {
        if (this.socket) return;

        const ioFactory = typeof window !== 'undefined' ? ((window as any).io || (window as any).SocketIO?.io) : null;
        if (!ioFactory) {
            console.warn('Socket.IO client library not found on window. Ensure socket.io script is loaded.');
            return;
        }

        this.socket = ioFactory(serverUrl, {
            autoConnect: true,
            reconnection: true
        });

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.socketId = this.socket.id;
            console.log(`🌐 Connected to Multiplayer Server (Socket ID: ${this.socketId})`);
            this.startPingMonitor();
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.socketId = null;
            console.log('🔌 Disconnected from Multiplayer Server');
        });

        this.socket.on('connect_error', (err: any) => {
            console.error('❌ Connection error to Multiplayer Server:', err);
            if (this.onErrorCb) this.onErrorCb(`Connection error: ${err.message || 'Server unreachable'}`);
        });

        this.socket.on('error', (err: any) => {
            console.error('❌ Socket Error:', err);
            if (this.onErrorCb) this.onErrorCb(err.message || 'Socket error occurred');
        });

        this.socket.on('room_created', (data: any) => {
            if (data.success) {
                this.currentRoom = data.room;
                if (this.onRoomCreatedCb) this.onRoomCreatedCb(data);
            }
        });

        this.socket.on('room_joined', (data: any) => {
            if (data.success) {
                this.currentRoom = data.room;
                if (this.onRoomJoinedCb) this.onRoomJoinedCb(data);
            }
        });

        this.socket.on('player_joined', (data: any) => {
            if (this.currentRoom && data.room) {
                this.currentRoom = data.room;
            }
            if (this.onPlayerJoinedCb) this.onPlayerJoinedCb(data);
        });

        this.socket.on('player_left', (data: any) => {
            if (this.currentRoom && data.room) {
                this.currentRoom = data.room;
            }
            if (this.onPlayerLeftCb) this.onPlayerLeftCb(data);
        });

        this.socket.on('room_list_updated', (list: RoomInfo[]) => {
            console.log('📋 Public room list updated:', list);
            if (this.onRoomListCb) this.onRoomListCb(list);
        });

        this.socket.on('room_list', (list: RoomInfo[]) => {
            console.log('📋 Received public room list:', list);
            if (this.onRoomListCb) this.onRoomListCb(list);
        });

        this.socket.on(GAME_EVENTS.GAME_STARTED || 'game_started', (payload: any) => {
            if (payload && payload.room) {
                this.currentRoom = payload.room;
            }
            if (this.onGameStartedCb) this.onGameStartedCb(payload);
        });

        this.socket.on(GAME_EVENTS.TILE_PHASED || 'tile_phased', (data: any) => {
            if (this.onTilePhasedCb) this.onTilePhasedCb(data);
        });

        this.socket.on(GAME_EVENTS.TILE_RESTORED || 'tile_restored', (data: any) => {
            if (this.onTileRestoredCb) this.onTileRestoredCb(data);
        });

        this.socket.on(GAME_EVENTS.ITEM_COLLECTED || 'item_collected', (data: any) => {
            if (this.onItemCollectedCb) this.onItemCollectedCb(data);
        });

        this.socket.on(
            GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed',
            (data: any) => {
                if (this.onEnemyDestroyedCb) {
                    this.onEnemyDestroyedCb(data);
                }
            }
        );

        this.socket.on(GAME_EVENTS.LEVEL_COMPLETE || 'level_complete', (data: any) => {
            if (this.onLevelCompleteCb) this.onLevelCompleteCb(data);
        });

        this.socket.on(GAME_EVENTS.GAME_OVER || 'game_over', (data: any) => {
            if (this.onGameOverCb) this.onGameOverCb(data);
        });

        this.socket.on(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', (snapshot: WorldSnapshotPayload) => {
            if (this.onWorldSnapshotCb) this.onWorldSnapshotCb(snapshot);
        });

        this.socket.on('join_error', (err: any) => {
            if (this.onErrorCb) this.onErrorCb(err.error || 'Failed to join room');
        });
    }

    createRoom(options: any = {}, callback: ((res: any) => void) | null = null): void {
        if (!this.socket) this.connect();
        this.socket.emit('create_room', options, (response: any) => {
            if (response && response.success) {
                this.currentRoom = response.room;
            }
            if (callback) callback(response);
        });
    }

    joinRoom(roomId: string, options: any = {}, callback: ((res: any) => void) | null = null): void {
        if (!this.socket) this.connect();
        const payload = { roomId: roomId, ...options };
        this.socket.emit('join_room', payload, (response: any) => {
            if (response && response.success) {
                this.currentRoom = response.room;
            }
            if (callback) callback(response);
        });
    }

    leaveRoom(callback: ((res: any) => void) | null = null): void {
        if (!this.socket) return;
        this.socket.emit('leave_room', (response: any) => {
            this.currentRoom = null;
            if (callback) callback(response);
        });
    }

    startMatch(options: any = {}, callback: ((res: any) => void) | null = null): void {
        if (!this.socket || !this.currentRoom) return;
        this.socket.emit(GAME_EVENTS.START_MATCH || 'start_match', options, (response: any) => {
            if (response && response.success) {
                this.currentRoom = response.room;
            }
            if (callback) callback(response);
        });
    }

    listRooms(callback: ((list: RoomInfo[]) => void) | null = null): void {
        if (!this.socket) this.connect();
        this.socket.emit('list_rooms', (list: RoomInfo[]) => {
            if (callback) callback(list);
        });
    }

    startPingMonitor(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
            if (!this.socket || !this.isConnected) return;
            const startTime = Date.now();
            this.socket.emit('ping_handshake', () => {
                const rtt = Date.now() - startTime;
                this.pingHistory.push(rtt);
                if (this.pingHistory.length > 10) this.pingHistory.shift();

                const avgRtt = this.pingHistory.reduce((a, b) => a + b, 0) / this.pingHistory.length;
                const jitter = this.pingHistory.reduce((acc, p) => acc + Math.abs(p - avgRtt), 0) / this.pingHistory.length;

                this.lastPing = Math.round(avgRtt);
                this.jitter = Math.round(jitter);
                this.interpolationDelay = Math.min(180, Math.max(80, Math.round(80 + jitter * 2)));
            });
        }, 2500);
    }

    sendInput(inputState: SerializedInputState): void {
        if (!this.socket || !this.isConnected || !this.currentRoom || !inputState) return;

        const now = Date.now();
        const hasChanged = !this.lastSentInput ||
            this.lastSentInput.left !== inputState.left ||
            this.lastSentInput.right !== inputState.right ||
            this.lastSentInput.up !== inputState.up ||
            this.lastSentInput.down !== inputState.down ||
            this.lastSentInput.thrust !== inputState.thrust ||
            this.lastSentInput.phase !== inputState.phase ||
            this.lastSentInput.suicide !== inputState.suicide ||
            Math.abs((this.lastSentInput.x || 0) - (inputState.x || 0)) > 0.5 ||
            Math.abs((this.lastSentInput.y || 0) - (inputState.y || 0)) > 0.5;

        const heartbeatExpired = (now - this.lastInputTime) >= (NETWORK_SETTINGS?.INPUT_HEARTBEAT_INTERVAL || 50);

        if (hasChanged || heartbeatExpired) {
            this.lastSentInput = { ...inputState };
            this.lastInputTime = now;
            this.socket.emit(GAME_EVENTS.PLAYER_INPUT || 'player_input', inputState);
        }
    }

    sendPlayerDied(reason: string = 'enemy'): void {
        if (!this.socket || !this.isConnected || !this.currentRoom) return;
        this.socket.emit(GAME_EVENTS.PLAYER_DIED || 'player_died', { reason });
    }

    sendEnemyDestroyed(enemyId: string, callback: any = null): void {
        if (!this.socket || !this.isConnected || !this.currentRoom) {
            return;
        }

        this.socket.emit(
            GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed',
            { enemyId },
            callback
        );
    }

    completeLevel(callback: any = null): void {
        if (!this.socket || !this.isConnected || !this.currentRoom) return;
        this.socket.emit(GAME_EVENTS.COMPLETE_LEVEL || 'complete_level', {}, (response: any) => {
            if (response?.success && response.room) {
                this.currentRoom = response.room;
            }
            callback?.(response);
        });
    }

    nextLevel(callback: any = null): void {
        if (!this.socket || !this.isConnected || !this.currentRoom) return;
        this.socket.emit(GAME_EVENTS.NEXT_LEVEL || 'next_level', {}, (response: any) => {
            if (response?.success && response.room) {
                this.currentRoom = response.room;
            }
            callback?.(response);
        });
    }
}
