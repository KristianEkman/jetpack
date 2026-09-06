/* ==========================================================================
   PHASE BEAM (hitscan weapon & phasing state)
   ========================================================================== */

import {
  TILE_SIZE,
  TILES,
  PLAYER_PHYSICS,
} from "../../../shared/constants.js";
import { isPointInBox, getCenterTile } from "../../../shared/collision.js";
import { EnemyManager } from "../../enemy/index.js";
import {
  damageEnemyAndScore,
  hitPlayerTarget,
  isValidPvPTarget,
} from "./combatUtils.js";
import type { Player } from "../playerClass.js";

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
        if (!isValidPvPTarget(player, target)) continue;
        if (isPointInBox(targetX, startY, target)) {
          if (hitPlayerTarget(player, target)) {
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
        const wasDestroyed = damageEnemyAndScore(player, enemyManager, enemy, 1);

        if (wasDestroyed) {
          player.audio?.playExplosion?.();
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
