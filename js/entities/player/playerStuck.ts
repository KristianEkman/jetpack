/* ==========================================================================
   PLAYER STUCK & NO-FUEL PATHFINDING LOGIC
   ========================================================================== */

import { TILE_SIZE, TILES } from "../../shared/constants.js";
import { EnemyManager } from "../enemy/index.js";
import type { Player } from "./playerClass.js";

export function checkStuck(
  player: Player,
  dt: number,
  enemyManager?: EnemyManager | null,
): void {
  if (player.isDead) {
    player.stuckTimer = 0;
    player.isStuck = false;
    return;
  }

  if (player.fuel >= 1.0 || player.isThrusting) {
    player.stuckTimer = 0;
    player.isStuck = false;
    return;
  }

  if (!player.isGrounded && !player.isClimbing && Math.abs(player.vy) > 15) {
    player.stuckTimer = 0;
    player.isStuck = false;
    return;
  }

  const startCol = Math.floor((player.x + player.width / 2) / TILE_SIZE);
  const startRow = Math.floor((player.y + player.height - 4) / TILE_SIZE);

  let canEscape = false;
  const queue: Array<{ col: number; row: number }> = [
    { col: startCol, row: startRow },
  ];
  const visited = new Set<string>();
  visited.add(`${startCol},${startRow}`);

  let steps = 0;
  const maxSteps = 150;

  while (queue.length > 0 && steps < maxSteps) {
    steps++;
    const { col, row } = queue.shift()!;
    const tile = player.tileMap.getTile(col, row);

    if (tile === TILES.FUEL) {
      canEscape = true;
      break;
    }

    if (tile === TILES.TELEPORTER) {
      canEscape = true;
      break;
    }

    if (
      tile === TILES.EXIT_PORTAL &&
      player.tileMap.isExitUnlocked(enemyManager)
    ) {
      canEscape = true;
      break;
    }

    if (tile === TILES.PHASE_BRICK) {
      canEscape = true;
      break;
    }

    const isCurrentClimbable = player.tileMap.isClimbable(col, row);

    const upRow = row - 1;
    if (upRow >= 0) {
      const isUpClimbable = player.tileMap.isClimbable(col, upRow);
      if (
        (isCurrentClimbable || isUpClimbable) &&
        !player.tileMap.isSolid(col, upRow)
      ) {
        const key = `${col},${upRow}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ col, row: upRow });
        }
      }
    }

    const downRow = row + 1;
    if (downRow < player.tileMap.rows) {
      if (!player.tileMap.isSolid(col, downRow)) {
        let fallRow = downRow;
        while (
          fallRow < player.tileMap.rows - 1 &&
          !player.tileMap.isSolid(col, fallRow + 1) &&
          !player.tileMap.isClimbable(col, fallRow)
        ) {
          fallRow++;
        }
        const key = `${col},${fallRow}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ col, row: fallRow });
        }
      }
    }

    for (const dc of [-1, 1]) {
      const nextCol = col + dc;
      if (nextCol < 0 || nextCol >= player.tileMap.cols) continue;

      if (player.tileMap.isSolid(nextCol, row)) {
        if (player.tileMap.getTile(nextCol, row) === TILES.PHASE_BRICK) {
          canEscape = true;
          break;
        }
        continue;
      }

      let walkRow = row;
      if (
        !player.tileMap.isSolid(nextCol, walkRow + 1) &&
        !player.tileMap.isClimbable(nextCol, walkRow)
      ) {
        while (
          walkRow < player.tileMap.rows - 1 &&
          !player.tileMap.isSolid(nextCol, walkRow + 1) &&
          !player.tileMap.isClimbable(nextCol, walkRow)
        ) {
          walkRow++;
        }
      }

      const key = `${nextCol},${walkRow}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ col: nextCol, row: walkRow });
      }
    }

    if (canEscape) break;
  }

  if (!canEscape) {
    player.stuckTimer += dt;
    player.isStuck = true;
    if (Math.random() < 0.5) {
      player.tileMap.addSparkles(player.x + 11, player.y + 14, "#ff0055", 4);
    }
  } else {
    player.stuckTimer = 0;
    player.isStuck = false;
  }
}
