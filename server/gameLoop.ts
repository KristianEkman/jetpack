/* ==========================================================================
   SERVER FIXED TICK GAME LOOP (60 Hz Engine)
   ========================================================================== */

import { Server } from "socket.io";
import { Player } from "../js/entities/player.js";
import {
  GAME_EVENTS,
  TILE_SIZE,
  TILES,
  NETWORK_SETTINGS,
  PLAYER_FLAGS,
  MULTIPLAYER_MODES,
} from "../js/shared/constants.js";
import { RoomManager } from "./roomManager.js";
import {
  WorldSnapshotPayload,
  SerializedEnemyTuple,
  SerializedProjectileTuple,
} from "../js/shared/types.js";

export interface GameLoopMetrics {
  isRunning: boolean;
  tickRate: number;
  ticksTotal: number;
  avgTickMs: number;
  maxTickMs: number;
  lastTickMs: number;
  activePlayingRoomsCount: number;
}

export class GameLoop {
  roomManager: RoomManager;
  io: Server | null;
  tickRate: number;
  dt: number;
  intervalMs: number;
  idleIntervalMs: number;
  timer: NodeJS.Timeout | null;
  isRunning: boolean;
  accumulator: number;
  lastTime: number;
  maxCatchUpTicks: number;
  ticksTotal: number;
  lastTickMs: number;
  tickDurationSamples: number[];

  constructor(roomManager: RoomManager, io: Server | any, tickRate: number = 60) {
    this.roomManager = roomManager;
    this.io = io;
    this.tickRate = tickRate;
    this.dt = 1 / tickRate;
    this.intervalMs = 1000 / tickRate;
    this.idleIntervalMs = 200; // 5 Hz idle check when 0 rooms are playing
    this.timer = null;
    this.isRunning = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.maxCatchUpTicks = 5;
    this.ticksTotal = 0;
    this.lastTickMs = 0;
    this.tickDurationSamples = [];
  }

  recordTickDuration(durationMs: number): void {
    this.ticksTotal++;
    this.lastTickMs = durationMs;
    this.tickDurationSamples.push(durationMs);
    if (this.tickDurationSamples.length > 60) {
      this.tickDurationSamples.shift();
    }
  }

  getMetrics(): GameLoopMetrics {
    let sum = 0;
    let max = 0;
    const len = this.tickDurationSamples.length;
    for (let i = 0; i < len; i++) {
      const val = this.tickDurationSamples[i];
      sum += val;
      if (val > max) max = val;
    }
    const avg = len > 0 ? sum / len : 0;

    return {
      isRunning: this.isRunning,
      tickRate: this.tickRate,
      ticksTotal: this.ticksTotal,
      avgTickMs: Math.round(avg * 1000) / 1000,
      maxTickMs: Math.round(max * 1000) / 1000,
      lastTickMs: Math.round(this.lastTickMs * 1000) / 1000,
      activePlayingRoomsCount: this.roomManager.playingRooms.size,
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.scheduleNextTick(this.intervalMs);
    console.log(
      `⏱️ Server Game Loop running at ${this.tickRate} Hz (${Math.round(this.intervalMs)}ms interval)`,
    );
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("🛑 Server Game Loop stopped.");
  }

  wake(): void {
    if (!this.isRunning) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.runScheduledLoop();
  }

  scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(() => this.runScheduledLoop(), Math.max(1, delayMs));
  }

  runScheduledLoop(): void {
    if (!this.isRunning) return;

    const playingRooms = this.roomManager.getPlayingRooms();
    if (playingRooms.length === 0) {
      this.accumulator = 0;
      this.lastTime = performance.now();
      this.scheduleNextTick(this.idleIntervalMs);
      return;
    }

    const now = performance.now();
    const elapsed = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;
    this.accumulator += elapsed;

    let updates = 0;
    while (this.accumulator >= this.dt && updates < this.maxCatchUpTicks) {
      this.tick();
      this.accumulator -= this.dt;
      updates++;
    }

    if (updates === this.maxCatchUpTicks && this.accumulator >= this.dt) {
      this.accumulator = 0;
    }

    const delay = Math.max(1, (this.dt - this.accumulator) * 1000);
    this.scheduleNextTick(delay);
  }

