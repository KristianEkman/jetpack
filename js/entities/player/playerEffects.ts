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



  player.checkCollectibles();
  player.checkTeleporter();
  player.checkStuck(dt);
}
