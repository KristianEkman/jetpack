/* ==========================================================================
   PROJECTILE SIMULATION (per-weapon movement, collision & detonation)
   ========================================================================== */

import { TILE_SIZE, TILES, WEAPON_TYPES, WEAPON_SPECS } from "../../../shared/constants.js";
import { isPointInBox } from "../../../shared/collision.js";
import { EnemyManager } from "../../enemy/index.js";
import { PlayerProjectile } from "../../../shared/types.js";
import {
  damageEnemyAndScore,
  hitPlayerTarget,
  isValidPvPTarget,
} from "./combatUtils.js";
import { detonateGrenade, detonateMissile } from "./blasts.js";
import type { Player } from "../playerClass.js";
import type { TileMap } from "../../../world/tilemap.js";

interface ProjectileContext {
  player: Player;
  tileMap: TileMap | null;
  enemyManager: EnemyManager | null;
  targets: Player[];
}

export function updatePlayerProjectiles(
  player: Player,
  dt: number,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): void {
  if (!player.projectiles || player.projectiles.length === 0) return;

  const ctx: ProjectileContext = {
    player,
    tileMap: player.tileMap,
    enemyManager,
    targets: playerTargets ? Array.from(playerTargets) : [],
  };

  for (let i = player.projectiles.length - 1; i >= 0; i--) {
    const proj = player.projectiles[i];
    proj.life -= dt;

    if (proj.life <= 0) {
      if (proj.type === WEAPON_TYPES.PLASMA_GRENADE) {
        detonateGrenade(proj, player, enemyManager, ctx.targets);
      } else if (proj.type === WEAPON_TYPES.SEEKER_MISSILE) {
        detonateMissile(proj, player, enemyManager, ctx.targets);
      }
      player.projectiles.splice(i, 1);
      continue;
    }

    if (proj.type === WEAPON_TYPES.SPREAD_CANNON) {
      if (updateSpreadProjectile(ctx, proj, dt)) player.projectiles.splice(i, 1);
    } else if (proj.type === WEAPON_TYPES.PLASMA_GRENADE) {
      if (updateGrenadeProjectile(ctx, proj, dt)) player.projectiles.splice(i, 1);
    } else if (proj.type === WEAPON_TYPES.SEEKER_MISSILE) {
      if (updateMissileProjectile(ctx, proj, dt)) player.projectiles.splice(i, 1);
    }
  }
}

// Each updater returns true when the projectile should be removed.
function updateSpreadProjectile(
  ctx: ProjectileContext,
  proj: PlayerProjectile,
  dt: number,
): boolean {
  const { player, tileMap, enemyManager, targets } = ctx;

  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;

  const col = Math.floor(proj.x / TILE_SIZE);
  const row = Math.floor(proj.y / TILE_SIZE);

  if (tileMap) {
    if (tileMap.getTile(col, row) === TILES.PHASE_BRICK) {
      player.audio?.playPhaseImpact?.();
      tileMap.phaseTile(col, row);
      tileMap.addSparkles?.(proj.x, proj.y, "#ff00dd", 10);
      return true;
    } else if (tileMap.isSolid(col, row)) {
      tileMap.addSparkles?.(proj.x, proj.y, "#ff00dd", 6);
      return true;
    }
  }

  // Check PvP collision
  for (const target of targets) {
    if (!isValidPvPTarget(player, target)) continue;
    if (isPointInBox(proj.x, proj.y, target)) {
      hitPlayerTarget(player, target);
      tileMap?.addSparkles?.(proj.x, proj.y, "#ff00dd", 12);
      return true;
    }
  }

  // Check Enemy collision
  if (enemyManager && enemyManager.enemies) {
    for (let eIdx = enemyManager.enemies.length - 1; eIdx >= 0; eIdx--) {
      const enemy = enemyManager.enemies[eIdx];
      if (enemy.dead) continue;
      if (isPointInBox(proj.x, proj.y, enemy)) {
        const wasDestroyed = damageEnemyAndScore(
          player,
          enemyManager,
          enemy,
          proj.damage,
        );

        if (wasDestroyed) {
          player.audio?.playExplosion?.();
        }
        tileMap?.addSparkles?.(proj.x, proj.y, "#ff00dd", 14);
        return true;
      }
    }
  }

  return false;
}

