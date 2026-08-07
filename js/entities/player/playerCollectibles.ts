/* ==========================================================================
   PLAYER COLLECTIBLES & TELEPORTER LOGIC
   ========================================================================== */

import {
  TILE_SIZE,
  TILES,
  GAME_EVENTS,
  PLAYER_PHYSICS,
} from "../../shared/constants.js";
import { TeleporterPad } from "../../world/tilemap.js";
import type { Player } from "./playerClass.js";

export function checkCollectibles(player: Player): void {
  const leftCol = Math.floor(player.x / TILE_SIZE);
  const rightCol = Math.floor((player.x + player.width) / TILE_SIZE);
  const topRow = Math.floor(player.y / TILE_SIZE);
  const bottomRow = Math.floor((player.y + player.height - 1) / TILE_SIZE);

  for (let col = leftCol; col <= rightCol; col++) {
    for (let row = topRow; row <= bottomRow; row++) {
      const tile = player.tileMap.getTile(col, row);

      if (tile === TILES.EMERALD) {
        player.tileMap.setTile(col, row, TILES.AIR);
        player.tileMap.collectedEmeralds++;
        player.addScore(250);
        const isAllCaught =
          player.tileMap.collectedEmeralds === 4 ||
          (player.tileMap.totalEmeralds > 0 &&
            player.tileMap.collectedEmeralds === player.tileMap.totalEmeralds);
        if (isAllCaught) {
          player.audio?.playAllDiamondsCaught?.();
          player.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#00e5ff",
            25,
          );
          player.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#00ff77",
            25,
          );
          player.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ffd700",
            20,
          );
        } else {
          player.audio?.playEmeraldPickup?.();
          player.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#00e5ff",
            12,
          );
          player.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#00ff77",
            10,
          );
        }
        player.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
          col,
          row,
          tileType: tile,
          playerId: player.id,
          collectedEmeralds: player.tileMap.collectedEmeralds,
          totalEmeralds: player.tileMap.totalEmeralds,
          isAllCaught,
        });
      } else if (tile === TILES.FUEL) {
        player.tileMap.setTile(col, row, TILES.AIR);
        player.fuel = Math.min(player.maxFuel, player.fuel + 50);
        player.addScore(50);
        player.audio?.playFuelPickup?.();
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#ffaa00",
          14,
        );
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#ffee55",
          10,
        );
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#ffffff",
          6,
        );
        player.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
          col,
          row,
          tileType: tile,
          playerId: player.id,
          collectedEmeralds: player.tileMap.collectedEmeralds,
          totalEmeralds: player.tileMap.totalEmeralds,
          fuel: player.fuel,
        });
      } else if (tile === TILES.GOLD) {
        player.tileMap.setTile(col, row, TILES.AIR);
        player.addScore(500);
        player.audio?.playEmeraldPickup?.();
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#f1c40f",
          10,
        );
        player.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
          col,
          row,
          tileType: tile,
          playerId: player.id,
          collectedEmeralds: player.tileMap.collectedEmeralds,
          totalEmeralds: player.tileMap.totalEmeralds,
          score: player.score,
        });
      } else if (tile === TILES.EXTRA_LIFE) {
        player.tileMap.setTile(col, row, TILES.AIR);
        player.lives = Math.min(PLAYER_PHYSICS.MAX_LIVES, player.lives + 1);
        player.addScore(1000);
        player.audio?.playExtraLifePickup?.();
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#ff2d55",
          15,
        );
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#ff88a5",
          12,
        );
        player.tileMap.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#ffffff",
          8,
        );
        player.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
          col,
          row,
          tileType: tile,
          playerId: player.id,
          collectedEmeralds: player.tileMap.collectedEmeralds,
          totalEmeralds: player.tileMap.totalEmeralds,
          lives: player.lives,
          score: player.score,
        });
      }
    }
  }
}

export function addScore(player: Player, points: number): void {
  const oldScore = player.score;
  player.score += points;
  const milestone = PLAYER_PHYSICS.SCORE_PER_EXTRA_LIFE;
  if (milestone > 0) {
    const oldMilestones = Math.floor(oldScore / milestone);
    const newMilestones = Math.floor(player.score / milestone);
    if (newMilestones > oldMilestones) {
      const extraLivesToAdd = newMilestones - oldMilestones;
      const prevLives = player.lives;
      player.lives = Math.min(PLAYER_PHYSICS.MAX_LIVES, player.lives + extraLivesToAdd);
      if (player.lives > prevLives) {
        player.audio?.playExtraLifePickup?.();
        player.tileMap?.addSparkles?.(
          player.x + player.width / 2,
          player.y + player.height / 2,
          "#ff2d55",
          20,
        );
        player.tileMap?.addSparkles?.(
          player.x + player.width / 2,
          player.y + player.height / 2,
          "#ffffff",
          15,
        );
      }
    }
  }
}

export function checkTeleporter(player: Player): void {
  if (player.teleportCooldown > 0) return;
  if (!player.tileMap.teleporters || player.tileMap.teleporters.length < 2)
    return;

  const leftCol = Math.floor(player.x / TILE_SIZE);
  const rightCol = Math.floor((player.x + player.width) / TILE_SIZE);
  const topRow = Math.floor(player.y / TILE_SIZE);
  const bottomRow = Math.floor((player.y + player.height + 2) / TILE_SIZE);

  for (let col = leftCol; col <= rightCol; col++) {
    for (let row = topRow; row <= bottomRow; row++) {
      const tile = player.tileMap.getTile(col, row);
      if (tile === TILES.TELEPORTER) {
        const tileIndex = row * player.tileMap.cols + col;
        const currentPadIdx = player.tileMap.teleporters.findIndex(
          (pad: TeleporterPad) => pad.tiles.includes(tileIndex),
        );

        if (currentPadIdx !== -1) {
          const nextPadIdx =
            (currentPadIdx + 1) % player.tileMap.teleporters.length;
          const targetPad = player.tileMap.teleporters[nextPadIdx];

          const startX = player.x + player.width / 2;
          const startY = player.y + player.height / 2;

          player.tileMap.addSparkles(startX, startY, "#9b59b6", 22);
          player.tileMap.addSparkles(startX, startY, "#00cec9", 18);

          player.x = targetPad.x + (TILE_SIZE - player.width) / 2;
          player.y = targetPad.y + (TILE_SIZE - player.height) / 2;
          player.vy = Math.min(0, player.vy);

          const destX = player.x + player.width / 2;
          const destY = player.y + player.height / 2;

          player.tileMap.addSparkles(destX, destY, "#a29bfe", 22);
          player.tileMap.addSparkles(destX, destY, "#ffffff", 18);

          player.audio?.playTeleport?.();

          player.teleportCooldown = 0.6;
          return;
        }
      }
    }
  }
}
