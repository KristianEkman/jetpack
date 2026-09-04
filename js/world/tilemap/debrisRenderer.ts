/* ====================================================================
 * debrisRenderer.ts — renders DebrisObject[] each frame.
 * Extracted from tileRenderer.ts / renderTileMap.
 * ==================================================================== */

import { DebrisObject } from "./types.js";

export function renderDebris(
  ctx: CanvasRenderingContext2D,
  debris: DebrisObject[],
): void {
  for (const d of debris) {
    const alpha = Math.max(0, Math.min(1, d.life / (d.maxLife || 1)));
    ctx.save();
    ctx.globalAlpha = alpha;

    if (d.type === "shockwave") {
      ctx.strokeStyle = d.color || "#ffd700";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius || 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (d.type === "helmet") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#ecf0f1";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3498db";
      ctx.fillRect(0, -3, 6, 5);
    } else if (d.type === "jetpack_top") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#7f8c8d";
      ctx.fillRect(-3, -4, 6, 8);
      ctx.fillStyle = "#95a5a6";
      ctx.fillRect(-2, -3, 2, 6);
      ctx.strokeStyle = "#34495e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(-1, 2);
      ctx.lineTo(1, 4);
      ctx.lineTo(3, 2);
      ctx.stroke();
    } else if (d.type === "jetpack_bottom") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#7f8c8d";
      ctx.fillRect(-3, -4, 6, 8);
      ctx.fillStyle = "#34495e";
      ctx.fillRect(-2, 4, 4, 3);
    } else if (d.type === "fuel_cell") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 1;
      ctx.strokeRect(-2.5, -2.5, 5, 5);
    } else if (d.type === "nozzle") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#34495e";
      ctx.fillRect(-2, -1.5, 4, 3);
    } else if (d.type === "suit") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#00ffcc";
      ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(-5, -4, 10, 4);
    } else if (d.type === "boot") {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(-3, -1.5, 6, 3);
    }

    ctx.restore();
  }
}