function updateGrenadeProjectile(
  ctx: ProjectileContext,
  proj: PlayerProjectile,
  dt: number,
): boolean {
  const { player, tileMap, enemyManager, targets } = ctx;
  const spec = WEAPON_SPECS[WEAPON_TYPES.PLASMA_GRENADE];

  proj.vy += spec.gravity * dt;
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  proj.rotation = (proj.rotation || 0) + proj.vx * dt * 0.05;

  // Trail sparkles
  if (Math.random() < 0.35 && tileMap?.addSparkles) {
    tileMap.addSparkles(proj.x, proj.y, "#00ff66", 2);
  }

  const col = Math.floor(proj.x / TILE_SIZE);
  const row = Math.floor(proj.y / TILE_SIZE);

  if (tileMap) {
    if (tileMap.getTile(col, row) === TILES.PHASE_BRICK) {
      // Direct hit on phase brick detonates immediately!
      detonateGrenade(proj, player, enemyManager, targets);
      return true;
    } else if (tileMap.isSolid(col, row)) {
      // Bounce off walls/floor
      if (proj.bounces && proj.bounces > 0) {
        proj.bounces--;
        proj.vy = -proj.vy * spec.bounceDamping;
        proj.vx = proj.vx * 0.8;
        proj.y += proj.vy * dt;
        tileMap.addSparkles?.(proj.x, proj.y, "#00ff66", 4);
      } else {
        detonateGrenade(proj, player, enemyManager, targets);
        return true;
      }
    }
  }

  // Check direct contact with enemy -> immediate detonation
  if (enemyManager && enemyManager.enemies) {
    let hit = false;
    for (const enemy of enemyManager.enemies) {
      if (!enemy.dead && isPointInBox(proj.x, proj.y, enemy)) {
        hit = true;
        break;
      }
    }
    if (hit) {
      detonateGrenade(proj, player, enemyManager, targets);
      return true;
    }
  }

  return false;
}

function updateMissileProjectile(
  ctx: ProjectileContext,
  proj: PlayerProjectile,
  dt: number,
): boolean {
  const { player, tileMap, enemyManager, targets } = ctx;
  const spec = WEAPON_SPECS[WEAPON_TYPES.SEEKER_MISSILE];

  steerMissileTowardsTarget(ctx, proj, dt, spec);

  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;

  // Exhaust smoke & flame trail particles
  proj.trailTimer = (proj.trailTimer || 0) + dt;
  if (proj.trailTimer >= 0.04) {
    proj.trailTimer = 0;
    const backX = proj.x - Math.cos(proj.rotation || 0) * 8;
    const backY = proj.y - Math.sin(proj.rotation || 0) * 8;
    tileMap?.addSparkles?.(backX, backY, "#ff6600", 2);
    if (Math.random() < 0.4) {
      tileMap?.addSparkles?.(backX, backY, "#888888", 1);
    }
  }

  const col = Math.floor(proj.x / TILE_SIZE);
  const row = Math.floor(proj.y / TILE_SIZE);

  if (tileMap) {
    if (tileMap.getTile(col, row) === TILES.PHASE_BRICK) {
      tileMap.phaseTile(col, row);
      detonateMissile(proj, player, enemyManager, targets);
      return true;
    } else if (tileMap.isSolid(col, row)) {
      detonateMissile(proj, player, enemyManager, targets);
      return true;
    }
  }

  // Check PvP collision
  for (const target of targets) {
    if (!isValidPvPTarget(player, target)) continue;
    if (isPointInBox(proj.x, proj.y, target)) {
      detonateMissile(proj, player, enemyManager, targets);
      return true;
    }
  }

  // Check Enemy collision
  if (enemyManager && enemyManager.enemies) {
    for (const enemy of enemyManager.enemies) {
      if (!enemy.dead && isPointInBox(proj.x, proj.y, enemy)) {
        detonateMissile(proj, player, enemyManager, targets);
        return true;
      }
    }
  }

  return false;
}

// Homing guidance: track the locked target, re-acquire if lost, steer limited by turn rate.
function steerMissileTowardsTarget(
  ctx: ProjectileContext,
  proj: PlayerProjectile,
  dt: number,
  spec: (typeof WEAPON_SPECS)[typeof WEAPON_TYPES.SEEKER_MISSILE],
): void {
  const { enemyManager, targets } = ctx;

  let targetX: number | null = null;
  let targetY: number | null = null;

  if (proj.targetId && enemyManager) {
    const enemy = enemyManager.enemies.find(
      (e) => e.id === proj.targetId && !e.dead,
    );
    if (enemy) {
      targetX = enemy.x + enemy.width / 2;
      targetY = enemy.y + enemy.height / 2;
    }
  }

  if (targetX === null && proj.targetId && targets.length > 0) {
    const targetPlayer = targets.find((p) => p.id === proj.targetId && !p.isDead);
    if (targetPlayer) {
      targetX = targetPlayer.x + targetPlayer.width / 2;
      targetY = targetPlayer.y + targetPlayer.height / 2;
    }
  }

  // If current target lost, re-acquire closest enemy
  if (targetX === null && enemyManager && enemyManager.enemies) {
    let closestDistSq = 400 * 400;
    for (const enemy of enemyManager.enemies) {
      if (enemy.dead) continue;
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const dx = ex - proj.x;
      const dy = ey - proj.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        targetX = ex;
        targetY = ey;
        proj.targetId = enemy.id;
      }
    }
  }

  if (targetX === null || targetY === null) return;

  const desiredAngle = Math.atan2(targetY - proj.y, targetX - proj.x);
  let currentAngle = Math.atan2(proj.vy, proj.vx);
  let angleDiff = desiredAngle - currentAngle;

  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const maxTurn = spec.turnRate * dt;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
  currentAngle += turn;

  const currentSpeed = Math.hypot(proj.vx, proj.vy);
  const newSpeed = Math.min(spec.maxSpeed, currentSpeed + spec.acceleration * dt);

  proj.vx = Math.cos(currentAngle) * newSpeed;
  proj.vy = Math.sin(currentAngle) * newSpeed;
  proj.rotation = currentAngle;
}
