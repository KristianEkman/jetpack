/* ==========================================================================
   WEAPON FIRING (dispatcher + spread cannon, plasma grenade, seeker missile)
   ========================================================================== */

import { WEAPON_TYPES, WEAPON_SPECS } from "../../../shared/constants.js";
import { EnemyManager } from "../../enemy/index.js";
import {
  consumeAmmoAndApplyCooldown,
  createProjectileId,
  isValidPvPTarget,
} from "./combatUtils.js";
import { performPhaseBeam } from "./phaseBeam.js";
import type { Player } from "../playerClass.js";

export function fireActiveWeapon(
  player: Player,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (player.weaponCooldown > 0 && player.phaseCooldown > 0) return null;

  // Auto-fallback if ammo is 0 for special weapons
  if (
    player.activeWeapon !== WEAPON_TYPES.PHASE_BEAM &&
    (player.weaponAmmo[player.activeWeapon] || 0) <= 0
  ) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
  }

  switch (player.activeWeapon) {
    case WEAPON_TYPES.SPREAD_CANNON:
      return performSpreadShot(player, enemyManager, playerTargets);
    case WEAPON_TYPES.PLASMA_GRENADE:
      return performPlasmaGrenade(player, enemyManager, playerTargets);
    case WEAPON_TYPES.SEEKER_MISSILE:
      return performSeekerMissile(player, enemyManager, playerTargets);
    case WEAPON_TYPES.PHASE_BEAM:
    default:
      return performPhaseBeam(player, enemyManager, playerTargets);
  }
}

export function performSpreadShot(
  player: Player,
  _enemyManager: EnemyManager | null = null,
  _playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (!consumeAmmoAndApplyCooldown(player, WEAPON_TYPES.SPREAD_CANNON)) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
    return performPhaseBeam(player, _enemyManager, _playerTargets);
  }

  const spec = WEAPON_SPECS[WEAPON_TYPES.SPREAD_CANNON];
  const dir = player.facingRight ? 1 : -1;
  const startX = player.facingRight ? player.x + player.width + 2 : player.x - 2;
  const startY = player.y + 12;

  player.audio?.playSpreadShotSound?.();

  // Spawns 3 divergent projectiles (center, up angle, down angle)
  const angles = [0, -spec.spreadAngle, spec.spreadAngle];
  for (const angle of angles) {
    const vx = Math.cos(angle) * spec.speed * dir;
    const vy = Math.sin(angle) * spec.speed;

    player.projectiles.push({
      id: createProjectileId(),
      ownerId: player.id,
      type: WEAPON_TYPES.SPREAD_CANNON,
      x: startX,
      y: startY,
      vx,
      vy,
      radius: 4,
      life: spec.lifetime,
      maxLife: spec.lifetime,
      damage: spec.damage,
      rotation: Math.atan2(vy, vx),
    });
  }

  if (player.tileMap?.addSparkles) {
    player.tileMap.addSparkles(startX, startY, spec.color, 8);
  }

  return null;
}

export function performPlasmaGrenade(
  player: Player,
  _enemyManager: EnemyManager | null = null,
  _playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (!consumeAmmoAndApplyCooldown(player, WEAPON_TYPES.PLASMA_GRENADE)) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
    return performPhaseBeam(player, _enemyManager, _playerTargets);
  }

  const spec = WEAPON_SPECS[WEAPON_TYPES.PLASMA_GRENADE];
  const dir = player.facingRight ? 1 : -1;
  const startX = player.facingRight ? player.x + player.width + 4 : player.x - 4;
  const startY = player.y + 10;

  player.audio?.playGrenadeLaunchSound?.();

  const launchVx = dir * spec.launchSpeedX + player.vx * 0.25;
  const launchVy = spec.launchSpeedY + Math.min(0, player.vy * 0.2);

  player.projectiles.push({
    id: createProjectileId(),
    ownerId: player.id,
    type: WEAPON_TYPES.PLASMA_GRENADE,
    x: startX,
    y: startY,
    vx: launchVx,
    vy: launchVy,
    radius: 6,
    life: spec.fuseTime,
    maxLife: spec.fuseTime,
    damage: spec.damage,
    blastRadius: spec.blastRadius,
    bounces: 4,
    rotation: 0,
  });

  if (player.tileMap?.addSparkles) {
    player.tileMap.addSparkles(startX, startY, spec.color, 10);
  }

  return null;
}

export function performSeekerMissile(
  player: Player,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (!consumeAmmoAndApplyCooldown(player, WEAPON_TYPES.SEEKER_MISSILE)) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
    return performPhaseBeam(player, enemyManager, playerTargets);
  }

  const spec = WEAPON_SPECS[WEAPON_TYPES.SEEKER_MISSILE];
  const dir = player.facingRight ? 1 : -1;
  const startX = player.facingRight ? player.x + player.width + 4 : player.x - 4;
  const startY = player.y + 14;

  player.audio?.playMissileLaunchSound?.();

  const bestTargetId = acquireSeekerTarget(
    player,
    enemyManager,
    playerTargets,
    startX,
    startY,
    dir,
  );

  const initialVx = dir * spec.initialSpeed;
  const initialVy = (Math.random() - 0.5) * 40;

  player.projectiles.push({
    id: createProjectileId(),
    ownerId: player.id,
    type: WEAPON_TYPES.SEEKER_MISSILE,
    x: startX,
    y: startY,
    vx: initialVx,
    vy: initialVy,
    radius: 5,
    life: spec.lifetime,
    maxLife: spec.lifetime,
    damage: spec.damage,
    blastRadius: spec.blastRadius,
    targetId: bestTargetId,
    rotation: Math.atan2(initialVy, initialVx),
    trailTimer: 0,
  });

  if (player.tileMap?.addSparkles) {
    player.tileMap.addSparkles(startX, startY, "#ffaa00", 8);
    player.tileMap.addSparkles(startX, startY, "#ffffff", 4);
  }

  return null;
}

// Finds the closest valid enemy (preferred) or PvP player target within range.
function acquireSeekerTarget(
  player: Player,
  enemyManager: EnemyManager | null,
  playerTargets: Iterable<Player> | null,
  startX: number,
  startY: number,
  dir: number,
): string | null {
  let bestTargetId: string | null = null;
  let closestDistSq = 480 * 480;

  if (enemyManager && enemyManager.enemies) {
    for (const enemy of enemyManager.enemies) {
      if (enemy.dead) continue;
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const dx = ex - startX;
      const dy = ey - startY;
      // Prefer targets in the direction player is facing, but allow any in range
      const facingBonus = dx * dir > 0 ? 1.0 : 2.5;
      const distSq = (dx * dx + dy * dy) * facingBonus;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        bestTargetId = enemy.id;
      }
    }
  }

  if (!bestTargetId && playerTargets) {
    for (const target of playerTargets) {
      if (!isValidPvPTarget(player, target)) continue;
      const tx = target.x + target.width / 2;
      const ty = target.y + target.height / 2;
      const dx = tx - startX;
      const dy = ty - startY;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        bestTargetId = target.id;
      }
    }
  }

  return bestTargetId;
}
