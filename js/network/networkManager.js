/* ==========================================================================
   NETWORK MANAGER MODULE (Socket.IO Multiplayer Sync)
   ========================================================================== */

import { GAME_EVENTS } from '../shared/constants.js';

export class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.socketId = null;
        this.currentRoom = null;
        this.lastPing = 0;

        // Callback hooks
        this.onRoomCreatedCb = null;
        this.onRoomJoinedCb = null;
        this.onPlayerJoinedCb = null;
        this.onPlayerLeftCb = null;
        this.onWorldSnapshotCb = null;
        this.onRoomListCb = null;
        this.onErrorCb = null;
    }

    connect(serverUrl = window.location.origin) {
        if (this.socket) return;

        // Use global io script if loaded via HTML or fallback
        const ioFactory = typeof window !== 'undefined' ? (window.io || (window.SocketIO && window.SocketIO.io)) : null;
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

            // Measure ping latency
            const startTime = Date.now();
            this.socket.emit('ping_handshake', () => {
                this.lastPing = Date.now() - startTime;
                console.log(`⚡ Server Ping Latency: ${this.lastPing}ms`);
            });
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.socketId = null;
            console.log('🔌 Disconnected from Multiplayer Server');
        });

        this.socket.on('room_created', (data) => {
            if (data.success) {
                this.currentRoom = data.room;
                if (this.onRoomCreatedCb) this.onRoomCreatedCb(data);
            }
        });

        this.socket.on('room_joined', (data) => {
            if (data.success) {
                this.currentRoom = data.room;
                if (this.onRoomJoinedCb) this.onRoomJoinedCb(data);
            }
        });

        this.socket.on('player_joined', (data) => {
            if (this.currentRoom && data.room) {
                this.currentRoom = data.room;
            }
            if (this.onPlayerJoinedCb) this.onPlayerJoinedCb(data);
        });

        this.socket.on('player_left', (data) => {
            if (this.currentRoom && data.room) {
                this.currentRoom = data.room;
            }
            if (this.onPlayerLeftCb) this.onPlayerLeftCb(data);
        });

        this.socket.on('room_list_updated', (list) => {
            if (this.onRoomListCb) this.onRoomListCb(list);
        });

        this.socket.on('room_list', (list) => {
            if (this.onRoomListCb) this.onRoomListCb(list);
        });

        this.socket.on(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', (snapshot) => {
            if (this.onWorldSnapshotCb) this.onWorldSnapshotCb(snapshot);
        });

        this.socket.on('join_error', (err) => {
            if (this.onErrorCb) this.onErrorCb(err.error || 'Failed to join room');
        });
    }

    createRoom(options = {}, callback = null) {
        if (!this.socket) this.connect();
        this.socket.emit('create_room', options, (response) => {
            if (response && response.success) {
                this.currentRoom = response.room;
            }
            if (callback) callback(response);
        });
    }

    joinRoom(roomId, options = {}, callback = null) {
        if (!this.socket) this.connect();
        const payload = { roomId: roomId, ...options };
        this.socket.emit('join_room', payload, (response) => {
            if (response && response.success) {
                this.currentRoom = response.room;
            }
            if (callback) callback(response);
        });
    }

    leaveRoom(callback = null) {
        if (!this.socket) return;
        this.socket.emit('leave_room', (response) => {
            this.currentRoom = null;
            if (callback) callback(response);
        });
    }

    listRooms(callback = null) {
        if (!this.socket) this.connect();
        this.socket.emit('list_rooms', (list) => {
            if (callback) callback(list);
        });
    }

    sendInput(inputState) {
        if (!this.socket || !this.isConnected || !this.currentRoom) return;
        this.socket.emit(GAME_EVENTS.PLAYER_INPUT || 'player_input', inputState);
    }
}
