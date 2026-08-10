/* ==========================================================================
   PLAYER COMBAT & PHASE BEAM LOGIC
   ========================================================================== */

import {
  TILE_SIZE,
  TILES,
  PLAYER_PHYSICS,
  COMPETE_SCORE_PER_HIT,
} from "../../shared/constants.js";
import { EnemyManager, ENEMY_TYPES } from "../enemy/index.js";
import type { Player } from "./playerClass.js";

export function performPhaseBeam(
  player: Player,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): Player | null {
  if (!player.tileMap) return null;

  setPhasing(player, true);
  player.phaseBeamTimer = player.rapidFireTimer > 0 ? 0.08 : 0.14;
  player.phaseCooldown =
    player.rapidFireTimer > 0
      ? PLAYER_PHYSICS.RAPID_FIRE_COOLDOWN
      : PLAYER_PHYSICS.PHASE_COOLDOWN_TIME;

  const playerCol = Math.floor((player.x + player.width / 2) / TILE_SIZE);
  const playerRow = Math.floor((player.y + player.height / 2) / TILE_SIZE);
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

    const t = player.tileMap.getTile(targetCol, targetRow);
    if (t === TILES.PHASE_BRICK) {
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
        if (
          targetX >= target.x &&
          targetX <= target.x + target.width &&
          startY >= target.y &&
          startY <= target.y + target.height
        ) {
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
        if (
          targetX >= enemy.x &&
          targetX <= enemy.x + enemy.width &&
          startY >= enemy.y &&
          startY <= enemy.y + enemy.height
        ) {
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
