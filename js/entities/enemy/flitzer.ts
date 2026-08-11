/* ==========================================================================
   FLITZER ENEMY BEHAVIOR & RENDERING
   ========================================================================== */

import { TILE_SIZE, TileMap } from "../../world/tilemap.js";
import { Player } from "../player.js";
import {
  Enemy,
  FlitzerDirection,
  FLITZER_DIRECTIONS,
  FLITZER_CENTER_EPSILON,
} from "./types.js";

export function getFlitzerDirection(enemy: Enemy): FlitzerDirection {
  const vx = enemy.vx || 0;
  const vy = enemy.vy || 0;

  if (Math.abs(vx) >= Math.abs(vy) && vx !== 0) {
    return { dx: vx > 0 ? 1 : -1, dy: 0 };
  }
  if (vy !== 0) {
    return { dx: 0, dy: vy > 0 ? 1 : -1 };
  }
  return { dx: 1, dy: 0 };
}

export function canFlitzerEnter(tileMap: TileMap, col: number, row: number): boolean {
  // TileMap.isSolid includes ordinary walls, phase bricks, ice, and conveyors.
  return !tileMap.isSolid(col, row);
}

export function chooseFlitzerDirection(
  tileMap: TileMap,
  currentDirection: FlitzerDirection,
  col: number,
  row: number,
): FlitzerDirection {
  const validDirections = FLITZER_DIRECTIONS.filter((direction) =>
    canFlitzerEnter(tileMap, col + direction.dx, row + direction.dy),
  );

  if (validDirections.length === 0) {
    return { dx: 0, dy: 0 };
  }

  const reverseDirection: FlitzerDirection = {
    dx: currentDirection.dx === 0 ? 0 : currentDirection.dx === 1 ? -1 : 1,
    dy: currentDirection.dy === 0 ? 0 : currentDirection.dy === 1 ? -1 : 1,
  };

  const nonReverseDirections = validDirections.filter(
    (direction) =>
      direction.dx !== reverseDirection.dx ||
      direction.dy !== reverseDirection.dy,
  );

  // Only reverse at a dead end. This keeps the FLITZER exploring corridors
  // instead of immediately undoing its previous turn at every junction.
  if (nonReverseDirections.length === 0) {
    return reverseDirection;
  }

  const forwardDirection = nonReverseDirections.find(
    (direction) =>
      direction.dx === currentDirection.dx &&
      direction.dy === currentDirection.dy,
  );
  const turnDirections = nonReverseDirections.filter(
    (direction) =>
      direction.dx !== currentDirection.dx ||
      direction.dy !== currentDirection.dy,
  );

  // Usually keep moving straight, but regularly take a valid turn so the
  // enemy circulates through the maze instead of bouncing on one line.
  if (
    forwardDirection &&
    (turnDirections.length === 0 || Math.random() >= 0.55)
  ) {
    return forwardDirection;
  }

  const choices =
    turnDirections.length > 0 ? turnDirections : nonReverseDirections;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function updateFlitzer(
  tileMap: TileMap,
  enemy: Enemy,
  dt: number,
): void {
  const speed = Math.max(
    Math.abs(enemy.vx || 0),
    Math.abs(enemy.vy || 0),
    enemy.speed || 0,
    100,
  );
  let direction = getFlitzerDirection(enemy);
  let remainingDistance = Math.max(0, speed * dt);

  // A loop is used instead of a single position update so a large frame
  // cannot skip across a tile centre and enter a solid tile.
  const maxSegments = Math.ceil(remainingDistance / TILE_SIZE) + 4;
  for (
    let segment = 0;
    segment < maxSegments && remainingDistance > FLITZER_CENTER_EPSILON;
    segment++
  ) {
    const centerX = enemy.x + enemy.width / 2;
    const centerY = enemy.y + enemy.height / 2;
    const col = Math.floor(centerX / TILE_SIZE);
    const row = Math.floor(centerY / TILE_SIZE);
    const tileCenterX = col * TILE_SIZE + TILE_SIZE / 2;
    const tileCenterY = row * TILE_SIZE + TILE_SIZE / 2;
    const isAtTileCenter =
      Math.abs(centerX - tileCenterX) <= FLITZER_CENTER_EPSILON &&
      Math.abs(centerY - tileCenterY) <= FLITZER_CENTER_EPSILON;

    if (isAtTileCenter) {
      enemy.x = tileCenterX - enemy.width / 2;
      enemy.y = tileCenterY - enemy.height / 2;
      direction = chooseFlitzerDirection(tileMap, direction, col, row);

      if (direction.dx === 0 && direction.dy === 0) {
        enemy.vx = 0;
        enemy.vy = 0;
        return;
      }

      enemy.vx = direction.dx * speed;
      enemy.vy = direction.dy * speed;
    }

    // Keep the enemy centred in the corridor while it moves between
    // tile centres. Its 20 px body therefore fits inside a 32 px tile.
    if (direction.dx !== 0) {
      enemy.y = tileCenterY - enemy.height / 2;
    } else {
      enemy.x = tileCenterX - enemy.width / 2;
    }

    const updatedCenterX = enemy.x + enemy.width / 2;
    const updatedCenterY = enemy.y + enemy.height / 2;
    let targetCenterX = updatedCenterX;
    let targetCenterY = updatedCenterY;

    if (direction.dx > 0) {
      targetCenterX =
        isAtTileCenter || updatedCenterX >= tileCenterX
          ? tileCenterX + TILE_SIZE
          : tileCenterX;
    } else if (direction.dx < 0) {
      targetCenterX =
        isAtTileCenter || updatedCenterX <= tileCenterX
          ? tileCenterX - TILE_SIZE
          : tileCenterX;
    } else if (direction.dy > 0) {
      targetCenterY =
        isAtTileCenter || updatedCenterY >= tileCenterY
          ? tileCenterY + TILE_SIZE
          : tileCenterY;
    } else if (direction.dy < 0) {
      targetCenterY =
        isAtTileCenter || updatedCenterY <= tileCenterY
          ? tileCenterY - TILE_SIZE
          : tileCenterY;
    }

    const distanceToTarget =
      direction.dx !== 0
        ? Math.abs(targetCenterX - updatedCenterX)
        : Math.abs(targetCenterY - updatedCenterY);
    const moveDistance = Math.min(remainingDistance, distanceToTarget);

    enemy.x += direction.dx * moveDistance;
    enemy.y += direction.dy * moveDistance;
    remainingDistance -= moveDistance;

    if (moveDistance + FLITZER_CENTER_EPSILON < distanceToTarget) {
      break;
    }

    enemy.x = targetCenterX - enemy.width / 2;
    enemy.y = targetCenterY - enemy.height / 2;
  }
}

export function renderFlitzer(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  player: Player | null,
): void {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height / 2;
  const moveAngle = Math.atan2(enemy.vy || 0, enemy.vx || 0);
  const animTimer = enemy.animTimer || 0;

  const auraRad = 15 + Math.sin(animTimer * 10) * 3;
  const auraGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, auraRad);
  auraGrad.addColorStop(0, "rgba(255, 0, 85, 0.85)");
  auraGrad.addColorStop(0.5, "rgba(180, 0, 50, 0.4)");
  auraGrad.addColorStop(1, "rgba(100, 0, 30, 0)");
  ctx.fillStyle = auraGrad;

  ctx.beginPath();
  ctx.arc(cx, cy, auraRad, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);

  const spikeCount = 8;
  const rotAngle = animTimer * 4;
  ctx.save();
  ctx.rotate(rotAngle);
  for (let i = 0; i < spikeCount; i++) {
    const a = (i * Math.PI * 2) / spikeCount;
    const spikeLen = 13 + Math.sin(animTimer * 12 + i * 1.5) * 3;
    const innerR = 6;

    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.3) * innerR, Math.sin(a - 0.3) * innerR);
    ctx.lineTo(Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
    ctx.lineTo(Math.cos(a + 0.3) * innerR, Math.sin(a + 0.3) * innerR);

    ctx.fillStyle = "#ff0033";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();

  const hullGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 9);
  hullGrad.addColorStop(0, "#3a0614");
  hullGrad.addColorStop(0.7, "#150208");
  hullGrad.addColorStop(1, "#050002");
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ff0055";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const jawOpen = Math.sin(animTimer * 14) * 2;
  ctx.fillStyle = "#ffeef2";
  ctx.beginPath();
  ctx.moveTo(-4, 4);
  ctx.lineTo(-2.5, 8.5 + jawOpen);
  ctx.lineTo(-1, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1, 4);
  ctx.lineTo(2.5, 8.5 + jawOpen);
  ctx.lineTo(4, 4);
  ctx.fill();

  let eyeAngle = moveAngle;
  if (player && !player.isDead) {
    eyeAngle = Math.atan2(
      player.y + player.height / 2 - cy,
      player.x + player.width / 2 - cx,
    );
  }
  const eyeDx = Math.cos(eyeAngle) * 2.2;
  const eyeDy = Math.sin(eyeAngle) * 2.2;

  ctx.fillStyle = "#ff0033";
  ctx.beginPath();
  ctx.arc(-3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffee00";
  ctx.beginPath();
  ctx.arc(-3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff0033";
  ctx.beginPath();
  ctx.arc(3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffee00";
  ctx.beginPath();
  ctx.arc(3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  if (Math.random() < 0.45) {
    const sparkAngle = Math.random() * Math.PI * 2;
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(sparkAngle) * 4, Math.sin(sparkAngle) * 4);
    ctx.lineTo(Math.cos(sparkAngle) * 14, Math.sin(sparkAngle) * 14);
    ctx.stroke();
  }
}
