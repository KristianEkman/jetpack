/* ==========================================================================
   ENEMY AI MODULE (Flitzers, Homing Missiles, Turrets)
   ========================================================================== */

import { TILE_SIZE, TileMap } from "../world/tilemap.js";
import { Player } from "./player.js";

export const ENEMY_TYPES = {
  FLITZER: "flitzer",
  HOMING_MISSILE: "homing_missile",
  TURRET: "turret",
  BOSS: "boss",
} as const;

type FlitzerDirection = {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
};

const FLITZER_DIRECTIONS: readonly FlitzerDirection[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

const FLITZER_CENTER_EPSILON = 0.01;

export interface Enemy {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx?: number;
  vy?: number;
  speed?: number;
  timer?: number;
  fireInterval?: number;
  animTimer?: number;
  targetX?: number;
  targetY?: number;
  dead?: boolean;
  hp?: number;
  maxHp?: number;
  phase?: number;
  hitFlashTimer?: number;
  attackTimer?: number;
  laserCharging?: boolean;
  laserChargeTimer?: number;
  laserActiveTimer?: number;
  laserX?: number;
  bossName?: string;
  startY?: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
}

export class EnemyManager {
  tileMap: TileMap;
  enemies: Enemy[];
  projectiles: Projectile[];
  nextEnemyId: number;
  onEnemyDestroyed:
    | ((data: { enemyId: string; playerId: string }) => void)
    | null;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
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
    maxHp: number = 25,
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

  damageEnemy(
    enemyId: string,
    damage: number = 1,
    playerId: string = "",
  ): boolean {
    const enemy = this.enemies.find((e) => e.id === enemyId);
    if (!enemy) return false;

    if (enemy.type === ENEMY_TYPES.BOSS || enemy.hp !== undefined) {
      const maxHp = enemy.maxHp || 25;
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
          if (this.tileMap && this.tileMap.addSparkles) {
            for (let s = 0; s < 30; s++) {
              this.tileMap.addSparkles(
                enemy.x + enemy.width / 2 + (Math.random() * 80 - 40),
                enemy.y + enemy.height / 2 + (Math.random() * 60 - 30),
                s % 2 === 0 ? "#ff0055" : "#ffaa00",
                3,
              );
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

  getClosestPlayer(enemy: Enemy, playerInput: Player[]): any {
    if (!playerInput) return null;
    let playersList: any[] = [];
    if (Array.isArray(playerInput)) {
      playersList = playerInput;
    }

    let closest: any = null;
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

  serializeEnemies(): any[] {
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

  serializeProjectiles(): any[] {
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
            sEnemy.maxHp || 25,
            sEnemy.id,
          );
        }
        localEnemy = this.enemies.find((e) => e.id === sEnemy.id);
      }

      if (localEnemy) {
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

  private getFlitzerDirection(enemy: Enemy): FlitzerDirection {
    const vx = enemy.vx || 0;
    const vy = enemy.vy || 0;

    if (Math.abs(vx) >= Math.abs(vy) && vx !== 0) {
      return { dx: vx > 0 ? 1 : -1, dy: 0 };
    }
    if (vy !== 0) {
      return { dx: 0, dy: vy > 0 ? 1 : -1 };
    }
    return { dx: 1, dy: 0 };
  }

  private canFlitzerEnter(col: number, row: number): boolean {
    // TileMap.isSolid includes ordinary walls, phase bricks, ice, and conveyors.
    return !this.tileMap.isSolid(col, row);
  }

  private chooseFlitzerDirection(
    currentDirection: FlitzerDirection,
    col: number,
    row: number,
  ): FlitzerDirection {
    const validDirections = FLITZER_DIRECTIONS.filter((direction) =>
      this.canFlitzerEnter(col + direction.dx, row + direction.dy),
    );

    if (validDirections.length === 0) {
      return { dx: 0, dy: 0 };
    }

    const reverseDirection: FlitzerDirection = {
      dx: currentDirection.dx === 0 ? 0 : currentDirection.dx === 1 ? -1 : 1,
      dy: currentDirection.dy === 0 ? 0 : currentDirection.dy === 1 ? -1 : 1,
    };

    const nonReverseDirections = validDirections.filter(
      (direction) =>
        direction.dx !== reverseDirection.dx ||
        direction.dy !== reverseDirection.dy,
    );

    // Only reverse at a dead end. This keeps the FLITZER exploring corridors
    // instead of immediately undoing its previous turn at every junction.
    if (nonReverseDirections.length === 0) {
      return reverseDirection;
    }

    const forwardDirection = nonReverseDirections.find(
      (direction) =>
        direction.dx === currentDirection.dx &&
        direction.dy === currentDirection.dy,
    );
    const turnDirections = nonReverseDirections.filter(
      (direction) =>
        direction.dx !== currentDirection.dx ||
        direction.dy !== currentDirection.dy,
    );

    // Usually keep moving straight, but regularly take a valid turn so the
    // enemy circulates through the maze instead of bouncing on one line.
    if (
      forwardDirection &&
      (turnDirections.length === 0 || Math.random() >= 0.55)
    ) {
      return forwardDirection;
    }

    const choices =
      turnDirections.length > 0 ? turnDirections : nonReverseDirections;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private updateFlitzer(enemy: Enemy, dt: number): void {
    const speed = Math.max(
      Math.abs(enemy.vx || 0),
      Math.abs(enemy.vy || 0),
      enemy.speed || 0,
      100,
    );
    let direction = this.getFlitzerDirection(enemy);
    let remainingDistance = Math.max(0, speed * dt);

    // A loop is used instead of a single position update so a large frame
    // cannot skip across a tile centre and enter a solid tile.
    const maxSegments = Math.ceil(remainingDistance / TILE_SIZE) + 4;
    for (
      let segment = 0;
      segment < maxSegments && remainingDistance > FLITZER_CENTER_EPSILON;
      segment++
    ) {
      const centerX = enemy.x + enemy.width / 2;
      const centerY = enemy.y + enemy.height / 2;
      const col = Math.floor(centerX / TILE_SIZE);
      const row = Math.floor(centerY / TILE_SIZE);
      const tileCenterX = col * TILE_SIZE + TILE_SIZE / 2;
      const tileCenterY = row * TILE_SIZE + TILE_SIZE / 2;
      const isAtTileCenter =
        Math.abs(centerX - tileCenterX) <= FLITZER_CENTER_EPSILON &&
        Math.abs(centerY - tileCenterY) <= FLITZER_CENTER_EPSILON;

      if (isAtTileCenter) {
        enemy.x = tileCenterX - enemy.width / 2;
        enemy.y = tileCenterY - enemy.height / 2;
        direction = this.chooseFlitzerDirection(direction, col, row);

        if (direction.dx === 0 && direction.dy === 0) {
          enemy.vx = 0;
          enemy.vy = 0;
          return;
        }

        enemy.vx = direction.dx * speed;
        enemy.vy = direction.dy * speed;
      }

      // Keep the enemy centred in the corridor while it moves between
      // tile centres. Its 20 px body therefore fits inside a 32 px tile.
      if (direction.dx !== 0) {
        enemy.y = tileCenterY - enemy.height / 2;
      } else {
        enemy.x = tileCenterX - enemy.width / 2;
      }

      const updatedCenterX = enemy.x + enemy.width / 2;
      const updatedCenterY = enemy.y + enemy.height / 2;
      let targetCenterX = updatedCenterX;
      let targetCenterY = updatedCenterY;

      if (direction.dx > 0) {
        targetCenterX =
          isAtTileCenter || updatedCenterX >= tileCenterX
            ? tileCenterX + TILE_SIZE
            : tileCenterX;
      } else if (direction.dx < 0) {
        targetCenterX =
          isAtTileCenter || updatedCenterX <= tileCenterX
            ? tileCenterX - TILE_SIZE
            : tileCenterX;
      } else if (direction.dy > 0) {
        targetCenterY =
          isAtTileCenter || updatedCenterY >= tileCenterY
            ? tileCenterY + TILE_SIZE
            : tileCenterY;
      } else if (direction.dy < 0) {
        targetCenterY =
          isAtTileCenter || updatedCenterY <= tileCenterY
            ? tileCenterY - TILE_SIZE
            : tileCenterY;
      }

      const distanceToTarget =
        direction.dx !== 0
          ? Math.abs(targetCenterX - updatedCenterX)
          : Math.abs(targetCenterY - updatedCenterY);
      const moveDistance = Math.min(remainingDistance, distanceToTarget);

      enemy.x += direction.dx * moveDistance;
      enemy.y += direction.dy * moveDistance;
      remainingDistance -= moveDistance;

      if (moveDistance + FLITZER_CENTER_EPSILON < distanceToTarget) {
        break;
      }

      enemy.x = targetCenterX - enemy.width / 2;
      enemy.y = targetCenterY - enemy.height / 2;
    }
  }

  update(dt: number, players: Player[]): void {
    const livingPlayers = this.getLivingPlayers(players);

    for (let enemy of this.enemies) {
      enemy.animTimer = (enemy.animTimer || 0) + dt;

      if (enemy.type === ENEMY_TYPES.FLITZER) {
        this.updateFlitzer(enemy, dt);

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
        if (targetPlayer) {
          const dx =
            targetPlayer.x +
            targetPlayer.width / 2 -
            (enemy.x + enemy.width / 2);
          const dy =
            targetPlayer.y +
            targetPlayer.height / 2 -
            (enemy.y + enemy.height / 2);
          const angle = Math.atan2(dy, dx);

          enemy.vx = Math.cos(angle) * (enemy.speed || 90);
          enemy.vy = Math.sin(angle) * (enemy.speed || 90);
        }

        enemy.x += (enemy.vx || 0) * dt;
        enemy.y += (enemy.vy || 0) * dt;

        if (Math.random() < 0.75 && this.tileMap && this.tileMap.addSparkles) {
          const trailColors = ["#ffffff", "#ffee00", "#ff5500", "#ff0033"];
          const col = trailColors[Math.floor(Math.random() * trailColors.length)];
          this.tileMap.addSparkles(
            enemy.x + enemy.width / 2 - (enemy.vx || 0) * 0.06,
            enemy.y + enemy.height / 2 - (enemy.vy || 0) * 0.06,
            col,
            1,
          );
        }
      } else if (enemy.type === ENEMY_TYPES.TURRET) {
        enemy.timer = (enemy.timer || 0) + dt;
        const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
        if (enemy.timer >= (enemy.fireInterval || 2.0) && targetPlayer) {
          enemy.timer = 0;
          const dx =
            targetPlayer.x +
            targetPlayer.width / 2 -
            (enemy.x + enemy.width / 2);
          const dy =
            targetPlayer.y +
            targetPlayer.height / 2 -
            (enemy.y + enemy.height / 2);
          const angle = Math.atan2(dy, dx);

          this.projectiles.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            vx: Math.cos(angle) * 220,
            vy: Math.sin(angle) * 220,
            radius: 5,
            life: 3.5,
          });
        }
      } else if (enemy.type === ENEMY_TYPES.BOSS) {
        this.updateBoss(enemy, dt, livingPlayers);
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
        if (Math.sqrt(dx * dx + dy * dy) < p.radius + 10) {
          targetPlayer.takeDamage();
          p.life = 0;
          break;
        }
      }

      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);
      if (this.tileMap.isSolid(col, row) || p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  checkAABB(rect1: any, rect2: any): boolean {
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
    if (!this.tileMap || typeof this.tileMap.isSolid !== "function")
      return false;
    const minCol = Math.floor(x / TILE_SIZE);
    const maxCol = Math.floor((x + width - 1) / TILE_SIZE);
    const minRow = Math.floor(y / TILE_SIZE);
    const maxRow = Math.floor((y + height - 1) / TILE_SIZE);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (this.tileMap.isSolid(c, r)) {
          return true;
        }
      }
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, player: Player | null = null): void {
    for (let enemy of this.enemies) {
      ctx.save();
      if (enemy.type === ENEMY_TYPES.FLITZER) {
        this.renderFlitzer(ctx, enemy, player);
      } else if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
        this.renderHomingMissile(ctx, enemy);
      } else if (enemy.type === ENEMY_TYPES.TURRET) {
        this.renderTurret(ctx, enemy, player);
      } else if (enemy.type === ENEMY_TYPES.BOSS) {
        this.renderBoss(ctx, enemy, player);
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

  renderFlitzer(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    player: any,
  ): void {
    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height / 2;
    const moveAngle = Math.atan2(enemy.vy || 0, enemy.vx || 0);
    const animTimer = enemy.animTimer || 0;

    const auraRad = 15 + Math.sin(animTimer * 10) * 3;
    const auraGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, auraRad);
    auraGrad.addColorStop(0, "rgba(255, 0, 85, 0.85)");
    auraGrad.addColorStop(0.5, "rgba(180, 0, 50, 0.4)");
    auraGrad.addColorStop(1, "rgba(100, 0, 30, 0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, cy);

    const spikeCount = 8;
    const rotAngle = animTimer * 4;
    ctx.save();
    ctx.rotate(rotAngle);
    for (let i = 0; i < spikeCount; i++) {
      const a = (i * Math.PI * 2) / spikeCount;
      const spikeLen = 13 + Math.sin(animTimer * 12 + i * 1.5) * 3;
      const innerR = 6;

      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.3) * innerR, Math.sin(a - 0.3) * innerR);
      ctx.lineTo(Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
      ctx.lineTo(Math.cos(a + 0.3) * innerR, Math.sin(a + 0.3) * innerR);

      ctx.fillStyle = "#ff0033";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    const hullGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 9);
    hullGrad.addColorStop(0, "#3a0614");
    hullGrad.addColorStop(0.7, "#150208");
    hullGrad.addColorStop(1, "#050002");
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff0055";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const jawOpen = Math.sin(animTimer * 14) * 2;
    ctx.fillStyle = "#ffeef2";
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(-2.5, 8.5 + jawOpen);
    ctx.lineTo(-1, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1, 4);
    ctx.lineTo(2.5, 8.5 + jawOpen);
    ctx.lineTo(4, 4);
    ctx.fill();

    let eyeAngle = moveAngle;
    if (player && !player.isDead) {
      eyeAngle = Math.atan2(
        player.y + player.height / 2 - cy,
        player.x + player.width / 2 - cx,
      );
    }
    const eyeDx = Math.cos(eyeAngle) * 2.2;
    const eyeDy = Math.sin(eyeAngle) * 2.2;

    ctx.fillStyle = "#ff0033";
    ctx.beginPath();
    ctx.arc(-3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffee00";
    ctx.beginPath();
    ctx.arc(-3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff0033";
    ctx.beginPath();
    ctx.arc(3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffee00";
    ctx.beginPath();
    ctx.arc(3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    if (Math.random() < 0.45) {
      const sparkAngle = Math.random() * Math.PI * 2;
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sparkAngle) * 4, Math.sin(sparkAngle) * 4);
      ctx.lineTo(Math.cos(sparkAngle) * 14, Math.sin(sparkAngle) * 14);
      ctx.stroke();
    }
  }

  renderHomingMissile(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height / 2;
    const angle = Math.atan2(enemy.vy || 0, enemy.vx || 0);

    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const pulse = (Math.sin(Date.now() / 80) + 1) / 2;

    // Thruster jet flame
    const flameLen = 14 + Math.random() * 10;
    const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
    flameGrad.addColorStop(0, "#ffffff");
    flameGrad.addColorStop(0.25, "#ffee00");
    flameGrad.addColorStop(0.65, "#ff4400");
    flameGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(-8 - flameLen, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();

    // Hot inner core
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-10 - Math.random() * 4, 0);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fill();

    // Glowing aura & high-contrast white outer outline
    ctx.save();
    ctx.shadowColor = "#ff2200";
    ctx.shadowBlur = 12 + pulse * 6;

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(4, -7);
    ctx.lineTo(-8, -6);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-8, 6);
    ctx.lineTo(4, 7);
    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-5, -3);
    ctx.moveTo(-2, 5);
    ctx.lineTo(-8, 11);
    ctx.lineTo(-5, 3);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();

    // Main body: vibrant rocket gradient
    const bodyGrad = ctx.createLinearGradient(-8, -6, 12, 6);
    bodyGrad.addColorStop(0, "#ff2200");
    bodyGrad.addColorStop(0.5, "#ff5500");
    bodyGrad.addColorStop(1, "#ffcc00");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(4, -6);
    ctx.lineTo(-8, -5);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-8, 5);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fill();

    // Hazard stripes for extra readability
    ctx.fillStyle = "#ffee00";
    ctx.fillRect(-2, -5, 4, 10);
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, -5, 2, 10);

    // Inner dark border
    ctx.strokeStyle = "#880000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(4, -6);
    ctx.lineTo(-8, -5);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-8, 5);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.stroke();

    // Vibrant red fins
    ctx.fillStyle = "#ff0033";
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-5, -3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, 5);
    ctx.lineTo(-8, 10);
    ctx.lineTo(-5, 3);
    ctx.closePath();
    ctx.fill();

    // Fin accent border
    ctx.strokeStyle = "#ffee00";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(-8, -10);
    ctx.moveTo(-2, 5);
    ctx.lineTo(-8, 10);
    ctx.stroke();

    // Pulsing warning beacon tip
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(5, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const beaconRad = 4 + pulse * 3.5;
    ctx.fillStyle = `rgba(255, 230, 0, ${0.4 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(8, 0, beaconRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pulse > 0.5 ? "#ffffff" : "#ffff00";
    ctx.beginPath();
    ctx.arc(8, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  renderTurret(ctx: CanvasRenderingContext2D, enemy: Enemy, player: any): void {
    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height / 2;

    let angle = Math.PI / 2;
    if (player && !player.isDead) {
      angle = Math.atan2(
        player.y + player.height / 2 - cy,
        player.x + player.width / 2 - cx,
      );
    }

    ctx.fillStyle = "#1e272e";
    ctx.fillRect(enemy.x + 2, enemy.y + 10, 20, 14);
    ctx.strokeStyle = "#485460";
    ctx.lineWidth = 1;
    ctx.strokeRect(enemy.x + 2, enemy.y + 10, 20, 14);

    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(enemy.x + 4, enemy.y + 20, 4, 3);
    ctx.fillRect(enemy.x + 10, enemy.y + 20, 4, 3);
    ctx.fillRect(enemy.x + 16, enemy.y + 20, 4, 3);

    if (player && !player.isDead) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 85, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 160, cy + Math.sin(angle) * 160);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.fillStyle = "#0f171e";
    ctx.fillRect(2, -5, 10, 3);
    ctx.fillRect(2, 2, 10, 3);

    ctx.fillStyle = "#ff0044";
    ctx.fillRect(10, -5, 2, 3);
    ctx.fillRect(10, 2, 2, 3);

    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const chargeRatio = Math.min(
      1,
      (enemy.timer || 0) / (enemy.fireInterval || 2.0),
    );
    const glowRad = 2 + chargeRatio * 2;
    ctx.fillStyle = chargeRatio > 0.8 ? "#ffffff" : "#ff0033";
    ctx.beginPath();
    ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
    ctx.fill();
  }

  private updateBoss(
    enemy: Enemy,
    dt: number,
    livingPlayers: Player[],
  ): void {
    enemy.hitFlashTimer = Math.max(0, (enemy.hitFlashTimer || 0) - dt);

    const maxHp = enemy.maxHp || 25;
    const currentHp = enemy.hp !== undefined ? enemy.hp : maxHp;
    if (currentHp <= maxHp / 2) {
      enemy.phase = 2;
    } else {
      enemy.phase = 1;
    }

    const isPhase2 = enemy.phase === 2;
    const speedMult = isPhase2 ? 1.4 : 1.0;
    const currentSpeed = 90 * speedMult;

    if (enemy.vx === undefined || enemy.vx === 0) enemy.vx = currentSpeed;
    if (enemy.vx > 0) enemy.vx = currentSpeed;
    if (enemy.vx < 0) enemy.vx = -currentSpeed;

    const nextX = enemy.x + (enemy.vx || currentSpeed) * dt;
    if (this.hasTileCollision(nextX, enemy.y, enemy.width, enemy.height)) {
      if ((enemy.vx || 0) > 0) {
        enemy.vx = -currentSpeed;
      } else {
        enemy.vx = currentSpeed;
      }
    } else {
      enemy.x = nextX;
    }

    const minX = TILE_SIZE;
    const mapWidth =
      this.tileMap && this.tileMap.cols
        ? this.tileMap.cols * TILE_SIZE
        : 960;
    const maxX = mapWidth - TILE_SIZE - enemy.width;
    if (enemy.x < minX) {
      enemy.x = minX;
      enemy.vx = currentSpeed;
    } else if (enemy.x > maxX) {
      enemy.x = maxX;
      enemy.vx = -currentSpeed;
    }

    const startY = enemy.startY !== undefined ? enemy.startY : enemy.y;
    const nextY =
      startY +
      Math.sin((enemy.animTimer || 0) * (isPhase2 ? 3.5 : 2.0)) * 12;
    if (!this.hasTileCollision(enemy.x, nextY, enemy.width, enemy.height)) {
      enemy.y = nextY;
    }

    if (enemy.laserCharging) {
      enemy.laserChargeTimer = (enemy.laserChargeTimer || 0) - dt;
      if ((enemy.laserChargeTimer || 0) <= 0) {
        enemy.laserCharging = false;
        enemy.laserActiveTimer = 0.7;
      }
    } else if ((enemy.laserActiveTimer || 0) > 0) {
      enemy.laserActiveTimer = (enemy.laserActiveTimer || 0) - dt;
      const beamX = enemy.laserX !== undefined ? enemy.laserX : enemy.x + enemy.width / 2;
      const beamHalfWidth = 18;

      for (const p of livingPlayers) {
        if (
          p.x + p.width >= beamX - beamHalfWidth &&
          p.x <= beamX + beamHalfWidth &&
          p.y + p.height >= enemy.y + enemy.height
        ) {
          p.takeDamage();
        }
      }
    } else {
      enemy.attackTimer = (enemy.attackTimer || 0) + dt;
      const attackInterval = isPhase2 ? 1.5 : 2.2;

      if ((enemy.attackTimer || 0) >= attackInterval) {
        enemy.attackTimer = 0;

        if (isPhase2 && Math.random() < 0.35 && livingPlayers.length > 0) {
          enemy.laserCharging = true;
          enemy.laserChargeTimer = 0.8;
          const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
          enemy.laserX = targetPlayer ? targetPlayer.x + targetPlayer.width / 2 : enemy.x + enemy.width / 2;
        } else {
          const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
          const targetX = targetPlayer ? targetPlayer.x + targetPlayer.width / 2 : enemy.x + enemy.width / 2;
          const targetY = targetPlayer ? targetPlayer.y + targetPlayer.height / 2 : enemy.y + 200;

          if (isPhase2) {
            const cx = enemy.x + enemy.width / 2;
            const cy = enemy.y + enemy.height - 10;
            const baseAngle = Math.atan2(targetY - cy, targetX - cx);
            const angles = [-0.4, -0.2, 0, 0.2, 0.4].map((a) => baseAngle + a);
            for (const angle of angles) {
              this.projectiles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * 220,
                vy: Math.sin(angle) * 220,
                radius: 6,
                life: 3.5,
              });
            }
            if (Math.random() < 0.5) {
              this.addHomingMissile(enemy.x + enemy.width / 2, enemy.y + enemy.height);
            }
          } else {
            for (const wingX of [enemy.x + 12, enemy.x + enemy.width - 12]) {
              const dx = targetX - wingX;
              const dy = targetY - (enemy.y + enemy.height);
              const angle = Math.atan2(dy, dx);
              this.projectiles.push({
                x: wingX,
                y: enemy.y + enemy.height - 5,
                vx: Math.cos(angle) * 200,
                vy: Math.sin(angle) * 200,
                radius: 5,
                life: 4.0,
              });
            }
          }
        }
      }
    }

    if (this.tileMap && this.tileMap.addSparkles) {
      if (isPhase2 && Math.random() < 0.6) {
        this.tileMap.addSparkles(
          enemy.x + Math.random() * enemy.width,
          enemy.y + Math.random() * enemy.height,
          "#ff0033",
          1,
        );
      }
    }
  }

  private renderBoss(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    player: Player | null,
  ): void {
    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height / 2;
    const animTimer = enemy.animTimer || 0;
    const isPhase2 = (enemy.phase || 1) === 2;
    const isHit = (enemy.hitFlashTimer || 0) > 0;

    if (enemy.laserCharging) {
      const laserX = enemy.laserX !== undefined ? enemy.laserX : cx;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 55, 0.65)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(laserX, enemy.y + enemy.height);
      ctx.lineTo(laserX, 576);
      ctx.stroke();

      ctx.strokeStyle = "#ff0055";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(laserX, 540, 16 + Math.sin(animTimer * 20) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if ((enemy.laserActiveTimer || 0) > 0) {
      const laserX = enemy.laserX !== undefined ? enemy.laserX : cx;
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 85, 0.4)";
      ctx.fillRect(laserX - 22, enemy.y + enemy.height, 44, 576);

      ctx.fillStyle = "rgba(255, 100, 150, 0.85)";
      ctx.fillRect(laserX - 12, enemy.y + enemy.height, 24, 576);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(laserX - 4, enemy.y + enemy.height, 8, 576);
      ctx.restore();
    }

    const auraRad = 52 + Math.sin(animTimer * 8) * 6;
    const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraRad);
    if (isHit) {
      auraGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      auraGrad.addColorStop(0.5, "rgba(255, 0, 85, 0.6)");
      auraGrad.addColorStop(1, "rgba(100, 0, 30, 0)");
    } else if (isPhase2) {
      auraGrad.addColorStop(0, "rgba(255, 0, 50, 0.8)");
      auraGrad.addColorStop(0.5, "rgba(180, 0, 30, 0.35)");
      auraGrad.addColorStop(1, "rgba(80, 0, 20, 0)");
    } else {
      auraGrad.addColorStop(0, "rgba(0, 200, 255, 0.6)");
      auraGrad.addColorStop(0.5, "rgba(0, 100, 200, 0.25)");
      auraGrad.addColorStop(1, "rgba(0, 50, 100, 0)");
    }
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = isHit ? "#ffffff" : "#1a252f";
    ctx.strokeStyle = isPhase2 ? "#ff0044" : "#00d2d3";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(-44, 10);
    ctx.lineTo(-38, 28);
    ctx.lineTo(-15, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(44, 10);
    ctx.lineTo(38, 28);
    ctx.lineTo(15, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHit ? "#ffffff" : "#2c3e50";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(30, -12);
    ctx.lineTo(26, 22);
    ctx.lineTo(0, 30);
    ctx.lineTo(-26, 22);
    ctx.lineTo(-30, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isHit ? "#ffffff" : isPhase2 ? "#ff0033" : "#3498db";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.strokeStyle = isPhase2 ? "rgba(255,0,85,0.7)" : "rgba(0,210,211,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.lineTo(0, 5);
    ctx.lineTo(20, -8);
    ctx.stroke();

    const corePulse = Math.sin(animTimer * 12) * 2;
    const coreRad = (isPhase2 ? 14 : 11) + corePulse;
    const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, coreRad);
    if (isPhase2) {
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.4, "#ff0044");
      coreGrad.addColorStop(1, "#800016");
    } else {
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.4, "#00d2d3");
      coreGrad.addColorStop(1, "#004b57");
    }
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();

    let eyeAngle = Math.PI / 2;
    if (player && !player.isDead) {
      eyeAngle = Math.atan2(
        player.y + player.height / 2 - cy,
        player.x + player.width / 2 - cx,
      );
    }
    const eyeEx = Math.cos(eyeAngle) * 4;
    const eyeEy = Math.sin(eyeAngle) * 4;

    ctx.fillStyle = isPhase2 ? "#ffff00" : "#ff0055";
    ctx.beginPath();
    ctx.arc(eyeEx, eyeEy - 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeEx, eyeEy - 12, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const maxHp = enemy.maxHp || 25;
    const currentHp = Math.max(0, enemy.hp !== undefined ? enemy.hp : maxHp);
    const hpRatio = Math.min(1, Math.max(0, currentHp / maxHp));

    const barWidth = 140;
    const barHeight = 12;
    const barX = cx - barWidth / 2;
    const barY = enemy.y - 24;

    ctx.fillStyle = "rgba(10, 15, 25, 0.85)";
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
    ctx.strokeStyle = isPhase2 ? "#ff0044" : "#00d2d3";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    const fillWidth = (barWidth - 2) * hpRatio;
    let hpColor = "#2ecc71";
    if (hpRatio < 0.3) hpColor = "#e74c3c";
    else if (hpRatio < 0.6) hpColor = "#f1c40f";

    const hpGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
    hpGrad.addColorStop(0, hpColor);
    hpGrad.addColorStop(1, "#ffffff");

    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX + 1, barY + 1, fillWidth, barHeight - 2);

    ctx.font = "bold 9px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    const label = `${enemy.bossName || "MECHA CORE ALPHA"} - ${currentHp}/${maxHp}`;
    ctx.fillText(label, cx, barY - 5);
  }
}
