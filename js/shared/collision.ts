/* ==========================================================================
   SHARED COLLISION & SPATIAL MATH UTILITIES
   ========================================================================== */

import { TILE_SIZE } from "./constants.js";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Axis-Aligned Bounding Box (AABB) overlap check.
 */
export function checkAABB(rect1: BoundingBox, rect2: BoundingBox): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/**
 * Checks if a 2D point lies within an AABB box.
 */
export function isPointInBox(
  px: number,
  py: number,
  box: BoundingBox,
): boolean {
  return (
    px >= box.x &&
    px <= box.x + box.width &&
    py >= box.y &&
    py <= box.y + box.height
  );
}

/**
 * Squared distance from a point to the closest point on an AABB box.
 * Returns 0 when the point is inside the box. Prefer this over center
 * distance for blast checks so large entities are hit by edge detonations.
 */
export function distanceSqToBox(
  px: number,
  py: number,
  box: BoundingBox,
): number {
  const closestX = Math.max(box.x, Math.min(px, box.x + box.width));
  const closestY = Math.max(box.y, Math.min(py, box.y + box.height));
  const dx = px - closestX;
  const dy = py - closestY;
  return dx * dx + dy * dy;
}

/**
 * Computes the column and row index for an entity's center point.
 */
export function getCenterTile(
  entity: BoundingBox,
  tileSize: number = TILE_SIZE,
): { col: number; row: number } {
  return {
    col: Math.floor((entity.x + entity.width / 2) / tileSize),
    row: Math.floor((entity.y + entity.height / 2) / tileSize),
  };
}

/**
 * Computes the bounding tile range (inclusive) spanned by an entity.
 */
export function getTileBounds(
  entity: BoundingBox,
  tileSize: number = TILE_SIZE,
): { leftCol: number; rightCol: number; topRow: number; bottomRow: number } {
  return {
    leftCol: Math.floor(entity.x / tileSize),
    rightCol: Math.floor((entity.x + entity.width - 1) / tileSize),
    topRow: Math.floor(entity.y / tileSize),
    bottomRow: Math.floor((entity.y + entity.height - 1) / tileSize),
  };
}
