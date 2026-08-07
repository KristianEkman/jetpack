/* ==========================================================================
   PLAYER PHYSICS & MOVEMENT SIMULATION
   ========================================================================== */

import { TILE_SIZE, TILES } from "../../shared/constants.js";
import { SerializedInputState } from "../../shared/types.js";
import { EnemyManager } from "../enemy/index.js";
import type { Player } from "./playerClass.js";

export function simulateMovement(
  player: Player,
  dt: number,
  input: SerializedInputState,
  enemyManager: EnemyManager | null = null,
  playerTargets: Iterable<Player> | null = null,
): void {
  if (player.isDead || !input) return;

  player.phaseCooldown = Math.max(0, player.phaseCooldown - dt);
  player.phaseBeamTimer = Math.max(0, player.phaseBeamTimer - dt);
  player.teleportCooldown = Math.max(0, player.teleportCooldown - dt);
  player.isPhasing = player.phaseBeamTimer > 0;

  const centerCol = Math.floor((player.x + player.width / 2) / TILE_SIZE);
  const centerRow = Math.floor((player.y + player.height / 2) / TILE_SIZE);
  const feetRow = Math.floor((player.y + player.height + 1) / TILE_SIZE);

  const feetTile = player.tileMap.getTile(centerCol, feetRow);
  const onLadder = player.tileMap.isClimbable(centerCol, centerRow);
  const onIce = feetTile === TILES.ICE;

  const accel = onIce ? 400 : 1200;
  const friction = onIce ? 0.96 : 0.82;
  const maxSpeed = 200;

  if (input.left) {
    player.vx -= accel * dt;
    player.facingRight = false;
  } else if (input.right) {
    player.vx += accel * dt;
    player.facingRight = true;
  } else {
    player.vx *= friction;
  }

  player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

  if (onLadder && (input.up || input.down)) {
    player.isClimbing = true;
  }
  if (!onLadder) {
    player.isClimbing = false;
  }

  if (player.isClimbing) {
    player.vy = 0;
    if (input.up) player.vy = -140;
    if (input.down) player.vy = 140;
    if (!player.isGrounded) {
      player.vx *= 0.5;
    }
  }

  if (input.thrust && player.fuel > 0) {
    player.isClimbing = false;
    player.isThrusting = true;
    player.vy -= 1400 * dt;
    player.fuel = Math.max(0, player.fuel - player.fuelBurnRate * dt);
  } else {
    player.isThrusting = false;
  }

  if (!player.isClimbing && !player.isGrounded) {
    player.vy += 950 * dt;
  }
  player.vy = Math.min(450, player.vy);

  if (input.phase && player.phaseCooldown <= 0) {
    player.performPhaseBeam(enemyManager, playerTargets);
  }

  moveAndCollide(player, dt);
}

