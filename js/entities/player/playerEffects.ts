/* ==========================================================================
   PLAYER LOCAL EFFECTS & AUDIO PROCESSING
   ========================================================================== */

import { TILE_SIZE, TILES, PLAYER_PHYSICS } from "../../shared/constants.js";
import { SerializedInputState } from "../../shared/types.js";
import { EnemyManager, ENEMY_TYPES } from "../enemy/index.js";
import type { Player } from "./playerClass.js";

export function processLocalEffects(
  player: Player,
  dt: number,
  input: SerializedInputState,
  enemyManager: EnemyManager | null,
): void {
  if (player.isDead || !input) return;

  if (input.suicide) {
    player.takeDamage();
    return;
  }

  const centerCol = Math.floor((player.x + player.width / 2) / TILE_SIZE);
  const centerRow = Math.floor((player.y + player.height / 2) / TILE_SIZE);
  const feetRow = Math.floor((player.y + player.height + 1) / TILE_SIZE);

  const currentTile = player.tileMap.getTile(centerCol, centerRow);
  const feetTile = player.tileMap.getTile(centerCol, feetRow);

  if (currentTile === TILES.SPIKE || feetTile === TILES.SPIKE) {
    player.audio?.stopEnergyDrain?.();
    player.takeDamage();
    return;
  }
  if (currentTile === TILES.ENERGY_DRAIN || feetTile === TILES.ENERGY_DRAIN) {
    player.fuel = Math.max(0, player.fuel - 40 * dt);
    player.audio?.startEnergyDrain?.();
    if (Math.random() < 0.3) {
      const px = player.x + Math.random() * player.width;
      const py = player.y + Math.random() * player.height;
      player.tileMap.addSparkles(px, py, "#ff0055", 1);
    }
  } else {
    player.audio?.stopEnergyDrain?.();
  }

  if (input.thrust && player.fuel > 0) {
    player.isThrusting = true;
    player.audio?.startThrust?.();
    const px = player.facingRight ? player.x + 2 : player.x + player.width - 2;
    const py = player.y + player.height - 4;
    player.tileMap.addSparkles(px, py, "#ff6600", 2);
  } else {
    player.isThrusting = false;
    player.audio?.stopThrust?.();
  }

  if (
    input.phase &&
    player.phaseCooldown >= PLAYER_PHYSICS.PHASE_COOLDOWN_TIME - 0.01
  ) {
    player.setPhasing(true);
    const startX = player.facingRight ? player.x + player.width : player.x;
    const startY = player.y + 12;
    player.tileMap.addSparkles(startX, startY, "#00f0ff", 6);

    const dir = player.facingRight ? 1 : -1;
    for (let dist = 0; dist <= 160; dist += 8) {
      const targetX = startX + dir * dist;
      const targetCol = Math.floor(targetX / TILE_SIZE);
      const targetRow = Math.floor(startY / TILE_SIZE);

      const t = player.tileMap.getTile(targetCol, targetRow);
      if (t === TILES.PHASE_BRICK || player.tileMap.isSolid(targetCol, targetRow)) {
        break;
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
          player.tileMap.addSparkles(
            enemy.x + enemy.width / 2,
            enemy.y + enemy.height / 2,
            "#ff0055",
            25,
          );

          const wasDestroyed = enemyManager.damageEnemy
            ? enemyManager.damageEnemy(enemy.id, 1, player.id)
            : !!enemyManager.removeEnemyById(enemy.id);

          if (wasDestroyed) {
            player.audio?.playExplosion?.();
            player.addScore(isBoss ? 5000 : 200);
          }
          break;
        }
      }
    }
  }

  player.checkCollectibles();
  player.checkTeleporter();
  player.checkStuck(dt);
}
