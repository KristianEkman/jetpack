/* ==========================================================================
   NETWORK MANAGER MODULE (Socket.IO Multiplayer Sync)
   ========================================================================== */

import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import {
  GAME_EVENTS,
  NETWORK_SETTINGS,
  ROOM_EVENTS,
} from "../shared/constants.js";
import type { SerializedInputState } from "../shared/types.js";
import {
  ChangeLevelOptions,
  CreateRoomOptions,
  EnemyDestroyedPayload,
  EnemyDestroyedResponse,
  GameOverPayload,
  GameStartedPayload,
  ItemCollectedPayload,
  JoinRoomOptions,
  LevelCompletePayload,
  MultiplayerRoomInfo,
  NetworkWorldSnapshotPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PublicRoomInfo,
  RoomActionResponse,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomUpdatedPayload,
  TilePositionPayload,
} from "../shared/payloads.js";

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
  onRoomUpdatedCb: ((data: RoomUpdatedPayload) => void) | null;

  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.socketId = null;
    this.currentRoom = null;
    this.lastPing = 0;
    this.jitter = 0;
    this.pingHistory = [];
    this.interpolationDelay =
      NETWORK_SETTINGS?.DEFAULT_INTERPOLATION_DELAY || 65;
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
    this.onRoomUpdatedCb = null;

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.disconnect();
      });
    }
  }

  disconnect(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.socketId = null;
    this.currentRoom = null;
  }

  connect(
    serverUrl: string = typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  ): void {
    if (this.socket && !this.socket.disconnected) return;
    if (this.socket) {
      this.disconnect();
    }

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
      transports: ["websocket", "polling"],
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

    socket.on(ROOM_EVENTS.ROOM_CREATED, (data: RoomCreatedPayload) => {
      if (data.success) {
        this.currentRoom = data.room;
        this.onRoomCreatedCb?.(data);
      }
    });

    socket.on(ROOM_EVENTS.ROOM_JOINED, (data: RoomJoinedPayload) => {
      if (data.success) {
        this.currentRoom = data.room;
        this.onRoomJoinedCb?.(data);
      }
    });

    socket.on(ROOM_EVENTS.PLAYER_JOINED, (data: PlayerJoinedPayload) => {
      if (this.currentRoom && data.room) {
        this.currentRoom = data.room;
      }
      this.onPlayerJoinedCb?.(data);
    });

    socket.on(ROOM_EVENTS.PLAYER_LEFT, (data: PlayerLeftPayload) => {
      if (this.currentRoom && data.room) {
        this.currentRoom = data.room;
      }
      this.onPlayerLeftCb?.(data);
    });

    socket.on(ROOM_EVENTS.ROOM_UPDATED, (data: RoomUpdatedPayload) => {
      if (data.room) {
        this.currentRoom = data.room;
      }
      this.onRoomUpdatedCb?.(data);
    });

    socket.on("room_list_updated", (list: PublicRoomInfo[]) => {
      console.log("📋 Public room list updated:", list);
      this.onRoomListCb?.(list);
    });

    socket.on(ROOM_EVENTS.ROOM_LIST, (list: PublicRoomInfo[]) => {
      console.log("📋 Received public room list:", list);
      this.onRoomListCb?.(list);
    });

    socket.on(GAME_EVENTS.GAME_STARTED, (payload: GameStartedPayload) => {
      if (payload.room) {
        this.currentRoom = payload.room;
      }
      this.onGameStartedCb?.(payload);
    });

    socket.on(GAME_EVENTS.TILE_PHASED, (data: TilePositionPayload) => {
      this.onTilePhasedCb?.(data);
    });

    socket.on(GAME_EVENTS.TILE_RESTORED, (data: TilePositionPayload) => {
      this.onTileRestoredCb?.(data);
    });

    socket.on(GAME_EVENTS.ITEM_COLLECTED, (data: ItemCollectedPayload) => {
      this.onItemCollectedCb?.(data);
    });

    socket.on(GAME_EVENTS.ENEMY_DESTROYED, (data: EnemyDestroyedPayload) => {
      this.onEnemyDestroyedCb?.(data);
    });

    socket.on(GAME_EVENTS.LEVEL_COMPLETE, (data: LevelCompletePayload) => {
      if (data.room) {
        this.currentRoom = data.room;
      }
      this.onLevelCompleteCb?.(data);
    });

    socket.on(GAME_EVENTS.GAME_OVER, (data: GameOverPayload) => {
      if (data.room) {
        this.currentRoom = data.room;
      }
      this.onGameOverCb?.(data);
    });

    socket.on(
      GAME_EVENTS.WORLD_SNAPSHOT,
      (snapshot: NetworkWorldSnapshotPayload) => {
        this.onWorldSnapshotCb?.(snapshot);
      },
    );

    socket.on(ROOM_EVENTS.JOIN_ERROR, (error: { error?: string }) => {
      this.onErrorCb?.(error.error || "Failed to join room");
    });

    socket.on(ROOM_EVENTS.ROOM_CREATE_ERROR, (error: { error?: string }) => {
      this.onErrorCb?.(error.error || "Failed to create room");
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

    socket.emit(
      ROOM_EVENTS.CREATE_ROOM,
      options,
      (response: RoomActionResponse) => {
        if (response.success && response.room) {
          this.currentRoom = response.room;
        } else if (!response.success && response.error) {
          this.onErrorCb?.(response.error);
        }
        callback?.(response);
      },
    );
  }

  joinRoom(
    roomId: string,
    options: JoinRoomOptions = {},
    callback: NetworkCallback<RoomActionResponse> | null = null,
  ): void {
    const socket = this.getConnectedSocket();
    if (!socket) return;

    const payload = { roomId, ...options };
    socket.emit(
      ROOM_EVENTS.JOIN_ROOM,
      payload,
      (response: RoomActionResponse) => {
        if (response.success && response.room) {
          this.currentRoom = response.room;
        }
        callback?.(response);
      },
    );
  }

  leaveRoom(callback: NetworkCallback<RoomActionResponse> | null = null): void {
    if (!this.socket) return;

    this.socket.emit(ROOM_EVENTS.LEAVE_ROOM, (response: RoomActionResponse) => {
      this.currentRoom = null;
      callback?.(response);
    });
  }

  changeLevel(
    options: ChangeLevelOptions = {},
    callback: NetworkCallback<RoomActionResponse> | null = null,
  ): void {
    const socket = this.getConnectedSocket();
    if (!socket || !this.currentRoom) return;

    socket.emit(
      ROOM_EVENTS.CHANGE_LEVEL,
      options,
      (response: RoomActionResponse) => {
        if (response.success && response.room) {
          this.currentRoom = response.room;
        } else if (!response.success && response.error) {
          this.onErrorCb?.(response.error);
        }
        callback?.(response);
      },
    );
  }

  startMatch(
    options: Record<string, unknown> = {},
    callback: NetworkCallback<RoomActionResponse> | null = null,
  ): void {
    if (!this.socket || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.START_MATCH,
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

    socket.emit(ROOM_EVENTS.LIST_ROOMS, (list: PublicRoomInfo[]) => {
      callback?.(list);
    });
  }

  startPingMonitor(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (!this.socket || !this.isConnected) return;
      const startTime = Date.now();
      this.socket.emit(ROOM_EVENTS.PING_HANDSHAKE, () => {
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
        const baseDelay = NETWORK_SETTINGS?.DEFAULT_INTERPOLATION_DELAY || 65;
        this.interpolationDelay = Math.min(
          140,
          Math.max(50, Math.round(baseDelay + jitter * 1.5)),
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
      this.socket.emit(GAME_EVENTS.PLAYER_INPUT, inputState);
    }
  }

  sendPlayerDied(reason: string = "enemy"): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;
    this.socket.emit(GAME_EVENTS.PLAYER_DIED, { reason });
  }

  sendEnemyDestroyed(
    enemyId: string,
    callback: NetworkCallback<EnemyDestroyedResponse> | null = null,
  ): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.ENEMY_DESTROYED,
      { enemyId },
      callback ?? undefined,
    );
  }

  completeLevel(
    callback: NetworkCallback<LevelCompletePayload> | null = null,
  ): void {
    if (!this.socket || !this.isConnected || !this.currentRoom) return;

    this.socket.emit(
      GAME_EVENTS.COMPLETE_LEVEL,
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
      GAME_EVENTS.NEXT_LEVEL,
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
