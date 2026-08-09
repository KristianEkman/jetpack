/* ==========================================================================
   SERVER FIXED TICK GAME LOOP (60 Hz Engine)
   ========================================================================== */

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

export class GameLoop {
  roomManager: RoomManager;
  io: any;
  tickRate: number;
  dt: number;
  intervalMs: number;
  timer: NodeJS.Timeout | null;
  isRunning: boolean;
  accumulator: number;
  lastTime: number;
  maxCatchUpTicks: number;

  constructor(roomManager: RoomManager, io: any, tickRate: number = 60) {
    this.roomManager = roomManager;
    this.io = io;
    this.tickRate = tickRate;
    this.dt = 1 / tickRate;
    this.intervalMs = 1000 / tickRate;
    this.timer = null;
    this.isRunning = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.maxCatchUpTicks = 5;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.timer = setTimeout(() => this.runScheduledLoop(), this.intervalMs);
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

  runScheduledLoop(): void {
    if (!this.isRunning) return;

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
    this.timer = setTimeout(() => this.runScheduledLoop(), delay);
  }

  tick(): void {
    const snapshotTimestamp = Date.now();
    for (const room of this.roomManager.rooms.values()) {
      if (room.status !== "playing") continue;

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
        room.enemyManager.update(this.dt, Array.from(room.players.values()));
      }

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
            let spawnX = 128,
              spawnY = 100;
            if (room.tileMap) {
              for (let r = 0; r < room.tileMap.rows; r++) {
                for (let c = 0; c < room.tileMap.cols; c++) {
                  if (room.tileMap.getTile(c, r) === TILES.SPAWN) {
                    spawnX = c * TILE_SIZE + 4;
                    spawnY = r * TILE_SIZE + 2;
                    break;
                  }
                }
              }
            }
            playerEntity.spawn(spawnX, spawnY);
            playerEntity.deathTimer = 0;
          }
        } else {
          playerEntity.deathTimer = 0;
        }
      }

      if (
        room.status === "playing" &&
        room.tileMap
      ) {
        const allEmeraldsCaught =
          (room.tileMap.totalEmeralds > 0 &&
            room.tileMap.collectedEmeralds >= room.tileMap.totalEmeralds) ||
          (room.tileMap.totalEmeralds === 0 &&
            room.tileMap.collectedEmeralds >= 4);

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
            room.status = "finished";
            const serializedRoom = this.roomManager.serializeRoom(room);
            if (this.io) {
              this.io
                .to(room.id)
                .emit(GAME_EVENTS.LEVEL_COMPLETE || "level_complete", {
                  success: true,
                  roomId: room.id,
                  clearedBy: clearingPlayer ? clearingPlayer.name : "Team",
                  players: serializedRoom.players,
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
          const remainingPlayers = Array.from(room.players.entries()).filter(
            ([, playerEntity]) => playerEntity.lives > 0,
          );

          if (remainingPlayers.length <= 1) {
            if (room.competeEndTimer === undefined) {
              room.competeEndTimer = 2.5;
            } else {
              room.competeEndTimer -= this.dt;
            }

            if (room.competeEndTimer <= 0) {
              room.status = "finished";
              room.competeEndTimer = undefined;
              const winnerEntry = remainingPlayers[0] || null;
              const serializedRoom = this.roomManager.serializeRoom(room);
              if (this.io) {
                this.io.to(room.id).emit(GAME_EVENTS.GAME_OVER || "game_over", {
                  roomId: room.id,
                  reason: "compete_match_complete",
                  winnerSocketId: winnerEntry?.[0],
                  winnerName: winnerEntry?.[1].name,
                  players: serializedRoom.players,
                  room: serializedRoom,
                });
              }
              console.log(
                `⚔️ Match finished in Room ${room.id}. Winner: ${winnerEntry?.[1].name || "Draw"}`,
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
            room.status = "finished";
            const serializedRoom = this.roomManager.serializeRoom(room);
            if (this.io) {
              this.io.to(room.id).emit(GAME_EVENTS.GAME_OVER || "game_over", {
                roomId: room.id,
                reason: "all_players_eliminated",
                players: serializedRoom.players,
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
        const snapshot: any = {
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
  }
}
