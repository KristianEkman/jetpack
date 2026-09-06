/* ==========================================================================
   COMBAT SHARED HELPERS (ammo, cooldowns, damage & blast resolution)
   ========================================================================== */

import { COMPETE_SCORE_PER_HIT, WEAPON_SPECS } from "../../../shared/constants.js";
import { distanceSqToBox } from "../../../shared/collision.js";
import { EnemyManager, ENEMY_TYPES } from "../../enemy/index.js";
import type { Enemy } from "../../enemy/index.js";
import type { Player } from "../playerClass.js";

let nextProjectileId = 1;

export function createProjectileId(): string {
  return `proj_${nextProjectileId++}`;
}

// Consumes one unit of ammo and applies the (rapid-fire aware) cooldown.
// Returns false when the weapon is out of ammo (caller falls back to phase beam).
export function consumeAmmoAndApplyCooldown(
  player: Player,
  weaponType: keyof Player["weaponAmmo"],
): boolean {
  if ((player.weaponAmmo[weaponType] || 0) <= 0) return false;
  player.weaponAmmo[weaponType]--;

  const spec = WEAPON_SPECS[weaponType];
  const isRapid = player.rapidFireTimer > 0;
  player.weaponCooldown = isRapid ? spec.rapidCooldown : spec.cooldown;
  player.phaseCooldown = player.weaponCooldown;
  return true;
}

// Damages an enemy; awards destruction score to the player. Returns true if destroyed.
export function damageEnemyAndScore(
  player: Player,
  enemyManager: EnemyManager,
  enemy: Enemy,
  damage: number,
): boolean {
  const isBoss = enemy.type === ENEMY_TYPES.BOSS;
  const wasDestroyed = enemyManager.damageEnemy
    ? enemyManager.damageEnemy(enemy.id, damage, player.id)
    : !!enemyManager.removeEnemyById(enemy.id);

  if (wasDestroyed) {
    player.addScore(isBoss ? 5000 : 200);
  }
  return wasDestroyed;
}

// Applies PvP damage to one target; awards compete score on a life lost.
// Returns true if the hit actually damaged the target.
export function hitPlayerTarget(player: Player, target: Player): boolean {
  const livesBefore = target.lives;
  target.takeDamage();
  if (target.lives < livesBefore) {
    player.addScore(COMPETE_SCORE_PER_HIT);
    return true;
  }
  return false;
}

export function isValidPvPTarget(player: Player, target: Player): boolean {
  return (
    target !== player && !target.isDead && target.respawnInvulnerability <= 0
  );
}

// Damages all living enemies within `radius` of (x, y); awards destruction scores.
export function damageEnemiesInBlast(
  player: Player,
  enemyManager: EnemyManager | null,
  x: number,
  y: number,
  radius: number,
  damage: number,
): void {
  if (!enemyManager || !enemyManager.enemies) return;
  for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
    const enemy = enemyManager.enemies[i];
    if (enemy.dead) continue;
    const distSq = distanceSqToBox(x, y, enemy);

    if (distSq <= radius * radius) {
      damageEnemyAndScore(player, enemyManager, enemy, damage);
    }
  }
}

// Damages all valid PvP targets whose center is within `radius` of (x, y).
export function damagePlayersInBlast(
  player: Player,
  playerTargets: Player[],
  x: number,
  y: number,
  radius: number,
): void {
  for (const target of playerTargets) {
    if (!isValidPvPTarget(player, target)) continue;
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const distSq = (tx - x) * (tx - x) + (ty - y) * (ty - y);

    if (distSq <= radius * radius) {
      hitPlayerTarget(player, target);
    }
  }
}