  tick(): void {
    const tickStart = performance.now();
    const playingRooms = this.roomManager.getPlayingRooms();
    if (playingRooms.length === 0) return;

    let snapshotTimestamp = 0;
    const snapshotInterval = NETWORK_SETTINGS?.SNAPSHOT_INTERVAL_TICKS || 3;

    for (const room of playingRooms) {
      room.tickCount++;

      if (room.tileMap) {
        room.tileMap.update(this.dt);
      }

      if (room.status === "playing") {
        for (const [socketId, playerEntity] of room.players.entries()) {
          const config = room.playerConfigs.get(socketId);
          if (config && !playerEntity.isDead) {
            const input = config.pendingInputs.shift() || config.lastInput;
            if (input) {
              if (typeof input.x === "number" && typeof input.y === "number") {
                playerEntity.x = input.x;
                playerEntity.y = input.y;
                playerEntity.vx = input.vx || 0;
                playerEntity.vy = input.vy || 0;
                if (input.facingRight !== undefined)
                  playerEntity.facingRight = input.facingRight;
                if (input.isGrounded !== undefined)
                  playerEntity.isGrounded = input.isGrounded;
                if (input.isThrusting !== undefined)
                  playerEntity.isThrusting = input.isThrusting;
                if (input.isClimbing !== undefined)
                  playerEntity.isClimbing = input.isClimbing;
                if (input.isPhasing !== undefined)
                  playerEntity.isPhasing = input.isPhasing;
              }

              const playerTargets =
                room.gameMode === MULTIPLAYER_MODES.COMPETE
                  ? room.players.values()
                  : null;
              playerEntity.simulateMovement(
                this.dt,
                input,
                room.enemyManager,
                playerTargets,
              );
              config.lastInput = input;
              config.lastSequenceId = input.sequenceId || 0;
            }
            playerEntity.checkCollectibles();
          }
        }
      }

      if (room.status === "playing" && room.enemyManager) {
        room.enemyManager.update(this.dt, room.players.values());
      }

      let pIdx = 0;
      for (const [socketId, playerEntity] of room.players.entries()) {
        if (playerEntity.respawnInvulnerability > 0) {
          playerEntity.respawnInvulnerability = Math.max(
            0,
            playerEntity.respawnInvulnerability - this.dt,
          );
        }

        if (playerEntity.isDead) {
          if (playerEntity.deathTimer === undefined) {
            playerEntity.deathTimer = 0;
          }
          playerEntity.deathTimer += this.dt;

          if (playerEntity.deathTimer >= 2.0 && playerEntity.lives > 0) {
            const spawns =
              room.tileMap?.spawnPoints && room.tileMap.spawnPoints.length > 0
                ? room.tileMap.spawnPoints
                : (room.tileMap?.getPrimarySpawnPoint
                  ? [room.tileMap.getPrimarySpawnPoint()]
                  : [{ x: 128, y: 100 }]);
            const spawn =
              spawns[pIdx % spawns.length] || spawns[0] || { x: 128, y: 100 };
            playerEntity.spawn(spawn.x, spawn.y);
            playerEntity.vx = 0;
            playerEntity.vy = 0;
            playerEntity.isDead = false;
            playerEntity.deathTimer = 0;

            const config = room.playerConfigs.get(socketId);
            if (config) {
              config.pendingInputs = [];
              config.lastInput = null;
            }
          }
        } else {
          playerEntity.deathTimer = 0;
        }
        pIdx++;
      }

      if (
        room.status === "playing" &&
        room.tileMap
      ) {
        const bossAlive = room.enemyManager
          ? room.enemyManager.hasAliveBoss()
          : false;
        const allEmeraldsCaught =
          ((room.tileMap.totalEmeralds > 0 &&
            room.tileMap.collectedEmeralds >= room.tileMap.totalEmeralds) ||
            (room.tileMap.totalEmeralds === 0 &&
              room.tileMap.collectedEmeralds >= 4)) &&
          !bossAlive;

        if (allEmeraldsCaught) {
          let levelCleared = false;
          let clearingPlayer: Player | null = null;

          for (const playerEntity of room.players.values()) {
            if (!playerEntity.isDead) {
              const col = Math.floor(
                (playerEntity.x + playerEntity.width / 2) / TILE_SIZE,
              );
              const row = Math.floor(
                (playerEntity.y + playerEntity.height / 2) / TILE_SIZE,
              );
              if (room.tileMap.getTile(col, row) === TILES.EXIT_PORTAL) {
                levelCleared = true;
                clearingPlayer = playerEntity;
                break;
              }
            }
          }

          if (levelCleared) {
            this.roomManager.setRoomStatus(room.id, "finished");
            const serializedRoom = this.roomManager.serializeRoom(room);
            if (this.io) {
              this.io
                .to(room.id)
                .emit(GAME_EVENTS.LEVEL_COMPLETE || "level_complete", {
                  success: true,
                  roomId: room.id,
                  clearedBy: clearingPlayer ? clearingPlayer.name : "Team",
                  players: serializedRoom?.players || [],
                  levelIndex: room.levelIndex,
                  room: serializedRoom,
                });
            }
            console.log(`🏆 Level completed in Room ${room.id}!`);
          }
        }
      }

      if (room.status === "playing" && room.players.size > 0) {
        if (room.gameMode === MULTIPLAYER_MODES.COMPETE) {
          let aliveCount = 0;
          let lastAliveSocketId: string | null = null;
          let lastAlivePlayer: Player | null = null;

          for (const [sId, playerEntity] of room.players.entries()) {
            if (playerEntity.lives > 0) {
              aliveCount++;
              lastAliveSocketId = sId;
              lastAlivePlayer = playerEntity;
            }
          }

          if (aliveCount <= 1) {
            if (room.competeEndTimer === undefined) {
              room.competeEndTimer = 2.5;
            } else {
              room.competeEndTimer -= this.dt;
            }

            if (room.competeEndTimer <= 0) {
              this.roomManager.setRoomStatus(room.id, "finished");
              room.competeEndTimer = undefined;
              const serializedRoom = this.roomManager.serializeRoom(room);
              if (this.io) {
                this.io.to(room.id).emit(GAME_EVENTS.GAME_OVER || "game_over", {
                  roomId: room.id,
                  reason: "compete_match_complete",
                  winnerSocketId: aliveCount === 1 ? lastAliveSocketId : undefined,
                  winnerName: aliveCount === 1 ? lastAlivePlayer?.name : undefined,
                  players: serializedRoom?.players || [],
                  room: serializedRoom,
                });
              }
              console.log(
                `⚔️ Match finished in Room ${room.id}. Winner: ${aliveCount === 1 ? lastAlivePlayer?.name : "Draw"}`,
              );
            }
          } else {
            room.competeEndTimer = undefined;
          }
        } else {
          let allDead = true;
          for (const playerEntity of room.players.values()) {
            if (!playerEntity.isDead || playerEntity.lives > 0) {
              allDead = false;
              break;
            }
          }

          if (allDead) {
            this.roomManager.setRoomStatus(room.id, "finished");
            const serializedRoom = this.roomManager.serializeRoom(room);
            if (this.io) {
              this.io.to(room.id).emit(GAME_EVENTS.GAME_OVER || "game_over", {
                roomId: room.id,
                reason: "all_players_eliminated",
                players: serializedRoom?.players || [],
                room: serializedRoom,
              });
            }
            console.log(
              `💀 All players eliminated in Room ${room.id}! Game Over emitted.`,
            );
          }
        }
      }

      const snapshotInterval = NETWORK_SETTINGS?.SNAPSHOT_INTERVAL_TICKS || 3;
      if (
        room.status === "playing" &&
        room.tickCount % snapshotInterval === 0 &&
        this.io
      ) {
        if (!snapshotTimestamp) {
          snapshotTimestamp = Date.now();
        }
        const snapshot: Omit<WorldSnapshotPayload, "enemies"> & {
          roomId: string;
          tick: number;
          worldState: { collectedEmeralds: number; totalEmeralds: number } | null;
          enemies?: SerializedEnemyTuple[];
          projectiles?: SerializedProjectileTuple[];
        } = {
          roomId: room.id,
          tick: room.tickCount,
          timestamp: snapshotTimestamp,
          worldState: room.tileMap
            ? {
                collectedEmeralds: room.tileMap.collectedEmeralds,
                totalEmeralds: room.tileMap.totalEmeralds,
              }
            : null,
          players: [],
          enemies: room.enemyManager
            ? room.enemyManager.serializeEnemies()
            : [],
          projectiles: room.enemyManager
            ? room.enemyManager.serializeProjectiles()
            : [],
        };

        for (const [socketId, playerEntity] of room.players.entries()) {
          const config = room.playerConfigs.get(socketId);
          const flags =
            (playerEntity.facingRight ? PLAYER_FLAGS.FACING_RIGHT : 0) |
            (playerEntity.isGrounded ? PLAYER_FLAGS.IS_GROUNDED : 0) |
            (playerEntity.isThrusting ? PLAYER_FLAGS.IS_THRUSTING : 0) |
            (playerEntity.isClimbing ? PLAYER_FLAGS.IS_CLIMBING : 0) |
            (playerEntity.isPhasing ? PLAYER_FLAGS.IS_PHASING : 0) |
            (playerEntity.isDead ? PLAYER_FLAGS.IS_DEAD : 0);

          snapshot.players.push([
            socketId,
            playerEntity.id,
            Math.round(playerEntity.x * 100) / 100,
            Math.round(playerEntity.y * 100) / 100,
            Math.round(playerEntity.vx * 100) / 100,
            Math.round(playerEntity.vy * 100) / 100,
            Math.round(playerEntity.fuel * 10) / 10,
            playerEntity.lives,
            playerEntity.score,
            flags,
            Math.round((playerEntity.respawnInvulnerability || 0) * 10) / 10,
            config ? config.lastSequenceId : 0,
          ]);
        }

        this.io
          .to(room.id)
          .volatile.emit(
            GAME_EVENTS.WORLD_SNAPSHOT || "world_snapshot",
            snapshot,
          );
      }
    }

    this.recordTickDuration(performance.now() - tickStart);
  }
}
