/* ==========================================================================
   NODE.JS BACKEND MULTIPLAYER SERVER (Express + Socket.IO)
   ========================================================================== */

import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fs from "node:fs";
import { execSync } from "node:child_process";

import { RoomManager, ServerRoom } from "./roomManager.js";
import { GameLoop } from "./gameLoop.js";
import { initFirebaseAdmin, getFirebaseDatabase } from "./firebase.js";
import { createUser, loginUser, getUserById } from "./userModule.js";
import {
  createCustomLevel,
  updateCustomLevel,
  getCustomLevelById,
  listCustomLevels,
  deleteCustomLevel,
  rateCustomLevel,
  submitCustomLevelHighScore,
} from "./levelModule.js";
import {
  GAME_EVENTS,
  MULTIPLAYER_MODES,
  ROOM_EVENTS,
  TILES,
} from "../js/shared/constants.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import {
  ChangeLevelOptions,
  CreateRoomOptions,
  EnemyDestroyedResponse,
  GameStartedPayload,
  ItemCollectedPayload,
  JoinRoomOptions,
  LevelCompletePayload,
  MultiplayerLevelData,
  PublicRoomInfo,
  RoomActionResponse,
  TilePositionPayload,
} from "../js/shared/payloads.js";
import { SerializedInputState } from "../js/shared/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

let serverCommitHash = "dev";
let deployedAt =
  new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";

function loadVersionInfo(): void {
  const distVersionFile = path.join(distDir, "version.json");
  const rootVersionFile = path.join(rootDir, "version.json");

  if (fs.existsSync(distVersionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(distVersionFile, "utf8"));
      if (data.commitHash) serverCommitHash = data.commitHash;
      if (data.deployedAt) deployedAt = data.deployedAt;
      return;
    } catch (e) {}
  }

  if (fs.existsSync(rootVersionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(rootVersionFile, "utf8"));
      if (data.commitHash) serverCommitHash = data.commitHash;
      if (data.deployedAt) deployedAt = data.deployedAt;
      return;
    } catch (e) {}
  }

  try {
    const gitHash = execSync("git rev-parse --short HEAD", { cwd: rootDir })
      .toString()
      .trim();
    if (gitHash) serverCommitHash = gitHash;
  } catch (e) {}
}

loadVersionInfo();
initFirebaseAdmin();

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

export const roomManager = new RoomManager();
export const gameLoop = new GameLoop(roomManager, io, 60);

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.use(express.static(rootDir));

app.get("/api/version", (req, res) => {
  res.json({
    commitHash: serverCommitHash,
    deployedAt: deployedAt,
  });
});

app.get("/health", (req, res) => {
  const mem = process.memoryUsage();
  const roomStats = roomManager.getStats();
  const loopMetrics = gameLoop.getMetrics();
  const connectedSockets = io.sockets.sockets.size;

  res.json({
    status: "ok",
    uptime: Math.round(process.uptime() * 10) / 10,
    timestamp: new Date().toISOString(),
    version: {
      commitHash: serverCommitHash,
      deployedAt: deployedAt,
    },
    activeRooms: roomStats.totalRooms, // Backwards compatible with legacy check
    rooms: roomStats,
    players: {
      connectedSockets,
      totalInRooms: roomStats.totalPlayers,
      inActiveGame: roomStats.inGamePlayers,
    },
    gameLoop: loopMetrics,
    memory: {
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
    },
  });
});

