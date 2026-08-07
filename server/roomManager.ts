/* ==========================================================================
   SERVER ROOM & LOBBY MANAGER
   ========================================================================== */

import { TileMap } from "../js/world/tilemap.js";
import { Player } from "../js/entities/player.js";
import { EnemyManager } from "../js/entities/enemy/index.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import * as types from "../js/shared/types.js";
import { AudioManager } from "../js/audio/audioManager.js";
import { MULTIPLAYER_MODES } from "../js/shared/constants.js";

const PLAYER_COLORS = [
  "#ff4444",
  "#44ff44",
  "#4488ff",
  "#ffff44",
  "#ff44ff",
  "#00ffff",
];

export interface PlayerConfig {
  socketId: string;
  id: string;
  name: string;
  color: string;
  isReady: boolean;
  isHost: boolean;
  pendingInputs: types.SerializedInputState[];
  lastInput: types.SerializedInputState | null;
  lastSequenceId: number;
  lastReceivedSequenceId: number;
}

export interface ServerRoom {
  id: string;
  hostSocketId: string;
  maxPlayers: number;
  levelIndex: number;
  gameMode: types.MultiplayerGameMode;
  customMapData: any | null;
  mapName: string;
  tileMap: TileMap;
  enemyManager: EnemyManager;
  players: Map<string, Player>;
  playerConfigs: Map<string, PlayerConfig>;
  status: "lobby" | "playing" | "finished";
  tickCount: number;
  destroyedEnemyIds: Set<string>;
  createdAt: number;
  competeEndTimer?: number;
}

export class RoomManager {
  rooms: Map<string, ServerRoom>;
  socketToRoom: Map<string, string>;

  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let roomId: string;
    do {
      roomId = "";
      for (let i = 0; i < 4; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(roomId));
    return roomId;
  }

