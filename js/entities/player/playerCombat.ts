/* ==========================================================================
   PLAYER COMBAT & MULTI-WEAPON ARSENAL LOGIC
   ========================================================================== */

import {
  TILE_SIZE,
  TILES,
  PLAYER_PHYSICS,
  COMPETE_SCORE_PER_HIT,
  WEAPON_TYPES,
  WEAPON_SPECS,
} from "../../shared/constants.js";
import { isPointInBox, getCenterTile } from "../../shared/collision.js";
import { EnemyManager, ENEMY_TYPES } from "../enemy/index.js";
import { PlayerProjectile, WeaponType } from "../../shared/types.js";
import type { Player } from "./playerClass.js";

let nextProjectileId = 1;

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

export function performPhaseBeam(
  player: Player,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (!player.tileMap) return null;

  setPhasing(player, true);
  const isRapid = player.rapidFireTimer > 0;
  player.phaseBeamTimer = isRapid ? 0.08 : 0.14;
  player.phaseCooldown = isRapid
    ? PLAYER_PHYSICS.RAPID_FIRE_COOLDOWN
    : PLAYER_PHYSICS.PHASE_COOLDOWN_TIME;
  player.weaponCooldown = player.phaseCooldown;

  const { col: playerCol, row: playerRow } = getCenterTile(player);
  if (player.tileMap.getTile(playerCol, playerRow) === TILES.PHASE_BRICK) {
    player.tileMap.phaseTile(playerCol, playerRow);
  }

  const dir = player.facingRight ? 1 : -1;
  const startX = player.facingRight ? player.x + player.width : player.x;
  const startY = player.y + 12;
  const targets = playerTargets ? Array.from(playerTargets) : [];

  player.phaseBeamLength = 160;
  for (let dist = 0; dist <= 160; dist += 8) {
    const targetX = startX + dir * dist;
    const targetCol = Math.floor(targetX / TILE_SIZE);
    const targetRow = Math.floor(startY / TILE_SIZE);

    if (player.tileMap.getTile(targetCol, targetRow) === TILES.PHASE_BRICK) {
      if (player.audio?.playPhaseImpact) {
        player.audio.playPhaseImpact();
      } else {
        player.audio?.playExplosion?.();
      }
      player.tileMap.phaseTile(targetCol, targetRow);
      player.phaseBeamLength = dist;
      return null;
    } else if (player.tileMap.isSolid(targetCol, targetRow)) {
      player.phaseBeamLength = dist;
      return null;
    }

    if (targets.length > 0) {
      for (const target of targets) {
        if (
          target === player ||
          target.isDead ||
          target.respawnInvulnerability > 0
        ) {
          continue;
        }
        if (isPointInBox(targetX, startY, target)) {
          const livesBeforeHit = target.lives;
          target.takeDamage();
          if (target.lives < livesBeforeHit) {
            player.addScore(COMPETE_SCORE_PER_HIT);
            player.phaseBeamLength = dist;
            return target;
          }
        }
      }
    }

    if (enemyManager && enemyManager.enemies) {
      let hitEnemyIndex = -1;
      for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
        const enemy = enemyManager.enemies[i];
        if (isPointInBox(targetX, startY, enemy)) {
          hitEnemyIndex = i;
          break;
        }
      }
      if (hitEnemyIndex >= 0) {
        const enemy = enemyManager.enemies[hitEnemyIndex];
        const isBoss = enemy.type === ENEMY_TYPES.BOSS;
        const wasDestroyed = enemyManager.damageEnemy
          ? enemyManager.damageEnemy(enemy.id, 1, player.id)
          : !!enemyManager.removeEnemyById(enemy.id);

        if (wasDestroyed) {
          player.audio?.playExplosion?.();
          player.addScore(isBoss ? 5000 : 200);
        }

        player.phaseBeamLength = dist;
        return null;
      }
    }
  }
  return null;
}

