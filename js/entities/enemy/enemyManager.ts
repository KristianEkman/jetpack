/* ==========================================================================
   ENEMY MANAGER MODULE
   ========================================================================== */

import { TILE_SIZE, TileMap, TILES } from "../../world/tilemap.js";
import { Player } from "../player.js";
import { ENEMY_TYPES, Enemy, Projectile } from "./types.js";
import { updateFlitzer, renderFlitzer } from "./flitzer.js";
import { updateHomingMissile, renderHomingMissile } from "./homingMissile.js";
import { updateTurret, renderTurret } from "./turret.js";
import { updateBoss, renderBoss, hasBossTileCollision } from "./boss.js";
import { AudioManager } from "../../audio/index.js";

export type SerializedEnemyTuple = [
  id: string,
  type: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  animTimer: number,
  timer: number,
  fireInterval: number | undefined,
  hp: number | undefined,
  maxHp: number | undefined,
  phase: number | undefined,
  hitFlashTimer: number,
];

export type SerializedProjectileTuple = [
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  life: number,
];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class EnemyManager {
  tileMap: TileMap;
  audio: AudioManager | null;
  enemies: Enemy[];
  projectiles: Projectile[];
  nextEnemyId: number;
  onEnemyDestroyed:
    | ((data: { enemyId: string; playerId: string }) => void)
    | null;

  constructor(tileMap: TileMap, audio: AudioManager | null = null) {
    this.tileMap = tileMap;
    this.audio = audio;
    this.enemies = [];
    this.projectiles = [];
    this.nextEnemyId = 0;
    this.onEnemyDestroyed = null;
  }

  clear(): void {
    this.enemies = [];
    this.projectiles = [];
    this.nextEnemyId = 0;
  }

  allocateEnemyId(explicitId: string | null = null): string {
    return explicitId ?? `enemy_${this.nextEnemyId++}`;
  }

  addFlitzer(
    x: number,
    y: number,
    vx: number = 100,
    vy: number = 100,
    id: string | null = null,
  ): void {
    this.enemies.push({
      id: this.allocateEnemyId(id),
      type: ENEMY_TYPES.FLITZER,
      x,
      y,
      width: 20,
      height: 20,
      vx,
      vy,
      animTimer: Math.random() * 10,
    });
  }

  addHomingMissile(x: number, y: number, id: string | null = null): void {
    this.enemies.push({
      id: this.allocateEnemyId(id),
      type: ENEMY_TYPES.HOMING_MISSILE,
      x,
      y,
      width: 16,
      height: 16,
      vx: 0,
      vy: 0,
      speed: 90,
    });
  }

  addTurret(
    x: number,
    y: number,
    fireInterval: number = 2.0,
    id: string | null = null,
  ): void {
    this.enemies.push({
      id: this.allocateEnemyId(id),
      type: ENEMY_TYPES.TURRET,
      x,
      y,
      width: 24,
      height: 24,
      timer: 0,
      fireInterval,
    });
  }

  addBoss(
    x: number,
    y: number,
    maxHp: number = 10,
    id: string | null = null,
  ): void {
    this.enemies.push({
      id: this.allocateEnemyId(id),
      type: ENEMY_TYPES.BOSS,
      x,
      y,
      width: 80,
      height: 64,
      vx: 90,
      vy: 0,
      hp: maxHp,
      maxHp: maxHp,
      phase: 1,
      hitFlashTimer: 0,
      attackTimer: 0,
      laserCharging: false,
      laserChargeTimer: 0,
      laserActiveTimer: 0,
      bossName: "MECHA CORE ALPHA",
      animTimer: 0,
      startY: y,
    });
  }

  hasAliveBoss(): boolean {
    return this.enemies.some(
      (e) =>
        e.type === ENEMY_TYPES.BOSS &&
        !e.dead &&
        (e.hp === undefined || e.hp > 0),
    );
  }

  damageEnemy(
    enemyId: string,
    damage: number = 1,
    playerId: string = "",
  ): boolean {
    const enemy = this.enemies.find((e) => e.id === enemyId);
    if (!enemy) return false;

    if (enemy.type === ENEMY_TYPES.BOSS || enemy.hp !== undefined) {
      const maxHp = enemy.maxHp || 10;
      enemy.hp = Math.max(0, (enemy.hp !== undefined ? enemy.hp : maxHp) - damage);
      enemy.hitFlashTimer = 0.15;

      if (enemy.hp <= maxHp / 2 && (enemy.phase || 1) === 1) {
        enemy.phase = 2;
      }

      if (this.tileMap && this.tileMap.addSparkles) {
        for (let s = 0; s < 6; s++) {
          this.tileMap.addSparkles(
            enemy.x + enemy.width / 2 + (Math.random() * 40 - 20),
            enemy.y + enemy.height / 2 + (Math.random() * 30 - 15),
            "#ffffff",
            2,
          );
        }
      }

      if (enemy.hp <= 0) {
        enemy.dead = true;
        const destroyed = this.removeEnemyById(enemy.id);
        if (destroyed) {
          if (this.tileMap) {
            if (this.tileMap.addSparkles) {
              for (let s = 0; s < 40; s++) {
                this.tileMap.addSparkles(
                  enemy.x + enemy.width / 2 + (Math.random() * 80 - 40),
                  enemy.y + enemy.height / 2 + (Math.random() * 60 - 30),
                  s % 2 === 0 ? "#ff0055" : "#55ff55",
                  3,
                );
              }
            }
            // Defeating the boss drops a treasure burst of coins and emeralds
            const startCol = Math.floor(enemy.x / TILE_SIZE);
            const startRow = Math.floor(enemy.y / TILE_SIZE);
            for (let dc = -1; dc <= 2; dc++) {
              for (let dr = -1; dr <= 2; dr++) {
                const c = startCol + dc;
                const r = startRow + dr;
                if (c >= 0 && c < this.tileMap.cols && r >= 0 && r < this.tileMap.rows) {
                  if (this.tileMap.getTile(c, r) === TILES.AIR) {
                    const tileType = (dc + dr) % 2 === 0 ? TILES.EMERALD : TILES.GOLD;
                    this.tileMap.setTile(c, r, tileType);
                    if (tileType === TILES.EMERALD) {
                      this.tileMap.totalEmeralds++;
                    }
                  }
                }
              }
            }
          }
          this.onEnemyDestroyed?.({ enemyId: destroyed.id, playerId });
        }
        return true;
      }
      return false;
    }

    const destroyed = this.removeEnemyById(enemy.id);
    if (destroyed) {
      this.onEnemyDestroyed?.({ enemyId: destroyed.id, playerId });
    }
    return true;
  }

  removeEnemyById(enemyId: string): Enemy | null {
    const index = this.enemies.findIndex((enemy) => enemy.id === enemyId);
    if (index === -1) {
      return null;
    }
    return this.enemies.splice(index, 1)[0];
  }

  getClosestPlayer(enemy: Enemy, playerInput: Player[]): Player | null {
    if (!playerInput) return null;
    let playersList: Player[] = [];
    if (Array.isArray(playerInput)) {
      playersList = playerInput;
    }

    let closest: Player | null = null;
    let minDistSq = Infinity;
    const ex = enemy.x + enemy.width / 2;
    const ey = enemy.y + enemy.height / 2;

    for (const p of playersList) {
      if (!p || p.isDead) continue;
      const px = p.x + p.width / 2;
      const py = p.y + p.height / 2;
      const distSq = (px - ex) * (px - ex) + (py - ey) * (py - ey);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = p;
      }
    }
    return closest;
  }

  getLivingPlayers(players: Player[]): Player[] {
    if (!players) return [];
    if (Array.isArray(players)) {
      return players.filter(
        (p) => p && !p.isDead && (p.respawnInvulnerability || 0) <= 0,
      );
    }
    return [];
  }

  serializeEnemies(): SerializedEnemyTuple[] {
    return this.enemies.map((e) => [
      e.id,
      e.type,
      Math.round(e.x * 100) / 100,
      Math.round(e.y * 100) / 100,
      Math.round((e.vx || 0) * 100) / 100,
      Math.round((e.vy || 0) * 100) / 100,
      Math.round((e.animTimer || 0) * 100) / 100,
      Math.round((e.timer || 0) * 100) / 100,
      e.fireInterval,
      e.hp,
      e.maxHp,
      e.phase,
      Math.round((e.hitFlashTimer || 0) * 100) / 100,
    ]);
  }

  serializeProjectiles(): SerializedProjectileTuple[] {
    return this.projectiles.map((p) => [
      Math.round(p.x * 100) / 100,
      Math.round(p.y * 100) / 100,
      Math.round(p.vx * 100) / 100,
      Math.round(p.vy * 100) / 100,
      p.radius,
      p.life,
    ]);
  }

  applyEnemySnapshot(snapshotEnemies: any, snapshotProjectiles: any): void {
    if (!Array.isArray(snapshotEnemies)) return;
    const parsedEnemies = snapshotEnemies.map((e) =>
      Array.isArray(e)
        ? {
            id: e[0],
            type: e[1],
            x: e[2],
            y: e[3],
            vx: e[4],
            vy: e[5],
            animTimer: e[6],
            timer: e[7],
            fireInterval: e[8],
            hp: e[9],
            maxHp: e[10],
            phase: e[11],
            hitFlashTimer: e[12],
          }
        : e,
    );

    const serverIds = new Set(parsedEnemies.map((e) => e.id));

    for (const sEnemy of parsedEnemies) {
      let localEnemy = this.enemies.find((e) => e.id === sEnemy.id);
      if (!localEnemy) {
        if (sEnemy.type === ENEMY_TYPES.FLITZER) {
          this.addFlitzer(sEnemy.x, sEnemy.y, sEnemy.vx, sEnemy.vy, sEnemy.id);
        } else if (sEnemy.type === ENEMY_TYPES.HOMING_MISSILE) {
          this.addHomingMissile(sEnemy.x, sEnemy.y, sEnemy.id);
        } else if (sEnemy.type === ENEMY_TYPES.TURRET) {
          this.addTurret(
            sEnemy.x,
            sEnemy.y,
            sEnemy.fireInterval || 2.0,
            sEnemy.id,
          );
        } else if (sEnemy.type === ENEMY_TYPES.BOSS) {
          this.addBoss(
            sEnemy.x,
            sEnemy.y,
            sEnemy.maxHp || 10,
            sEnemy.id,
          );
        }
        localEnemy = this.enemies.find((e) => e.id === sEnemy.id);
      }

      if (localEnemy) {
        if (
          localEnemy.hp !== undefined &&
          sEnemy.hp !== undefined &&
          sEnemy.hp < localEnemy.hp
        ) {
          if (this.audio?.playPhaseImpact) {
            this.audio.playPhaseImpact();
          } else {
            this.audio?.playExplosion?.();
          }
        }
        localEnemy.targetX = sEnemy.x;
        localEnemy.targetY = sEnemy.y;
        localEnemy.vx = sEnemy.vx;
        localEnemy.vy = sEnemy.vy;
        if (sEnemy.hp !== undefined) localEnemy.hp = sEnemy.hp;
        if (sEnemy.maxHp !== undefined) localEnemy.maxHp = sEnemy.maxHp;
        if (sEnemy.phase !== undefined) localEnemy.phase = sEnemy.phase;
        if (sEnemy.hitFlashTimer !== undefined) localEnemy.hitFlashTimer = sEnemy.hitFlashTimer;
        if (sEnemy.timer !== undefined) localEnemy.timer = sEnemy.timer;
        if (sEnemy.animTimer !== undefined) {
          if (
            localEnemy.animTimer === undefined ||
            Math.abs(localEnemy.animTimer - sEnemy.animTimer) > 0.5
          ) {
            localEnemy.animTimer = sEnemy.animTimer;
          }
        }
      }
    }

    this.enemies = this.enemies.filter((e) => serverIds.has(e.id));

    if (Array.isArray(snapshotProjectiles)) {
      this.projectiles = snapshotProjectiles.map((p) =>
        Array.isArray(p)
          ? {
              x: p[0],
              y: p[1],
              vx: p[2],
              vy: p[3],
              radius: p[4],
              life: p[5],
            }
          : p,
      );
    }
  }

  interpolateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      enemy.animTimer = (enemy.animTimer || 0) + dt;
      if (enemy.targetX !== undefined && enemy.targetY !== undefined) {
        const dx = enemy.targetX - enemy.x;
        const dy = enemy.targetY - enemy.y;
        if (dx * dx + dy * dy > 4096) {
          enemy.x = enemy.targetX;
          enemy.y = enemy.targetY;
        } else {
          enemy.x += dx * Math.min(1, dt * 15);
          enemy.y += dy * Math.min(1, dt * 15);
        }
      }
    }
  }

  update(dt: number, players: Player[]): void {
    const livingPlayers = this.getLivingPlayers(players);

    for (let enemy of this.enemies) {
      enemy.animTimer = (enemy.animTimer || 0) + dt;

      if (enemy.type === ENEMY_TYPES.FLITZER) {
        updateFlitzer(this.tileMap, enemy, dt);

        if (Math.random() < 0.35 && this.tileMap && this.tileMap.addSparkles) {
          this.tileMap.addSparkles(
            enemy.x + 10 + (Math.random() * 6 - 3),
            enemy.y + 10 + (Math.random() * 6 - 3),
            "#ff0055",
            1,
          );
        }
      } else if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
        const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
        updateHomingMissile(this.tileMap, enemy, dt, targetPlayer);
      } else if (enemy.type === ENEMY_TYPES.TURRET) {
        const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
        updateTurret(enemy, dt, targetPlayer, this.projectiles);
      } else if (enemy.type === ENEMY_TYPES.BOSS) {
        updateBoss(
          this.tileMap,
          enemy,
          dt,
          livingPlayers,
          this.projectiles,
          (e, pl) => this.getClosestPlayer(e, pl),
          (x, y) => this.addHomingMissile(x, y),
          () =>
            this.enemies.some(
              (e) => e.type === ENEMY_TYPES.HOMING_MISSILE && !e.dead,
            ),
        );
      }

      for (const p of livingPlayers) {
        if (this.checkAABB(enemy, p)) {
          p.takeDamage();

          if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
            enemy.dead = true;
            if (this.tileMap && this.tileMap.addSparkles) {
              for (let s = 0; s < 8; s++) {
                this.tileMap.addSparkles(
                  enemy.x + enemy.width / 2 + (Math.random() * 16 - 8),
                  enemy.y + enemy.height / 2 + (Math.random() * 16 - 8),
                  "#ff5500",
                  2,
                );
              }
            }
          }
          break;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => !e.dead);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (Math.random() < 0.3 && this.tileMap && this.tileMap.addSparkles) {
        this.tileMap.addSparkles(p.x, p.y, "#ff0055", 1);
      }

      for (const targetPlayer of livingPlayers) {
        const dx = p.x - (targetPlayer.x + targetPlayer.width / 2);
        const dy = p.y - (targetPlayer.y + targetPlayer.height / 2);
        const hitDist = p.radius + 10;
        if (dx * dx + dy * dy < hitDist * hitDist) {
          targetPlayer.takeDamage();
          p.life = 0;
          break;
        }
      }

      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);
      if (this.tileMap.isSolid(col, row) || p.life <= 0) {
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
      }
    }
  }

  checkAABB(rect1: BoundingBox, rect2: BoundingBox): boolean {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  hasTileCollision(
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    return hasBossTileCollision(this.tileMap, x, y, width, height);
  }

  render(ctx: CanvasRenderingContext2D, player: Player | null = null): void {
    for (let enemy of this.enemies) {
      ctx.save();
      if (enemy.type === ENEMY_TYPES.FLITZER) {
        renderFlitzer(ctx, enemy, player);
      } else if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
        renderHomingMissile(ctx, enemy);
      } else if (enemy.type === ENEMY_TYPES.TURRET) {
        renderTurret(ctx, enemy, player);
      } else if (enemy.type === ENEMY_TYPES.BOSS) {
        renderBoss(ctx, enemy, player);
      }
      ctx.restore();
    }

    for (let p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 85, 0.35)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff0055";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