app.post("/api/users/register", async (req, res) => {
  const { name, password } = req.body || {};
  const result = await createUser(name, password);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post("/api/users/login", async (req, res) => {
  const { name, password } = req.body || {};
  const result = await loginUser(name, password);
  if (!result.success) {
    res.status(401).json(result);
    return;
  }
  res.json(result);
});

app.get("/api/users/me/:id", async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.json({ success: true, user });
});

/**
 * Helper to extract user ID from auth header or request body
 */
function getAuthUserId(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers["x-user-id"];
  if (typeof customHeader === "string" && customHeader.trim().length > 0) {
    return customHeader.trim();
  }
  if (req.body && typeof req.body.userId === "string" && req.body.userId.trim().length > 0) {
    return req.body.userId.trim();
  }
  return null;
}

/* ==========================================================================
   CUSTOM LEVELS REST API
   ========================================================================== */

// Create a custom level (requires auth)
app.post("/api/levels", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required to upload level." });
    return;
  }
  const user = await getUserById(userId);
  if (!user) {
    res.status(401).json({ success: false, error: "Invalid user account." });
    return;
  }

  const result = await createCustomLevel(user.id, user.name, req.body);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

// List custom levels (unreleased levels shown only to owner)
app.get("/api/levels", async (req, res) => {
  const userId = getAuthUserId(req);
  const result = await listCustomLevels(userId || undefined);
  if (!result.success) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

// Get custom level by ID (unreleased levels allowed only for owner)
app.get("/api/levels/:id", async (req, res) => {
  const userId = getAuthUserId(req);
  const result = await getCustomLevelById(req.params.id, userId || undefined);
  if (!result.success) {
    res.status(404).json(result);
    return;
  }
  res.json(result);
});

// Update custom level (author only)
app.put("/api/levels/:id", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required to update level." });
    return;
  }
  const result = await updateCustomLevel(req.params.id, userId, req.body);
  if (!result.success) {
    const status = result.error?.includes("Unauthorized") ? 403 : result.error?.includes("not found") ? 404 : 400;
    res.status(status).json(result);
    return;
  }
  res.json(result);
});

// Delete custom level (author only)
app.delete("/api/levels/:id", async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required to delete level." });
    return;
  }
  const result = await deleteCustomLevel(req.params.id, userId);
  if (!result.success) {
    const status = result.error?.includes("Unauthorized") ? 403 : result.error?.includes("not found") ? 404 : 400;
    res.status(status).json(result);
    return;
  }
  res.json(result);
});

// Rate custom level 1-5 stars (anyone)
app.post("/api/levels/:id/rate", async (req, res) => {
  const raterId = getAuthUserId(req) || req.ip || "anonymous";
  const { rating } = req.body || {};
  const result = await rateCustomLevel(req.params.id, raterId, rating);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// Submit high score for custom level (anyone)
app.post("/api/levels/:id/highscore", async (req, res) => {
  const { score, userName } = req.body || {};
  const result = await submitCustomLevelHighScore(req.params.id, score, userName);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});


const ROOM_LIST_CHANNEL = "__room_list_watchers__";

function broadcastRoomList(): void {
  io.to(ROOM_LIST_CHANNEL).emit("room_list_updated", roomManager.listRooms());
}

function initRoomEnemies(
  room: ServerRoom,
  levelData: MultiplayerLevelData,
): void {
  if (!room.enemyManager) return;
  room.enemyManager.clear();
  if (levelData.flitzers) {
    levelData.flitzers.forEach((f) =>
      room.enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy),
    );
  }
  if (levelData.missiles) {
    levelData.missiles.forEach((m) =>
      room.enemyManager.addHomingMissile(m.x, m.y),
    );
  }
  if (levelData.turrets) {
    levelData.turrets.forEach((t) =>
      room.enemyManager.addTurret(t.x, t.y, t.fireInterval),
    );
  }
  if (levelData.bosses) {
    levelData.bosses.forEach((b) =>
      room.enemyManager.addBoss(b.x, b.y, b.hp || 10),
    );
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
      } else if (tile === TILES.ENEMY_BOSS) {
        room.enemyManager.addBoss(c * 32, r * 32, 10);
      }
    }
  }
}

