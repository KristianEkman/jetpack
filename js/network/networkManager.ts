/* ==========================================================================
   NETWORK MANAGER MODULE (Socket.IO Multiplayer Sync)
   ========================================================================== */

import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { GAME_EVENTS, NETWORK_SETTINGS } from "../shared/constants.js";
import type {
  LevelData,
  SerializedInputState,
  WorldSnapshotPayload,
} from "../shared/types.js";

export interface MultiplayerPlayer {
  id: string;
  socketId: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fuel?: number;
  lives?: number;
  score?: number;
  facingRight?: boolean;
}

export type MultiplayerLevelData = Omit<LevelData, "name"> & {
  name: string;
  flitzers?: Array<{ x: number; y: number; vx: number; vy: number }>;
  missiles?: Array<{ x: number; y: number }>;
  turrets?: Array<{ x: number; y: number; fireInterval: number }>;
};

export interface MultiplayerRoomInfo {
  id: string;
  hostSocketId: string;
  maxPlayers: number;
  levelIndex: number;
  customMapData?: MultiplayerLevelData | null;
  mapName?: string;
  status: "lobby" | "playing" | "ended" | "finished";
  tickCount?: number;
  players: MultiplayerPlayer[];
  destroyedEnemyIds?: string[];
}

export interface PublicRoomInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  status: MultiplayerRoomInfo["status"];
  levelIndex: number;
  mapName?: string;
}

export interface CreateRoomOptions {
  customCode?: string;
  levelIndex?: number;
  maxPlayers?: number;
  playerName?: string;
  playerColor?: string;
  customMapData?: MultiplayerLevelData;
}

export interface JoinRoomOptions {
  playerName?: string;
  playerColor?: string;
}

export interface NetworkResponse {
  success: boolean;
  error?: string;
}

export interface RoomActionResponse extends NetworkResponse {
  room?: MultiplayerRoomInfo;
  roomId?: string;
  socketId?: string;
  player?: MultiplayerPlayer;
}

export interface RoomCreatedPayload extends RoomActionResponse {
  success: true;
  room: MultiplayerRoomInfo;
  roomId: string;
}

export interface RoomJoinedPayload extends RoomActionResponse {
  success: true;
  room: MultiplayerRoomInfo;
}

export interface PlayerJoinedPayload {
  room?: MultiplayerRoomInfo;
  player?: MultiplayerPlayer;
}

export interface PlayerLeftPayload {
  room?: MultiplayerRoomInfo;
  socketId?: string;
  leavingPlayer?: MultiplayerPlayer;
  newHostSocketId?: string | null;
}

export interface GameStartedPayload extends RoomActionResponse {
  room?: MultiplayerRoomInfo;
  levelIndex?: number;
  customMapData?: MultiplayerLevelData | null;
  destroyedEnemyIds?: string[];
}

export interface TilePositionPayload {
  col: number;
  row: number;
}

export interface ItemCollectedPayload extends TilePositionPayload {
  tileType: number;
  collectedEmeralds: number;
  isAllCaught: boolean;
}

export interface EnemyDestroyedPayload {
  enemyId: string;
  killedBy?: string;
}

export interface LevelCompletePayload extends RoomActionResponse {
  clearedBy?: string;
}

export type GameOverPayload = Pick<RoomActionResponse, "room">;

export interface NetworkWorldSnapshotPayload extends WorldSnapshotPayload {
  projectiles?: unknown;
}

export interface EnemyDestroyedResponse extends NetworkResponse {
  duplicate?: boolean;
}

type NetworkCallback<T> = (response: T) => void;
type SocketIoFactory = (
  serverUrl: string,
  options?: Partial<ManagerOptions & SocketOptions>,
) => Socket;
type SocketIoWindow = Window & {
  io?: SocketIoFactory;
  SocketIO?: { io?: SocketIoFactory };
};

function getSocketErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export class NetworkManager {
  socket: Socket | null;
  isConnected: boolean;
  socketId: string | null;
  currentRoom: MultiplayerRoomInfo | null;
  lastPing: number;
  jitter: number;
  pingHistory: number[];
  interpolationDelay: number;
  lastSentInput: SerializedInputState | null;
  lastInputTime: number;
  pingTimer: ReturnType<typeof setInterval> | null;

  onRoomCreatedCb: ((data: RoomCreatedPayload) => void) | null;
  onRoomJoinedCb: ((data: RoomJoinedPayload) => void) | null;
  onPlayerJoinedCb: ((data: PlayerJoinedPayload) => void) | null;
  onPlayerLeftCb: ((data: PlayerLeftPayload) => void) | null;
  onWorldSnapshotCb: ((snapshot: NetworkWorldSnapshotPayload) => void) | null;
  onRoomListCb: ((list: PublicRoomInfo[]) => void) | null;
  onErrorCb: ((err: string) => void) | null;
  onGameStartedCb: ((payload: GameStartedPayload) => void) | null;
  onTilePhasedCb: ((data: TilePositionPayload) => void) | null;
  onTileRestoredCb: ((data: TilePositionPayload) => void) | null;
  onItemCollectedCb: ((data: ItemCollectedPayload) => void) | null;
  onLevelCompleteCb: ((data: LevelCompletePayload) => void) | null;
  onEnemyDestroyedCb: ((data: EnemyDestroyedPayload) => void) | null;
  onGameOverCb: ((data: GameOverPayload) => void) | null;

  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.socketId = null;
    this.currentRoom = null;
    this.lastPing = 0;
    this.jitter = 0;
    this.pingHistory = [];
    this.interpolationDelay =
      NETWORK_SETTINGS?.DEFAULT_INTERPOLATION_DELAY || 100;
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

  connect(
    serverUrl: string = typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  ): void {
    if (this.socket) return;

    const browserWindow =
      typeof window !== "undefined" ? (window as SocketIoWindow) : null;
    const ioFactory = browserWindow?.io || browserWindow?.SocketIO?.io;
    if (!ioFactory) {
      console.warn(
        "Socket.IO client library not found on window. Ensure socket.io script is loaded.",
      );
      return;
    }

    const socket = ioFactory(serverUrl, {
      autoConnect: true,
      reconnection: true,
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.isConnected = true;
      this.socketId = socket.id ?? null;
      console.log(
        `🌐 Connected to Multiplayer Server (Socket ID: ${this.socketId})`,
      );
      this.startPingMonitor();
    });

    socket.on("disconnect", () => {
      this.isConnected = false;
      this.socketId = null;
      console.log("🔌 Disconnected from Multiplayer Server");
    });

    socket.on("connect_error", (error: unknown) => {
      console.error("❌ Connection error to Multiplayer Server:", error);
      this.onErrorCb?.(
        `Connection error: ${getSocketErrorMessage(error, "Server unreachable")}`,
      );
    });

    socket.on("error", (error: unknown) => {
      console.error("❌ Socket Error:", error);
      this.onErrorCb?.(getSocketErrorMessage(error, "Socket error occurred"));
    });

    socket.on("room_created", (data: RoomCreatedPayload) => {
      if (data.success) {
        this.currentRoom = data.room;
        this.onRoomCreatedCb?.(data);
      }
    });

    socket.on("room_joined", (data: RoomJoinedPayload) => {
      if (data.success) {
        this.currentRoom = data.room;
        this.onRoomJoinedCb?.(data);
      }
    });

    socket.on("player_joined", (data: PlayerJoinedPayload) => {
      if (this.currentRoom && data.room) {
        this.currentRoom = data.room;
      }
      this.onPlayerJoinedCb?.(data);
    });

    socket.on("player_left", (data: PlayerLeftPayload) => {
      if (this.currentRoom && data.room) {
        this.currentRoom = data.room;
      }
      this.onPlayerLeftCb?.(data);
    });

    socket.on("room_list_updated", (list: PublicRoomInfo[]) => {
      console.log("📋 Public room list updated:", list);
      this.onRoomListCb?.(list);
    });

    socket.on("room_list", (list: PublicRoomInfo[]) => {
      console.log("📋 Received public room list:", list);
      this.onRoomListCb?.(list);
    });

    socket.on(
      GAME_EVENTS.GAME_STARTED || "game_started",
      (payload: GameStartedPayload) => {
        if (payload.room) {
          this.currentRoom = payload.room;
        }
        this.onGameStartedCb?.(payload);
      },
    );

    socket.on(
      GAME_EVENTS.TILE_PHASED || "tile_phased",
      (data: TilePositionPayload) => {
        this.onTilePhasedCb?.(data);
      },
    );

    socket.on(
      GAME_EVENTS.TILE_RESTORED || "tile_restored",
      (data: TilePositionPayload) => {
        this.onTileRestoredCb?.(data);
      },
    );

    socket.on(
      GAME_EVENTS.ITEM_COLLECTED || "item_collected",
      (data: ItemCollectedPayload) => {
        this.onItemCollectedCb?.(data);
      },
    );

    socket.on(
      GAME_EVENTS.ENEMY_DESTROYED || "enemy_destroyed",
      (data: EnemyDestroyedPayload) => {
        this.onEnemyDestroyedCb?.(data);
      },
    );

    socket.on(
      GAME_EVENTS.LEVEL_COMPLETE || "level_complete",
      (data: LevelCompletePayload) => {
        this.onLevelCompleteCb?.(data);
      },
    );

    socket.on(GAME_EVENTS.GAME_OVER || "game_over", (data: GameOverPayload) => {
      this.onGameOverCb?.(data);
    });

    socket.on(
      GAME_EVENTS.WORLD_SNAPSHOT || "world_snapshot",
      (snapshot: NetworkWorldSnapshotPayload) => {
        this.onWorldSnapshotCb?.(snapshot);
      },
    );

    socket.on("join_error", (error: { error?: string }) => {
      this.onErrorCb?.(error.error || "Failed to join room");
    });
  }

  private getConnectedSocket(): Socket | null {
    if (!this.socket) this.connect();
    return this.socket;
  }

  createRoom(
    options: CreateRoomOptions = {},
    callback: NetworkCallback<RoomActionResponse> | null = null,
  ): void {
    const socket = this.getConnectedSocket();
    if (!socket) return;

    socket.emit("create_room", options, (response: RoomActionResponse) => {
      if (response.success && response.room) {
        this.currentRoom = response.room;
      }
      callback?.(response);
    });
  }

  joinRoom(
    roomId: string,
    options: JoinRoomOptions = {},
    callback: NetworkCallback<RoomActionResponse> | null = null,
  ): void {
    const socket = this.getConnectedSocket();
    if (!socket) return;

    const payload = { roomId, ...options };
    socket.emit("join_room", payload, (response: RoomActionResponse) => {
      if (response.success && response.room) {
        this.currentRoom = response.room;
      }
      callback?.(response);
    });
  }

  leaveRoom(callback: NetworkCallback<RoomActionResponse> | null = null): void {
    if (!this.socket) return;

    this.socket.emit("leave_room", (response: RoomActionResponse) => {
      this.currentRoom = null;
      callback?.(response);
    });
  }

  startMatch(
    options: Record<string, unknown> = {},
    callback: NetworkCallback<RoomActionResponse> | null = null,
  ): void {
    if (!this.socket || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.START_MATCH || "start_match",
      options,
      (response: RoomActionResponse) => {
        if (response.success && response.room) {
          this.currentRoom = response.room;
        }
        callback?.(response);
      },
    );
  }

  listRooms(callback: NetworkCallback<PublicRoomInfo[]> | null = null): void {
    const socket = this.getConnectedSocket();
    if (!socket) return;

    socket.emit("list_rooms", (list: PublicRoomInfo[]) => {
      callback?.(list);
    });
  }

  startPingMonitor(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (!this.socket || !this.isConnected) return;
      const startTime = Date.now();
      this.socket.emit("ping_handshake", () => {
        const rtt = Date.now() - startTime;
        this.pingHistory.push(rtt);
        if (this.pingHistory.length > 10) this.pingHistory.shift();

        const avgRtt =
          this.pingHistory.reduce((a, b) => a + b, 0) / this.pingHistory.length;
        const jitter =
          this.pingHistory.reduce(
            (acc, ping) => acc + Math.abs(ping - avgRtt),
            0,
          ) / this.pingHistory.length;

        this.lastPing = Math.round(avgRtt);
        this.jitter = Math.round(jitter);
        this.interpolationDelay = Math.min(
          180,
          Math.max(80, Math.round(80 + jitter * 2)),
        );
        console.log(
          `⏱️ Ping: ${this.lastPing}ms, Jitter: ${this.jitter}ms, Interpolation Delay: ${this.interpolationDelay}ms`,
        );
      });
    }, 2500);
  }

  sendInput(inputState: SerializedInputState): void {
    if (!this.socket || !this.isConnected || !this.currentRoom || !inputState) {
      return;
    }

    const now = Date.now();
    const hasChanged =
      !this.lastSentInput ||
      this.lastSentInput.left !== inputState.left ||
      this.lastSentInput.right !== inputState.right ||
      this.lastSentInput.up !== inputState.up ||
      this.lastSentInput.down !== inputState.down ||
      this.lastSentInput.thrust !== inputState.thrust ||
      this.lastSentInput.phase !== inputState.phase ||
      this.lastSentInput.suicide !== inputState.suicide ||
      Math.abs((this.lastSentInput.x || 0) - (inputState.x || 0)) > 0.5 ||
      Math.abs((this.lastSentInput.y || 0) - (inputState.y || 0)) > 0.5;

    const heartbeatExpired =
      now - this.lastInputTime >=
      (NETWORK_SETTINGS?.INPUT_HEARTBEAT_INTERVAL || 50);

    if (hasChanged || heartbeatExpired) {
      this.lastSentInput = { ...inputState };
      this.lastInputTime = now;
      this.socket.emit(GAME_EVENTS.PLAYER_INPUT || "player_input", inputState);
    }
  }

  sendPlayerDied(reason: string = "enemy"): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;
    this.socket.emit(GAME_EVENTS.PLAYER_DIED || "player_died", { reason });
  }

  sendEnemyDestroyed(
    enemyId: string,
    callback: NetworkCallback<EnemyDestroyedResponse> | null = null,
  ): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.ENEMY_DESTROYED || "enemy_destroyed",
      { enemyId },
      callback ?? undefined,
    );
  }

  completeLevel(
    callback: NetworkCallback<LevelCompletePayload> | null = null,
  ): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.COMPLETE_LEVEL || "complete_level",
      {},
      (response: LevelCompletePayload) => {
        if (response.success && response.room) {
          this.currentRoom = response.room;
        }
        callback?.(response);
      },
    );
  }

  nextLevel(callback: NetworkCallback<GameStartedPayload> | null = null): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.NEXT_LEVEL || "next_level",
      {},
      (response: GameStartedPayload) => {
        if (response.success && response.room) {
          this.currentRoom = response.room;
        }
        callback?.(response);
      },
    );
  }
}