export function moveAndCollide(player: Player, dt: number): void {
  const CORNER_NUDGE_SLOP = 8;
  const FOOT_INSET = 5;

  player.x += player.vx * dt;
  let colLeft = Math.floor(player.x / TILE_SIZE);
  let colRight = Math.floor((player.x + player.width) / TILE_SIZE);
  let rowTop = Math.floor(player.y / TILE_SIZE);
  let rowBottom = Math.floor((player.y + player.height - 1) / TILE_SIZE);

  if (player.vx < 0) {
    const solidTop = player.tileMap.isSolid(colLeft, rowTop);
    const solidBottom = player.tileMap.isSolid(colLeft, rowBottom);

    if (solidTop && !solidBottom) {
      const overlapTop = (rowTop + 1) * TILE_SIZE - player.y;
      if (overlapTop <= CORNER_NUDGE_SLOP) {
        const newY = player.y + overlapTop;
        const newRowBottom = Math.floor((newY + player.height - 1) / TILE_SIZE);
        if (!player.tileMap.isSolid(colLeft, newRowBottom)) {
          player.y = newY;
          player.vy = Math.max(0, player.vy);
          rowTop = Math.floor(player.y / TILE_SIZE);
          rowBottom = newRowBottom;
        }
      }
    } else if (!solidTop && solidBottom) {
      const overlapBottom = player.y + player.height - rowBottom * TILE_SIZE;
      if (overlapBottom <= CORNER_NUDGE_SLOP) {
        const newY = player.y - overlapBottom;
        const newRowTop = Math.floor(newY / TILE_SIZE);
        if (!player.tileMap.isSolid(colLeft, newRowTop)) {
          player.y = newY;
          rowTop = newRowTop;
          rowBottom = Math.floor((player.y + player.height - 1) / TILE_SIZE);
        }
      }
    }

    if (
      player.tileMap.isSolid(colLeft, rowTop) ||
      player.tileMap.isSolid(colLeft, rowBottom)
    ) {
      player.x = (colLeft + 1) * TILE_SIZE;
      player.vx = 0;
    }
  } else if (player.vx > 0) {
    const solidTop = player.tileMap.isSolid(colRight, rowTop);
    const solidBottom = player.tileMap.isSolid(colRight, rowBottom);

    if (solidTop && !solidBottom) {
      const overlapTop = (rowTop + 1) * TILE_SIZE - player.y;
      if (overlapTop <= CORNER_NUDGE_SLOP) {
        const newY = player.y + overlapTop;
        const newRowBottom = Math.floor((newY + player.height - 1) / TILE_SIZE);
        if (!player.tileMap.isSolid(colRight, newRowBottom)) {
          player.y = newY;
          player.vy = Math.max(0, player.vy);
          rowTop = Math.floor(player.y / TILE_SIZE);
          rowBottom = newRowBottom;
        }
      }
    } else if (!solidTop && solidBottom) {
      const overlapBottom = player.y + player.height - rowBottom * TILE_SIZE;
      if (overlapBottom <= CORNER_NUDGE_SLOP) {
        const newY = player.y - overlapBottom;
        const newRowTop = Math.floor(newY / TILE_SIZE);
        if (!player.tileMap.isSolid(colRight, newRowTop)) {
          player.y = newY;
          rowTop = newRowTop;
          rowBottom = Math.floor((player.y + player.height - 1) / TILE_SIZE);
        }
      }
    }

    if (
      player.tileMap.isSolid(colRight, rowTop) ||
      player.tileMap.isSolid(colRight, rowBottom)
    ) {
      player.x = colRight * TILE_SIZE - player.width;
      player.vx = 0;
    }
  }

  player.y += player.vy * dt;
  colLeft = Math.floor(player.x / TILE_SIZE);
  colRight = Math.floor((player.x + player.width - 1) / TILE_SIZE);
  rowTop = Math.floor(player.y / TILE_SIZE);
  rowBottom = Math.floor((player.y + player.height) / TILE_SIZE);

  player.isGrounded = false;

  if (player.vy < 0) {
    const solidLeft = player.tileMap.isSolid(colLeft, rowTop);
    const solidRight = player.tileMap.isSolid(colRight, rowTop);

    if (solidLeft && !solidRight) {
      const overlapLeft = (colLeft + 1) * TILE_SIZE - player.x;
      if (overlapLeft <= CORNER_NUDGE_SLOP) {
        const newX = player.x + overlapLeft;
        const newColRight = Math.floor((newX + player.width - 1) / TILE_SIZE);
        if (!player.tileMap.isSolid(newColRight, rowTop)) {
          player.x = newX;
          player.vx = Math.max(0, player.vx);
          colLeft = Math.floor(player.x / TILE_SIZE);
          colRight = newColRight;
        }
      }
    } else if (!solidLeft && solidRight) {
      const overlapRight = player.x + player.width - colRight * TILE_SIZE;
      if (overlapRight <= CORNER_NUDGE_SLOP) {
        const newX = player.x - overlapRight;
        const newColLeft = Math.floor(newX / TILE_SIZE);
        if (!player.tileMap.isSolid(newColLeft, rowTop)) {
          player.x = newX;
          player.vx = Math.min(0, player.vx);
          colLeft = newColLeft;
          colRight = Math.floor((player.x + player.width - 1) / TILE_SIZE);
        }
      }
    }

    if (
      player.tileMap.isSolid(colLeft, rowTop) ||
      player.tileMap.isSolid(colRight, rowTop)
    ) {
      player.y = (rowTop + 1) * TILE_SIZE;
      player.vy = 0;
    }
  } else if (player.vy >= 0) {
    const footLeftCol = Math.floor((player.x + FOOT_INSET) / TILE_SIZE);
    const footRightCol = Math.floor(
      (player.x + player.width - FOOT_INSET) / TILE_SIZE,
    );
    const solidLeft = player.tileMap.isSolid(footLeftCol, rowBottom);
    const solidRight = player.tileMap.isSolid(footRightCol, rowBottom);

    if (solidLeft && !solidRight && player.vx > 0) {
      const overlapLeft =
        (footLeftCol + 1) * TILE_SIZE - (player.x + FOOT_INSET);
      if (overlapLeft <= CORNER_NUDGE_SLOP) {
        const newX = player.x + overlapLeft;
        const newFootLeftCol = Math.floor((newX + FOOT_INSET) / TILE_SIZE);
        if (!player.tileMap.isSolid(newFootLeftCol, rowBottom)) {
          player.x = newX;
          colLeft = Math.floor(player.x / TILE_SIZE);
          colRight = Math.floor((player.x + player.width - 1) / TILE_SIZE);
        }
      }
    } else if (!solidLeft && solidRight && player.vx < 0) {
      const overlapRight =
        player.x + player.width - FOOT_INSET - footRightCol * TILE_SIZE;
      if (overlapRight <= CORNER_NUDGE_SLOP) {
        const newX = player.x - overlapRight;
        const newFootRightCol = Math.floor(
          (newX + player.width - FOOT_INSET) / TILE_SIZE,
        );
        if (!player.tileMap.isSolid(newFootRightCol, rowBottom)) {
          player.x = newX;
          colLeft = Math.floor(player.x / TILE_SIZE);
          colRight = Math.floor((player.x + player.width - 1) / TILE_SIZE);
        }
      }
    }

    const isGroundedLeft = player.tileMap.isSolid(
      Math.floor((player.x + FOOT_INSET) / TILE_SIZE),
      rowBottom,
    );
    const isGroundedRight = player.tileMap.isSolid(
      Math.floor((player.x + player.width - FOOT_INSET) / TILE_SIZE),
      rowBottom,
    );

    if (isGroundedLeft || isGroundedRight) {
      player.y = rowBottom * TILE_SIZE - player.height;
      player.vy = 0;
      player.isGrounded = true;
    }
  }

  const feetTile = player.tileMap.getTile(
    Math.floor((player.x + player.width / 2) / TILE_SIZE),
    rowBottom,
  );
  if (player.isGrounded) {
    if (feetTile === TILES.CONVEYOR_LEFT) player.x -= 120 * dt;
    if (feetTile === TILES.CONVEYOR_RIGHT) player.x += 120 * dt;
  }

  player.x = Math.max(
    0,
    Math.min(player.tileMap.cols * TILE_SIZE - player.width, player.x),
  );
  player.y = Math.max(
    0,
    Math.min(player.tileMap.rows * TILE_SIZE - player.height, player.y),
  );
}