io.on("connection", (socket: Socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on(
    ROOM_EVENTS.PING_HANDSHAKE,
    (
      callback?: (reply: {
        pong: boolean;
        serverTime: number;
        socketId: string;
      }) => void,
    ) => {
      const reply = {
        pong: true,
        serverTime: Date.now(),
        socketId: socket.id,
      };
      if (typeof callback === "function") {
        callback(reply);
      } else {
        socket.emit(ROOM_EVENTS.PONG_HANDSHAKE, reply);
      }
    },
  );

  socket.on(
    ROOM_EVENTS.CREATE_ROOM,
    (
      data: CreateRoomOptions,
      callback?: (res: RoomActionResponse) => void,
    ) => {
      let room: ServerRoom;
      try {
        room = roomManager.createRoom(socket.id, data);
      } catch (error) {
        const response = {
          success: false,
          error:
            error instanceof Error ? error.message : "Unable to create room",
        };
        if (typeof callback === "function") callback(response);
        socket.emit(ROOM_EVENTS.ROOM_CREATE_ERROR, response);
        return;
      }

      socket.leave(ROOM_LIST_CHANNEL);
      socket.join(room.id);

      room.tileMap.on(
        GAME_EVENTS.TILE_PHASED,
        (payload: TilePositionPayload) => {
          io.to(room.id).emit(GAME_EVENTS.TILE_PHASED, payload);
        },
      );
      room.tileMap.on(
        GAME_EVENTS.TILE_RESTORED,
        (payload: TilePositionPayload) => {
          io.to(room.id).emit(GAME_EVENTS.TILE_RESTORED, payload);
        },
      );
      room.tileMap.on(
        GAME_EVENTS.ITEM_COLLECTED,
        (payload: ItemCollectedPayload) => {
          io.to(room.id).emit(GAME_EVENTS.ITEM_COLLECTED, payload);
        },
      );

      const response = {
        success: true,
        roomId: room.id,
        room: roomManager.serializeRoom(room),
        socketId: socket.id,
      };

      if (typeof callback === "function") callback(response);
      socket.emit(ROOM_EVENTS.ROOM_CREATED, response);
      broadcastRoomList();
      console.log(`🏠 Room created: ${room.id} by Host ${socket.id}`);
    },
  );

  socket.on(
    ROOM_EVENTS.JOIN_ROOM,
    (
      data: JoinRoomOptions & { roomId?: string },
      callback?: (res: RoomActionResponse) => void,
    ) => {
      const roomId = data.roomId;
      if (!roomId) {
        const errResponse = { success: false, error: "Room ID required" };
        if (typeof callback === "function") callback(errResponse);
        socket.emit(ROOM_EVENTS.JOIN_ERROR, errResponse);
        return;
      }

      const result = roomManager.joinRoom(roomId, socket.id, data);
      if (!result.success || !result.room) {
        if (typeof callback === "function") callback(result);
        socket.emit(ROOM_EVENTS.JOIN_ERROR, result);
        return;
      }

      socket.leave(ROOM_LIST_CHANNEL);
      socket.join(result.room.id);

      if (typeof callback === "function") callback(result);
      socket.emit(ROOM_EVENTS.ROOM_JOINED, result);

      io.to(result.room.id).emit(ROOM_EVENTS.PLAYER_JOINED, {
        player: result.player,
        room: result.room,
      });

      broadcastRoomList();
      console.log(`👥 Client ${socket.id} joined Room ${result.room.id}`);
    },
  );

  socket.on(
    ROOM_EVENTS.LEAVE_ROOM,
    (callback?: (res: RoomActionResponse) => void) => {
      const result = roomManager.leaveRoom(socket.id);
      if (result) {
        socket.leave(result.roomId);
        const response = { success: true, roomId: result.roomId };
        if (typeof callback === "function") callback(response);
        socket.emit(ROOM_EVENTS.ROOM_LEFT, response);

        if (!result.roomDestroyed && result.room) {
          io.to(result.roomId).emit(ROOM_EVENTS.PLAYER_LEFT, {
            socketId: socket.id,
            leavingPlayer: result.leavingPlayer,
            newHostSocketId: result.newHostSocketId,
            room: result.room,
          });
        }
        broadcastRoomList();
        console.log(`🚪 Client ${socket.id} left Room ${result.roomId}`);
      }
    },
  );

  socket.on(
    ROOM_EVENTS.LIST_ROOMS,
    (callback?: (list: PublicRoomInfo[]) => void) => {
      socket.join(ROOM_LIST_CHANNEL);
      const list = roomManager.listRooms();
      if (typeof callback === "function") callback(list);
      socket.emit(ROOM_EVENTS.ROOM_LIST, list);
    },
  );

  socket.on(
    ROOM_EVENTS.CHANGE_LEVEL,
    (
      data: ChangeLevelOptions,
      callback?: (res: RoomActionResponse) => void,
    ) => {
      try {
        const room = roomManager.changeRoomLevel(socket.id, data);
        const serialized = roomManager.serializeRoom(room);
        const response = { success: true, room: serialized };
        if (typeof callback === "function") callback(response);
        io.to(room.id).emit(ROOM_EVENTS.ROOM_UPDATED, { room: serialized });
        broadcastRoomList();
        console.log(
          `🗺️ Room ${room.id} level changed to ${room.mapName} by Host ${socket.id}`,
        );
      } catch (error) {
        const response = {
          success: false,
          error:
            error instanceof Error ? error.message : "Unable to change level",
        };
        if (typeof callback === "function") callback(response);
      }
    },
  );

  socket.on(
    GAME_EVENTS.START_MATCH,
    (
      data: Record<string, unknown> = {},
      callback?: (res: GameStartedPayload) => void,
    ) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        const errRes = { success: false, error: "Room not found" };
        if (typeof callback === "function") callback(errRes);
        return;
      }

      if (room.hostSocketId !== socket.id) {
        const errRes = {
          success: false,
          error: "Only the room host can start the match",
        };
        if (typeof callback === "function") callback(errRes);
        return;
      }

      roomManager.setRoomStatus(room.id, "playing");
      room.competeEndTimer = undefined;
      room.destroyedEnemyIds = new Set();

      const levelData =
        room.customMapData ||
        CAMPAIGN_LEVELS[room.levelIndex] ||
        CAMPAIGN_LEVELS[0];
      room.tileMap.loadLevelData(levelData);
      initRoomEnemies(room, levelData);

      const spawns =
        room.tileMap?.spawnPoints && room.tileMap.spawnPoints.length > 0
          ? room.tileMap.spawnPoints
          : (room.tileMap?.getPrimarySpawnPoint
            ? [room.tileMap.getPrimarySpawnPoint()]
            : [{ x: 128, y: 100 }]);

      let pIdx = 0;
      for (const [sId, playerEntity] of room.players.entries()) {
        const spawn =
          spawns[pIdx % spawns.length] || spawns[0] || { x: 128, y: 100 };
        playerEntity.spawn(spawn.x, spawn.y);
        playerEntity.lives = 3;
        playerEntity.score = 0;
        playerEntity.isDead = false;
        playerEntity.fuel = 100;
        const config = room.playerConfigs.get(sId);
        if (config) {
          config.pendingInputs = [];
          config.lastInput = null;
          config.lastSequenceId = 0;
          config.lastReceivedSequenceId = 0;
        }
        pIdx++;
      }

      gameLoop.wake();

      const payload = {
        success: true,
        room: roomManager.serializeRoom(room),
        levelIndex: room.levelIndex,
        customMapData: room.customMapData,
      };

      if (typeof callback === "function") callback(payload);
      io.to(room.id).emit(GAME_EVENTS.GAME_STARTED, payload);
      broadcastRoomList();
      console.log(`🚀 Match started in Room ${room.id} by Host ${socket.id}`);
    },
  );

  socket.on(GAME_EVENTS.PLAYER_INPUT, (inputState: SerializedInputState) => {
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

  socket.on(GAME_EVENTS.PLAYER_DIED, (data: { reason: string }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room || room.status !== "playing") return;

    const playerEntity = room.players.get(socket.id);
    if (!playerEntity || playerEntity.isDead) return;

    playerEntity.isDead = true;
    playerEntity.lives--;
    playerEntity.deathTimer = 0;
    const config = room.playerConfigs.get(socket.id);
    if (config) {
      config.pendingInputs = [];
      config.lastInput = null;
    }
    console.log(
      `💀 Player ${socket.id} died (reason: ${data.reason || "enemy"}, lives: ${playerEntity.lives})`,
    );
  });

  socket.on(
    GAME_EVENTS.ENEMY_DESTROYED,
    (
      { enemyId }: { enemyId?: string } = {},
      callback?: (res: EnemyDestroyedResponse) => void,
    ) => {
      const room = roomManager.getRoomBySocketId(socket.id);

      if (!room || room.status !== "playing" || !enemyId) {
        callback?.({
          success: false,
          error: "Invalid enemy destruction",
        });
        return;
      }

      room.destroyedEnemyIds ??= new Set();

      if (room.destroyedEnemyIds.has(enemyId)) {
        callback?.({
          success: true,
          duplicate: true,
        });
        return;
      }

      room.destroyedEnemyIds.add(enemyId);

      if (room.enemyManager) {
        room.enemyManager.removeEnemyById(enemyId);
      }

      io.to(room.id).emit(GAME_EVENTS.ENEMY_DESTROYED, {
        enemyId,
        killedBy: socket.id,
      });

      callback?.({ success: true });
    },
  );

  socket.on(
    GAME_EVENTS.COMPLETE_LEVEL,
    (
      data: Record<string, unknown> = {},
      callback?: (res: LevelCompletePayload) => void,
    ) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || room.status !== "playing") {
        const errRes = { success: false, error: "Room not in playing state" };
        if (typeof callback === "function") callback(errRes);
        return;
      }

      if (
        room.gameMode === MULTIPLAYER_MODES.COOP &&
        room.tileMap &&
        room.tileMap.totalEmeralds > 0 &&
        room.tileMap.collectedEmeralds < room.tileMap.totalEmeralds
      ) {
        const errRes = {
          success: false,
          error: "Cannot complete level until all emeralds are collected",
        };
        if (typeof callback === "function") callback(errRes);
        return;
      }

      roomManager.setRoomStatus(room.id, "finished");
      const playerConfig = room.playerConfigs.get(socket.id);
      const playerName = playerConfig ? playerConfig.name : "Player";

      const serializedRoom = roomManager.serializeRoom(room);
      const payload = {
        success: true,
        clearedBy: playerName,
        socketId: socket.id,
        room: serializedRoom,
        players: serializedRoom ? serializedRoom.players : [],
      };

      if (typeof callback === "function") callback(payload);
      io.to(room.id).emit(
        GAME_EVENTS.LEVEL_COMPLETE || "level_complete",
        payload,
      );
      console.log(`🏆 Level completed in Room ${room.id} by ${playerName}`);
    },
  );

  socket.on(
    GAME_EVENTS.NEXT_LEVEL,
    (
      data: Record<string, unknown> = {},
      callback?: (res: GameStartedPayload) => void,
    ) => {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        const errRes = { success: false, error: "Room not found" };
        if (typeof callback === "function") callback(errRes);
        return;
      }

      if (room.hostSocketId !== socket.id) {
        const errRes = {
          success: false,
          error: "Only the room host can advance to the next level",
        };
        if (typeof callback === "function") callback(errRes);
        return;
      }

      if (!room.customMapData) {
        room.levelIndex = (room.levelIndex + 1) % CAMPAIGN_LEVELS.length;
      }

      roomManager.setRoomStatus(room.id, "playing");
      room.competeEndTimer = undefined;
      room.destroyedEnemyIds = new Set();

      const levelData =
        room.customMapData ||
        CAMPAIGN_LEVELS[room.levelIndex] ||
        CAMPAIGN_LEVELS[0];
      room.tileMap.loadLevelData(levelData);
      initRoomEnemies(room, levelData);

      const spawns =
        room.tileMap?.spawnPoints && room.tileMap.spawnPoints.length > 0
          ? room.tileMap.spawnPoints
          : (room.tileMap?.getPrimarySpawnPoint
            ? [room.tileMap.getPrimarySpawnPoint()]
            : [{ x: 128, y: 100 }]);

      let pIdx = 0;
      for (const [sId, playerEntity] of room.players.entries()) {
        const spawn =
          spawns[pIdx % spawns.length] || spawns[0] || { x: 128, y: 100 };
        playerEntity.spawn(spawn.x, spawn.y);
        playerEntity.lives = 3;
        playerEntity.isDead = false;
        playerEntity.fuel = 100;
        const config = room.playerConfigs.get(sId);
        if (config) {
          config.pendingInputs = [];
          config.lastInput = null;
          config.lastSequenceId = 0;
          config.lastReceivedSequenceId = 0;
        }
        pIdx++;
      }

      gameLoop.wake();

      const payload = {
        success: true,
        room: roomManager.serializeRoom(room),
        levelIndex: room.levelIndex,
        customMapData: room.customMapData,
      };

      if (typeof callback === "function") callback(payload);
      io.to(room.id).emit(GAME_EVENTS.GAME_STARTED || "game_started", payload);
      broadcastRoomList();
      console.log(
        `🚀 Next level (${room.levelIndex}) started in Room ${room.id} by Host ${socket.id}`,
      );
    },
  );

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      if (!result.roomDestroyed && result.room) {
        io.to(result.roomId).emit(ROOM_EVENTS.PLAYER_LEFT, {
          socketId: socket.id,
          leavingPlayer: result.leavingPlayer,
          newHostSocketId: result.newHostSocketId,
          room: result.room,
        });
      }
      broadcastRoomList();
    }
  });
});

const PORT = process.env.PORT || 3000;

if (
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"))
) {
  gameLoop.start();
  httpServer.listen(PORT, () => {
    console.log(
      `🚀 Jetpack Multiplayer Server listening on http://localhost:${PORT}`,
    );
  });
}

export { app, httpServer, io };
