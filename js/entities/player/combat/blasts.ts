/* ==========================================================================
   BLAST DETONATIONS (plasma grenade & seeker missile area damage)
   ========================================================================== */

import { TILE_SIZE, TILES } from "../../../shared/constants.js";
import { EnemyManager } from "../../enemy/index.js";
import { PlayerProjectile } from "../../../shared/types.js";
import {
  damageEnemiesInBlast,
  damagePlayersInBlast,
} from "./combatUtils.js";
import type { Player } from "../playerClass.js";

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
  damageEnemiesInBlast(player, enemyManager, proj.x, proj.y, blastRadius, proj.damage);

  // 3. Damage PvP players in blast radius
  damagePlayersInBlast(player, playerTargets, proj.x, proj.y, blastRadius);
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

  // Damage enemies in blast radius (slightly forgiving radius vs PvP)
  damageEnemiesInBlast(player, enemyManager, proj.x, proj.y, blastRadius + 10, proj.damage);

  // Damage PvP players in blast radius
  damagePlayersInBlast(player, playerTargets, proj.x, proj.y, blastRadius);
}