  createRoom(hostSocketId: string, options: any = {}): ServerRoom {
    const existingRoomId = this.socketToRoom.get(hostSocketId);
    if (existingRoomId) {
      const existingRoom = this.rooms.get(existingRoomId);
      if (existingRoom && existingRoom.status === "finished") {
        this.leaveRoom(hostSocketId);
      } else {
        throw new Error("You must leave your current room before creating another one");
      }
    }

    const customCode =
      typeof options.customCode === "string"
        ? options.customCode.trim().toUpperCase()
        : "";
    if (customCode && !/^[A-HJ-NP-Z2-9]{4}$/.test(customCode)) {
      throw new Error("Custom room codes must contain four valid characters");
    }

    const roomId = customCode || this.generateRoomId();
    if (this.rooms.has(roomId)) {
      throw new Error("Room code already exists");
    }

    const levelIndex =
      options.levelIndex !== undefined ? options.levelIndex : 0;
    const requestedMaxPlayers = Number(options.maxPlayers);
    const maxPlayers = Number.isFinite(requestedMaxPlayers)
      ? Math.min(4, Math.max(1, Math.floor(requestedMaxPlayers)))
      : 4;
    const gameMode: types.MultiplayerGameMode =
      options.gameMode === MULTIPLAYER_MODES.COMPETE
        ? MULTIPLAYER_MODES.COMPETE
        : MULTIPLAYER_MODES.COOP;

    const tileMap = new TileMap({ effectsEnabled: false });
    let levelData = CAMPAIGN_LEVELS[levelIndex] || CAMPAIGN_LEVELS[0];
    let customMapData = null;
    let mapName = levelData
      ? levelData.name || `Level ${levelIndex + 1}`
      : "Campaign Level";

    if (
      options.customMapData &&
      Array.isArray(options.customMapData.grid) &&
      options.customMapData.grid.length === 540
    ) {
      customMapData = options.customMapData;
      levelData = customMapData;
      mapName = customMapData.name || "Custom Map";
    }

    tileMap.loadLevelData(levelData);

    const enemyManager = new EnemyManager(tileMap);

    const room: ServerRoom = {
      id: roomId,
      hostSocketId: hostSocketId,
      maxPlayers: maxPlayers,
      levelIndex: levelIndex,
      gameMode: gameMode,
      customMapData: customMapData,
      mapName: mapName,
      tileMap: tileMap,
      enemyManager: enemyManager,
      players: new Map(),
      playerConfigs: new Map(),
      status: "lobby",
      tickCount: 0,
      destroyedEnemyIds: new Set(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);

    this.addPlayerToRoom(room, hostSocketId, {
      name: options.playerName || "Player 1 (Host)",
      color: options.playerColor || PLAYER_COLORS[0],
      isHost: true,
    });

    return room;
  }

  addPlayerToRoom(
    room: ServerRoom,
    socketId: string,
    playerOptions: any = {},
  ): PlayerConfig {
    const playerIndex = room.players.size;
    const color =
      playerOptions.color ||
      playerOptions.playerColor ||
      PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
    const playerId = `player_${playerIndex + 1}_${socketId.substr(0, 4)}`;
    const name =
      playerOptions.name ||
      playerOptions.playerName ||
      `Player ${playerIndex + 1}`;

    const playerEntity = new Player(new AudioManager(), room.tileMap, {
      id: playerId,
      color: color,
      name: name,
      isLocal: false,
    });

    const spawns = room.tileMap.spawnPoints || [{ x: 128, y: 100 }];
    const spawn = spawns[playerIndex % spawns.length] ||
      spawns[0] || { x: 128, y: 100 };
    playerEntity.spawn(spawn.x, spawn.y);

    const playerConfig: PlayerConfig = {
      socketId: socketId,
      id: playerId,
      name: name,
      color: color,
      isReady: playerOptions.isHost || false,
      isHost: !!playerOptions.isHost,
      pendingInputs: [],
      lastInput: null,
      lastSequenceId: 0,
      lastReceivedSequenceId: 0,
    };

    room.players.set(socketId, playerEntity);
    room.playerConfigs.set(socketId, playerConfig);
    this.socketToRoom.set(socketId, room.id);

    return playerConfig;
  }

  joinRoom(
    roomId: string,
    socketId: string,
    playerOptions: any = {},
  ): { success: boolean; error?: string; room?: any; player?: PlayerConfig } {
    const code = roomId.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.players.has(socketId)) {
      return {
        success: true,
        room: this.serializeRoom(room),
        player: room.playerConfigs.get(socketId),
      };
    }

    if (room.status !== "lobby") {
      return { success: false, error: "Game in progress" };
    }

    if (room.players.size >= room.maxPlayers) {
      return { success: false, error: "Room is full" };
    }

    const playerConfig = this.addPlayerToRoom(room, socketId, playerOptions);

    return {
      success: true,
      room: this.serializeRoom(room),
      player: playerConfig,
    };
  }

  leaveRoom(socketId: string): any {
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
    let newHostSocketId: string | null = null;

    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      roomDestroyed = true;
    } else if (room.hostSocketId === socketId) {
      newHostSocketId = room.players.keys().next().value || null;
      room.hostSocketId = newHostSocketId!;
      const newHostConfig = room.playerConfigs.get(newHostSocketId!);
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
      room: roomDestroyed ? null : this.serializeRoom(room),
    };
  }

  getRoom(roomId: string): ServerRoom | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  getRoomBySocketId(socketId: string): ServerRoom | null {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) || null : null;
  }

  serializeRoom(room: ServerRoom | null): any {
    if (!room) return null;

    const playersList: any[] = [];
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
        facingRight: playerEntity ? playerEntity.facingRight : true,
      });
    }

    return {
      id: room.id,
      hostSocketId: room.hostSocketId,
      maxPlayers: room.maxPlayers,
      levelIndex: room.levelIndex,
      gameMode: room.gameMode,
      customMapData: room.customMapData,
      mapName: room.mapName,
      status: room.status,
      tickCount: room.tickCount,
      players: playersList,
      destroyedEnemyIds: room.destroyedEnemyIds
        ? Array.from(room.destroyedEnemyIds)
        : [],
    };
  }

  listRooms(): any[] {
    const list: any[] = [];
    for (const room of this.rooms.values()) {
      if (room.status !== "lobby") continue;
      list.push({
        id: room.id,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        status: room.status,
        levelIndex: room.levelIndex,
        gameMode: room.gameMode,
        mapName: room.mapName,
      });
    }
    return list;
  }
}
