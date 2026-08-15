import { Player } from "./player.js";
import { NETWORK_SETTINGS, PLAYER_FLAGS } from "../shared/constants.js";
import { TileMap } from "../world/tilemap.js";
import { AudioLike, AudioManager, SoundEffects } from "../audio/index.js";
import { PlayerSnapshotTuple, WorldSnapshotPayload } from "../shared/types.js";

export interface AddPlayerOptions {
  id?: string;
  name?: string;
  color?: string;
  isLocal?: boolean;
  showNameTag?: boolean;
  x?: number;
  y?: number;
}

export interface UnpackedPlayerSnapshot {
  socketId: string;
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuel: number;
  lives: number;
  score: number;
  facingRight: boolean;
  isGrounded: boolean;
  isThrusting: boolean;
  isClimbing: boolean;
  isPhasing: boolean;
  isDead: boolean;
  respawnInvulnerability: number;
  lastSequenceId: number;
  name?: string;
  color?: string;
}

export function unpackPlayerSnapshot(
  p: PlayerSnapshotTuple | UnpackedPlayerSnapshot,
): UnpackedPlayerSnapshot {
  if (!Array.isArray(p)) return p;
  const flags = p[9] || 0;
  return {
    socketId: p[0],
    id: p[1],
    x: p[2],
    y: p[3],
    vx: p[4],
    vy: p[5],
    fuel: p[6],
    lives: p[7],
    score: p[8],
    facingRight: (flags & PLAYER_FLAGS.FACING_RIGHT) !== 0,
    isGrounded: (flags & PLAYER_FLAGS.IS_GROUNDED) !== 0,
    isThrusting: (flags & PLAYER_FLAGS.IS_THRUSTING) !== 0,
    isClimbing: (flags & PLAYER_FLAGS.IS_CLIMBING) !== 0,
    isPhasing: (flags & PLAYER_FLAGS.IS_PHASING) !== 0,
    isDead: (flags & PLAYER_FLAGS.IS_DEAD) !== 0,
    respawnInvulnerability: p[10] || 0,
    lastSequenceId: p[11] || 0,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hermite(
  p0: number,
  p1: number,
  v0: number,
  v1: number,
  t: number,
  dtSec: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * p0 + h01 * p1 + h10 * (v0 * dtSec) + h11 * (v1 * dtSec);
}

export interface SnapshotBufferItem {
  tick: number;
  timestamp: number;
  players: UnpackedPlayerSnapshot[];
}

export class PlayerManager {
  audio: AudioManager | SoundEffects | AudioLike | null;
  tileMap: TileMap;
  localSocketId: string | null;
  players: Map<string, Player>;
  snapshotBuffer: SnapshotBufferItem[];
  interpolationDelay: number;
  renderTimeline: number;
  baseServerTick: number;
  baseClientTime: number;

  constructor(
    audio: AudioManager | SoundEffects | AudioLike | null = null,
    tileMap: TileMap,
  ) {
    this.audio = audio;
    this.tileMap = tileMap;
    this.localSocketId = null;
    this.players = new Map();
    this.snapshotBuffer = [];
    this.interpolationDelay =
      NETWORK_SETTINGS?.DEFAULT_INTERPOLATION_DELAY || 75;
    this.renderTimeline = 0;
    this.baseServerTick = 0;
    this.baseClientTime = 0;
  }

  setLocalSocketId(socketId: string): void {
    this.localSocketId = socketId;
    for (const [sId, player] of this.players.entries()) {
      player.isLocal = sId === socketId;
    }
  }

  addPlayer(socketId: string, options: AddPlayerOptions = {}): Player {
    const isLocal =
      options.isLocal !== undefined
        ? options.isLocal
        : socketId === this.localSocketId;
    const player = new Player(this.audio, this.tileMap, {
      id: options.id || socketId,
      name: options.name || "Player",
      color: options.color || "#00f0ff",
      isLocal: isLocal,
      showNameTag: options.showNameTag ?? !isLocal,
    });
    if (options.x !== undefined && options.y !== undefined) {
      player.spawn(options.x, options.y);
    }
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId: string): void {
    this.players.delete(socketId);
  }

  getPlayer(socketId: string): Player | undefined {
    return this.players.get(socketId);
  }

  getLocalPlayer(): Player | null {
    if (this.localSocketId && this.players.has(this.localSocketId)) {
      return this.players.get(this.localSocketId) || null;
    }
    return this.players.values().next().value || null;
  }

  updateFromSnapshot(snapshotPayload: WorldSnapshotPayload | PlayerSnapshotTuple[] | any): void {
    if (!snapshotPayload) return;

    const rawList = Array.isArray(snapshotPayload)
      ? snapshotPayload
      : snapshotPayload.players || [];
    const playersList = rawList.map(unpackPlayerSnapshot);
    const arrivalTimestamp =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const tick = snapshotPayload.tick || 0;

    let snapshotTime = arrivalTimestamp;
    if (tick > 0) {
      if (
        this.baseServerTick === 0 ||
        Math.abs(tick - this.baseServerTick) > 1000
      ) {
        this.baseServerTick = tick;
        this.baseClientTime = arrivalTimestamp;
      }
      const tickDeltaMs = (tick - this.baseServerTick) * (1000 / 60);
      snapshotTime = this.baseClientTime + tickDeltaMs;
      const drift = arrivalTimestamp - snapshotTime;
      this.baseClientTime += drift * 0.05;
    }

    this.snapshotBuffer.push({
      tick,
      timestamp: snapshotTime,
      players: playersList,
    });

    if (this.snapshotBuffer.length > 40) {
      this.snapshotBuffer.shift();
    }

    const activeSocketIds = new Set<string>();

    for (const pData of playersList) {
      const socketId = pData.socketId || pData.id;
      if (!socketId) continue;

      activeSocketIds.add(socketId);
      let player = this.players.get(socketId);

      if (!player) {
        player = this.addPlayer(socketId, {
          id: pData.id,
          name: pData.name,
          color: pData.color,
          isLocal: socketId === this.localSocketId,
          x: pData.x,
          y: pData.y,
        });
      }

      if (socketId === this.localSocketId) {
        if (player.isDead) {
          if (pData.isDead) {
            player.serverAcknowledgedDeath = true;
            if (pData.lives !== undefined) player.lives = pData.lives;
          } else if (
            pData.isDead === false &&
            (player.serverAcknowledgedDeath ||
              Date.now() - (player._localDeathTimestamp || 0) > 500)
          ) {
            player.applySnapshot(pData);
            player.serverAcknowledgedDeath = false;
          }
        } else if (pData.isDead) {
          player.takeDamage();
          player.serverAcknowledgedDeath = true;
          if (pData.lives !== undefined) player.lives = pData.lives;
        } else {
          player.serverAcknowledgedDeath = false;
          player.reconcileServerSnapshot(pData);
        }
      } else {
        if (pData.name) player.name = pData.name;
        if (pData.color) player.color = pData.color;
        if (!player.isDead && pData.isDead) {
          player.takeDamage();
        } else if (this.snapshotBuffer.length <= 1) {
          player.applySnapshot(pData);
        }
      }
    }

    for (const sId of this.players.keys()) {
      if (!activeSocketIds.has(sId)) {
        this.players.delete(sId);
      }
    }
  }

  update(dt: number): void {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const targetRenderTime = now - this.interpolationDelay;

    if (this.renderTimeline === 0) {
      this.renderTimeline = targetRenderTime;
    } else {
      this.renderTimeline += dt * 1000;
      const drift = targetRenderTime - this.renderTimeline;
      if (Math.abs(drift) > 250) {
        this.renderTimeline = targetRenderTime;
      } else {
        this.renderTimeline += drift * Math.min(1, dt * 5);
      }
    }

    const renderTime = this.renderTimeline;

    // Prune stale snapshots older than renderTime - 500ms (keep at least 2)
    while (
      this.snapshotBuffer.length > 2 &&
      this.snapshotBuffer[1].timestamp < renderTime - 500
    ) {
      this.snapshotBuffer.shift();
    }

    let older: SnapshotBufferItem | null = null;
    let newer: SnapshotBufferItem | null = null;

    for (let i = this.snapshotBuffer.length - 1; i >= 0; i--) {
      const snap = this.snapshotBuffer[i];
      if (snap.timestamp <= renderTime) {
        older = snap;
        newer = this.snapshotBuffer[i + 1] || null;
        break;
      }
    }

    if (!older && this.snapshotBuffer.length > 0) {
      older = this.snapshotBuffer[0];
    }

    const latestSnap = this.snapshotBuffer[this.snapshotBuffer.length - 1];

    for (const [sId, player] of this.players.entries()) {
      if (sId === this.localSocketId || player.isLocal) continue;

      player.animTimer += dt;
      player.phaseBeamTimer = Math.max(0, player.phaseBeamTimer - dt);
      player.phaseCooldown = Math.max(0, player.phaseCooldown - dt);
      player.teleportCooldown = Math.max(0, player.teleportCooldown - dt);

      let targetX = player.x;
      let targetY = player.y;
      let targetVx = player.vx;
      let targetVy = player.vy;
      let pTarget: UnpackedPlayerSnapshot | null = null;

      if (older && newer && newer.timestamp > older.timestamp) {
        const t = Math.max(
          0,
          Math.min(
            1,
            (renderTime - older.timestamp) /
              (newer.timestamp - older.timestamp),
          ),
        );

        const pOld = older.players.find((p) => (p.socketId || p.id) === sId);
        const pNew = newer.players.find((p) => (p.socketId || p.id) === sId);

        if (pOld && pNew) {
          pTarget = pNew;
          const dtSec = Math.max(
            0.001,
            (newer.timestamp - older.timestamp) / 1000,
          );
          targetX = hermite(
            pOld.x,
            pNew.x,
            pOld.vx || 0,
            pNew.vx || 0,
            t,
            dtSec,
          );
          targetY = hermite(
            pOld.y,
            pNew.y,
            pOld.vy || 0,
            pNew.vy || 0,
            t,
            dtSec,
          );
          targetVx = lerp(pOld.vx || 0, pNew.vx || 0, t);
          targetVy = lerp(pOld.vy || 0, pNew.vy || 0, t);
        } else if (pNew) {
          pTarget = pNew;
          targetX = pNew.x;
          targetY = pNew.y;
          targetVx = pNew.vx || 0;
          targetVy = pNew.vy || 0;
        }
      } else if (latestSnap) {
        const pLatest = latestSnap.players.find(
          (p) => (p.socketId || p.id) === sId,
        );
        if (pLatest) {
          pTarget = pLatest;
          const extrapTime = Math.min(
            0.1,
            Math.max(0, (renderTime - latestSnap.timestamp) / 1000),
          );
          targetX = pLatest.x + (pLatest.vx || 0) * extrapTime;
          targetY = pLatest.y + (pLatest.vy || 0) * extrapTime;
          targetVx = pLatest.vx || 0;
          targetVy = pLatest.vy || 0;
        }
      }

      if (pTarget) {
        if (!player.isDead && pTarget.isDead) {
          player.takeDamage();
        }

        const dx = targetX - player.x;
        const dy = targetY - player.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 4096 || player.isDead !== pTarget.isDead) {
          player.x = targetX;
          player.y = targetY;
          player.vx = targetVx;
          player.vy = targetVy;
        } else {
          const blend = Math.min(1, dt * 25);
          player.x += dx * blend;
          player.y += dy * blend;
          player.vx = targetVx;
          player.vy = targetVy;
        }

        player.fuel = pTarget.fuel;
        player.lives = pTarget.lives;
        player.score = pTarget.score;
        player.facingRight = pTarget.facingRight;
        player.isGrounded = pTarget.isGrounded;
        player.isThrusting = pTarget.isThrusting;
        player.isClimbing = pTarget.isClimbing;
        player.setPhasing(pTarget.isPhasing);
        player.isDead = pTarget.isDead;
        player.respawnInvulnerability = pTarget.respawnInvulnerability;
      }
    }

    const anyPlayerThrusting = Array.from(this.players.values()).some(
      (p) => !p.isDead && p.isThrusting,
    );
    if (anyPlayerThrusting) {
      this.audio?.startThrust?.();
    } else {
      this.audio?.stopThrust?.();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const player of this.players.values()) {
      player.render(ctx);
    }
  }

  clear(): void {
    this.players.clear();
    this.snapshotBuffer = [];
    this.renderTimeline = 0;
    this.baseServerTick = 0;
    this.baseClientTime = 0;
  }
}