export function performSpreadShot(
  player: Player,
  _enemyManager: EnemyManager | null = null,
  _playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (player.weaponAmmo.spread_cannon <= 0) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
    return performPhaseBeam(player, _enemyManager, _playerTargets);
  }

  player.weaponAmmo.spread_cannon--;
  const isRapid = player.rapidFireTimer > 0;
  const spec = WEAPON_SPECS[WEAPON_TYPES.SPREAD_CANNON];
  player.weaponCooldown = isRapid ? spec.rapidCooldown : spec.cooldown;
  player.phaseCooldown = player.weaponCooldown;

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
      id: `proj_${nextProjectileId++}`,
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
  if (player.weaponAmmo.plasma_grenade <= 0) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
    return performPhaseBeam(player, _enemyManager, _playerTargets);
  }

  player.weaponAmmo.plasma_grenade--;
  const isRapid = player.rapidFireTimer > 0;
  const spec = WEAPON_SPECS[WEAPON_TYPES.PLASMA_GRENADE];
  player.weaponCooldown = isRapid ? spec.rapidCooldown : spec.cooldown;
  player.phaseCooldown = player.weaponCooldown;

  const dir = player.facingRight ? 1 : -1;
  const startX = player.facingRight ? player.x + player.width + 4 : player.x - 4;
  const startY = player.y + 10;

  player.audio?.playGrenadeLaunchSound?.();

  const launchVx = dir * spec.launchSpeedX + player.vx * 0.25;
  const launchVy = spec.launchSpeedY + Math.min(0, player.vy * 0.2);

  player.projectiles.push({
    id: `proj_${nextProjectileId++}`,
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
  if (player.weaponAmmo.seeker_missile <= 0) {
    player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
    return performPhaseBeam(player, enemyManager, playerTargets);
  }

  player.weaponAmmo.seeker_missile--;
  const isRapid = player.rapidFireTimer > 0;
  const spec = WEAPON_SPECS[WEAPON_TYPES.SEEKER_MISSILE];
  player.weaponCooldown = isRapid ? spec.rapidCooldown : spec.cooldown;
  player.phaseCooldown = player.weaponCooldown;

  const dir = player.facingRight ? 1 : -1;
  const startX = player.facingRight ? player.x + player.width + 4 : player.x - 4;
  const startY = player.y + 14;

  player.audio?.playMissileLaunchSound?.();

  // Find closest valid enemy target
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
      const facingBonus = (dx * dir > 0) ? 1.0 : 2.5;
      const distSq = (dx * dx + dy * dy) * facingBonus;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        bestTargetId = enemy.id;
      }
    }
  }

  if (!bestTargetId && playerTargets) {
    for (const target of playerTargets) {
      if (target === player || target.isDead || target.respawnInvulnerability > 0) {
        continue;
      }
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

  const initialVx = dir * spec.initialSpeed;
  const initialVy = (Math.random() - 0.5) * 40;

  player.projectiles.push({
    id: `proj_${nextProjectileId++}`,
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

export function updatePlayerProjectiles(
  player: Player,
  dt: number,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): void {
  if (!player.projectiles || player.projectiles.length === 0) return;

  const tileMap = player.tileMap;
  const targets = playerTargets ? Array.from(playerTargets) : [];

  for (let i = player.projectiles.length - 1; i >= 0; i--) {
    const proj = player.projectiles[i];
    proj.life -= dt;

    if (proj.life <= 0) {
      if (proj.type === WEAPON_TYPES.PLASMA_GRENADE) {
        detonateGrenade(proj, player, enemyManager, targets);
      } else if (proj.type === WEAPON_TYPES.SEEKER_MISSILE) {
        detonateMissile(proj, player, enemyManager, targets);
      }
      player.projectiles.splice(i, 1);
      continue;
    }

    if (proj.type === WEAPON_TYPES.SPREAD_CANNON) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      const col = Math.floor(proj.x / TILE_SIZE);
      const row = Math.floor(proj.y / TILE_SIZE);

      if (tileMap) {
        if (tileMap.getTile(col, row) === TILES.PHASE_BRICK) {
          player.audio?.playPhaseImpact?.();
          tileMap.phaseTile(col, row);
          tileMap.addSparkles?.(proj.x, proj.y, "#ff00dd", 10);
          player.projectiles.splice(i, 1);
          continue;
        } else if (tileMap.isSolid(col, row)) {
          tileMap.addSparkles?.(proj.x, proj.y, "#ff00dd", 6);
          player.projectiles.splice(i, 1);
          continue;
        }
      }

      // Check PvP collision
      let hitPvP = false;
      for (const target of targets) {
        if (target === player || target.isDead || target.respawnInvulnerability > 0) {
          continue;
        }
        if (isPointInBox(proj.x, proj.y, target)) {
          const livesBefore = target.lives;
          target.takeDamage();
          if (target.lives < livesBefore) {
            player.addScore(COMPETE_SCORE_PER_HIT);
          }
          tileMap?.addSparkles?.(proj.x, proj.y, "#ff00dd", 12);
          hitPvP = true;
          break;
        }
      }
      if (hitPvP) {
        player.projectiles.splice(i, 1);
        continue;
      }

      // Check Enemy collision
      if (enemyManager && enemyManager.enemies) {
        let hitEnemy = false;
        for (let eIdx = enemyManager.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = enemyManager.enemies[eIdx];
          if (enemy.dead) continue;
          if (isPointInBox(proj.x, proj.y, enemy)) {
            const isBoss = enemy.type === ENEMY_TYPES.BOSS;
            const wasDestroyed = enemyManager.damageEnemy
              ? enemyManager.damageEnemy(enemy.id, proj.damage, player.id)
              : !!enemyManager.removeEnemyById(enemy.id);

            if (wasDestroyed) {
              player.audio?.playExplosion?.();
              player.addScore(isBoss ? 5000 : 200);
            }
            tileMap?.addSparkles?.(proj.x, proj.y, "#ff00dd", 14);
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) {
          player.projectiles.splice(i, 1);
          continue;
        }
      }
    } else if (proj.type === WEAPON_TYPES.PLASMA_GRENADE) {
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
          player.projectiles.splice(i, 1);
          continue;
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
            player.projectiles.splice(i, 1);
            continue;
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
          player.projectiles.splice(i, 1);
          continue;
        }
      }
    } else if (proj.type === WEAPON_TYPES.SEEKER_MISSILE) {
      const spec = WEAPON_SPECS[WEAPON_TYPES.SEEKER_MISSILE];

      // Homing guidance
      let targetX: number | null = null;
      let targetY: number | null = null;

      if (proj.targetId && enemyManager) {
        const enemy = enemyManager.enemies.find((e) => e.id === proj.targetId && !e.dead);
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

      if (targetX !== null && targetY !== null) {
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
          player.projectiles.splice(i, 1);
          continue;
        } else if (tileMap.isSolid(col, row)) {
          detonateMissile(proj, player, enemyManager, targets);
          player.projectiles.splice(i, 1);
          continue;
        }
      }

      // Check PvP collision
      let hitPvP = false;
      for (const target of targets) {
        if (target === player || target.isDead || target.respawnInvulnerability > 0) {
          continue;
        }
        if (isPointInBox(proj.x, proj.y, target)) {
          detonateMissile(proj, player, enemyManager, targets);
          hitPvP = true;
          break;
        }
      }
      if (hitPvP) {
        player.projectiles.splice(i, 1);
        continue;
      }

      // Check Enemy collision
      if (enemyManager && enemyManager.enemies) {
        let hitEnemy = false;
        for (const enemy of enemyManager.enemies) {
          if (!enemy.dead && isPointInBox(proj.x, proj.y, enemy)) {
            detonateMissile(proj, player, enemyManager, targets);
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) {
          player.projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }
}

export function detonateGrenade(
  proj: PlayerProjectile,
  player: Player,
  enemyManager: EnemyManager | null,
  playerTargets: Player[],
): void {
  const blastRadius = proj.blastRadius || 48;
  const tileMap = player.tileMap;

  player.audio?.playClusterExplosionSound?.();

  if (tileMap?.addSparkles) {
    tileMap.addSparkles(proj.x, proj.y, "#00ff66", 24);
    tileMap.addSparkles(proj.x, proj.y, "#ffff00", 18);
    tileMap.addSparkles(proj.x, proj.y, "#ff3300", 14);
  }

  // 1. Phase/destroy all Phase Bricks within blast radius
  if (tileMap) {
    const minCol = Math.max(0, Math.floor((proj.x - blastRadius) / TILE_SIZE));
    const maxCol = Math.min(tileMap.cols - 1, Math.floor((proj.x + blastRadius) / TILE_SIZE));
    const minRow = Math.max(0, Math.floor((proj.y - blastRadius) / TILE_SIZE));
    const maxRow = Math.min(tileMap.rows - 1, Math.floor((proj.y + blastRadius) / TILE_SIZE));

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        if (tileMap.getTile(c, r) === TILES.PHASE_BRICK) {
          tileMap.phaseTile(c, r);
        }
      }
    }
  }

  // 2. Damage enemies in blast radius
  if (enemyManager && enemyManager.enemies) {
    for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
      const enemy = enemyManager.enemies[i];
      if (enemy.dead) continue;
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const distSq = (ex - proj.x) * (ex - proj.x) + (ey - proj.y) * (ey - proj.y);

      if (distSq <= blastRadius * blastRadius) {
        const isBoss = enemy.type === ENEMY_TYPES.BOSS;
        const wasDestroyed = enemyManager.damageEnemy
          ? enemyManager.damageEnemy(enemy.id, proj.damage, player.id)
          : !!enemyManager.removeEnemyById(enemy.id);

        if (wasDestroyed) {
          player.addScore(isBoss ? 5000 : 200);
        }
      }
    }
  }

  // 3. Damage PvP players in blast radius
  for (const target of playerTargets) {
    if (target === player || target.isDead || target.respawnInvulnerability > 0) {
      continue;
    }
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const distSq = (tx - proj.x) * (tx - proj.x) + (ty - proj.y) * (ty - proj.y);

    if (distSq <= blastRadius * blastRadius) {
      const livesBefore = target.lives;
      target.takeDamage();
      if (target.lives < livesBefore) {
        player.addScore(COMPETE_SCORE_PER_HIT);
      }
    }
  }
}

export function detonateMissile(
  proj: PlayerProjectile,
  player: Player,
  enemyManager: EnemyManager | null,
  playerTargets: Player[],
): void {
  const blastRadius = proj.blastRadius || 24;
  const tileMap = player.tileMap;

  player.audio?.playExplosion?.();

  if (tileMap?.addSparkles) {
    tileMap.addSparkles(proj.x, proj.y, "#ff6600", 20);
    tileMap.addSparkles(proj.x, proj.y, "#ffcc00", 14);
    tileMap.addSparkles(proj.x, proj.y, "#ffffff", 10);
  }

  // Damage enemies in blast radius
  if (enemyManager && enemyManager.enemies) {
    for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
      const enemy = enemyManager.enemies[i];
      if (enemy.dead) continue;
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const distSq = (ex - proj.x) * (ex - proj.x) + (ey - proj.y) * (ey - proj.y);

      if (distSq <= (blastRadius + 10) * (blastRadius + 10)) {
        const isBoss = enemy.type === ENEMY_TYPES.BOSS;
        const wasDestroyed = enemyManager.damageEnemy
          ? enemyManager.damageEnemy(enemy.id, proj.damage, player.id)
          : !!enemyManager.removeEnemyById(enemy.id);

        if (wasDestroyed) {
          player.addScore(isBoss ? 5000 : 200);
        }
      }
    }
  }

  // Damage PvP players in blast radius
  for (const target of playerTargets) {
    if (target === player || target.isDead || target.respawnInvulnerability > 0) {
      continue;
    }
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const distSq = (tx - proj.x) * (tx - proj.x) + (ty - proj.y) * (ty - proj.y);

    if (distSq <= blastRadius * blastRadius) {
      const livesBefore = target.lives;
      target.takeDamage();
      if (target.lives < livesBefore) {
        player.addScore(COMPETE_SCORE_PER_HIT);
      }
    }
  }
}

export function setPhasing(player: Player, isPhasing: boolean): void {
  if (!player.isPhasing && isPhasing) {
    player.audio?.playPhaseSound?.();
    if (player.tileMap) {
      const startX = player.facingRight ? player.x + player.width : player.x;
      const startY = player.y + 12;
      player.tileMap.addSparkles(startX, startY, "#00f0ff", 6);
    }
  }
  player.isPhasing = isPhasing;
}
