/* ====================================================================
 * tileRenderer.ts — renders structural, hazard, enemy, and portal tiles,
 * plus the full tilemap orchestration function.
 *
 * Pickup / collectible tiles are handled by pickupRenderer.ts.
 * Debris object rendering is handled by debrisRenderer.ts.
 * ==================================================================== */

import { TILE_SIZE, TILES } from "../../shared/constants.js";
import { ParticleSpec } from "../../shared/types.js";
import { DebrisObject, DissolvedBrick } from "./types.js";
import { renderPickupTile } from "./pickupRenderer.js";
import { renderDebris } from "./debrisRenderer.js";

export function renderTile(
  ctx: CanvasRenderingContext2D,
  tile: number,
  x: number,
  y: number,
  c: number,
  r: number,
  portalAngle: number,
  collectedEmeralds: number,
  totalEmeralds: number,
  hasBoss: boolean = false,
): void {
  switch (tile) {
    case TILES.BRICK:
      ctx.fillStyle = "#8b263e";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#b83b5e";
      ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.fillStyle = "#4a1525";
      ctx.fillRect(x + 2, y + TILE_SIZE / 2, TILE_SIZE - 4, 2);
      ctx.fillRect(x + TILE_SIZE / 2, y + 2, 2, TILE_SIZE / 2 - 2);
      break;

    case TILES.PHASE_BRICK:
      ctx.fillStyle = "rgba(0, 204, 255, 0.4)";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(x + 10, y + 10, TILE_SIZE - 20, TILE_SIZE - 20);
      break;

    case TILES.ICE:
      ctx.fillStyle = "rgba(180, 240, 255, 0.6)";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + TILE_SIZE - 4);
      ctx.lineTo(x + TILE_SIZE - 4, y + 4);
      ctx.stroke();
      break;

    case TILES.CONVEYOR_LEFT:
    case TILES.CONVEYOR_RIGHT:
      ctx.fillStyle = "#34495e";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(x, y + 4, TILE_SIZE, 6);
      ctx.fillStyle = "#f1c40f";
      ctx.font = "12px Orbitron, sans-serif";
      ctx.fillText(tile === TILES.CONVEYOR_LEFT ? "◄" : "►", x + 8, y + 22);
      break;

    case TILES.LADDER:
      ctx.fillStyle = "#d35400";
      ctx.fillRect(x + 4, y, 4, TILE_SIZE);
      ctx.fillRect(x + TILE_SIZE - 8, y, 4, TILE_SIZE);
      ctx.fillRect(x + 4, y + 8, TILE_SIZE - 8, 3);
      ctx.fillRect(x + 4, y + 20, TILE_SIZE - 8, 3);
      break;

    case TILES.VINE:
      ctx.fillStyle = "#27ae60";
      ctx.fillRect(x + 14, y, 4, TILE_SIZE);
      ctx.beginPath();
      ctx.arc(x + 10, y + 10, 4, 0, Math.PI * 2);
      ctx.arc(x + 22, y + 22, 4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case TILES.SPIKE:
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.moveTo(x, y + TILE_SIZE);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x + 16, y + TILE_SIZE);
      ctx.lineTo(x + 24, y);
      ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
      ctx.closePath();
      ctx.fill();
      break;

    case TILES.ENERGY_DRAIN:
      ctx.fillStyle = "rgba(255, 0, 85, 0.35)";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#ff0055";
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = "#ff0055";
      ctx.font = "14px sans-serif";
      ctx.fillText("⚡", x + 8, y + 22);
      break;

    case TILES.SPAWN:
      ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#00ffcc";
      ctx.font = "10px Orbitron, sans-serif";
      ctx.fillText("START", x + 2, y + 20);
      break;

    case TILES.EXIT_PORTAL: {
      const isUnlocked = collectedEmeralds >= totalEmeralds && !hasBoss;
      ctx.save();
      ctx.translate(x + 16, y + 16);
      ctx.rotate(portalAngle);

      ctx.strokeStyle = isUnlocked ? "#00ffcc" : "#7f8c8d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 1.5);
      ctx.stroke();

      ctx.strokeStyle = isUnlocked ? "#ff00ff" : "#95a5a6";
      ctx.beginPath();
      ctx.arc(0, 0, 6, Math.PI * 0.5, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      if (isUnlocked) {
        ctx.fillStyle = "rgba(0, 255, 204, 0.35)";
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#00ffcc";
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case TILES.TELEPORTER: {
      const now = Date.now();
      const pulse = (Math.sin(now / 150) + 1) * 0.5;
      const rot = (now / 350) % (Math.PI * 2);
      const cx = x + 16;
      const cy = y + 16;

      ctx.save();

      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 17 + pulse * 2);
      glow.addColorStop(0, `rgba(155, 89, 182, ${0.5 + pulse * 0.25})`);
      glow.addColorStop(0.6, `rgba(0, 206, 201, ${0.2 + pulse * 0.1})`);
      glow.addColorStop(1, "rgba(142, 68, 173, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 17 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1b0e27";
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      ctx.strokeStyle = "#8e44ad";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      ctx.fillStyle = "#00cec9";
      ctx.fillRect(x + 3, y + 3, 2, 2);
      ctx.fillRect(x + TILE_SIZE - 5, y + 3, 2, 2);
      ctx.fillRect(x + 3, y + TILE_SIZE - 5, 2, 2);
      ctx.fillRect(x + TILE_SIZE - 5, y + TILE_SIZE - 5, 2, 2);

      ctx.translate(cx, cy);
      ctx.rotate(rot);

      ctx.strokeStyle = "#a29bfe";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 1.4);
      ctx.stroke();

      ctx.strokeStyle = "#00cec9";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 5, Math.PI * 0.7, Math.PI * 2.1);
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5 + pulse * 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TILES.ENEMY_FLITZER: {
      const cx = x + 16;
      const cy = y + 16;
      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 85, 0.4)";
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff0033";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#ffee00";
      ctx.fillRect(cx - 5, cy - 3, 3, 3);
      ctx.fillRect(cx + 2, cy - 3, 3, 3);
      ctx.fillStyle = "#ff0055";
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx - 6, cy - 4);
      ctx.lineTo(cx - 6, cy + 4);
      ctx.moveTo(cx + 10, cy);
      ctx.lineTo(cx + 6, cy - 4);
      ctx.lineTo(cx + 6, cy + 4);
      ctx.fill();
      ctx.restore();
      break;
    }

    case TILES.ENEMY_MISSILE: {
      const cx = x + 16;
      const cy = y + 16;
      ctx.save();
      ctx.translate(cx, cy);

      const pulse = (Math.sin(Date.now() / 80) + 1) / 2;

      ctx.save();
      ctx.shadowColor = "#ff2200";
      ctx.shadowBlur = 10 + pulse * 5;

      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -7);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-8, 6);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();

      const bodyGrad = ctx.createLinearGradient(-8, -6, 12, 6);
      bodyGrad.addColorStop(0, "#ff2200");
      bodyGrad.addColorStop(0.5, "#ff5500");
      bodyGrad.addColorStop(1, "#ffcc00");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -6);
      ctx.lineTo(-8, -5);
      ctx.lineTo(-8, 5);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffee00";
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, -5, 2, 10);

      ctx.fillStyle = "#ff0033";
      ctx.fillRect(-8, -9, 4, 4);
      ctx.fillRect(-8, 5, 4, 4);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, -9, 4, 4);
      ctx.strokeRect(-8, 5, 4, 4);

      const flameGrad = ctx.createLinearGradient(-8, 0, -14, 0);
      flameGrad.addColorStop(0, "#ffffff");
      flameGrad.addColorStop(0.4, "#ffee00");
      flameGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-8, 3);
      ctx.fill();

      const beaconRad = 4 + pulse * 2.5;
      ctx.fillStyle = `rgba(255, 230, 0, ${0.4 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(8, 0, beaconRad, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pulse > 0.5 ? "#ffffff" : "#ffff00";
      ctx.beginPath();
      ctx.arc(8, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    case TILES.ENEMY_TURRET: {
      const cx = x + 16;
      const cy = y + 16;
      ctx.save();
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(x + 4, y + 12, 24, 16);
      ctx.strokeStyle = "#485460";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 12, 24, 16);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(x + 6, y + 22, 4, 4);
      ctx.fillRect(x + 14, y + 22, 4, 4);
      ctx.fillRect(x + 22, y + 22, 4, 4);
      ctx.fillStyle = "#0f171e";
      ctx.fillRect(cx - 2, y + 2, 4, 10);
      ctx.fillStyle = "#2c3e50";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#ff0033";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }

    case TILES.ENEMY_BOSS: {
      ctx.save();
      ctx.fillStyle = "#1a252f";
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.strokeStyle = "#ff0033";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      ctx.fillStyle = "#ff0044";
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👾", x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      ctx.restore();
      break;
    }

    // Pickup / collectible tiles — delegated to pickupRenderer.ts
    case TILES.EMERALD:
    case TILES.FUEL:
    case TILES.GOLD:
    case TILES.EXTRA_LIFE:
    case TILES.RAPID_FIRE:
    case TILES.WEAPON_SPREAD:
    case TILES.WEAPON_GRENADE:
    case TILES.WEAPON_MISSILE:
      renderPickupTile(ctx, tile, x, y, c, r);
      break;
  }
}

export function renderTileMap(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  getTileFn: (col: number, row: number) => number,
  dissolvedBricks: DissolvedBrick[],
  particles: ParticleSpec[],
  debris: DebrisObject[],
  portalAngle: number,
  collectedEmeralds: number,
  totalEmeralds: number,
  isEditor: boolean = false,
  hasBoss: boolean = false,
): void {
  ctx.clearRect(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);

  // Draw Background Grid Lines
  ctx.strokeStyle = "rgba(0, 255, 204, 0.04)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(c * TILE_SIZE, 0);
    ctx.lineTo(c * TILE_SIZE, rows * TILE_SIZE);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(0, r * TILE_SIZE);
    ctx.lineTo(cols * TILE_SIZE, r * TILE_SIZE);
  }
  ctx.stroke();

  // Render Tiles
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = getTileFn(c, r);
      if (tile === TILES.AIR) continue;
      if (
        !isEditor &&
        (tile === TILES.ENEMY_FLITZER ||
          tile === TILES.ENEMY_MISSILE ||
          tile === TILES.ENEMY_TURRET ||
          tile === TILES.ENEMY_BOSS)
      )
        continue;

      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      renderTile(
        ctx,
        tile,
        x,
        y,
        c,
        r,
        portalAngle,
        collectedEmeralds,
        totalEmeralds,
        hasBoss,
      );
    }
  }

  // Render Dissolved Phase Bricks Ghost Outlines
  for (const b of dissolvedBricks) {
    const x = b.col * TILE_SIZE;
    const y = b.row * TILE_SIZE;
    ctx.save();
    ctx.strokeStyle = b.timer <= 0.8 ? "#ffcc00" : "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.restore();
  }

  // Render Particles Layer
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Render Debris Objects Layer
  renderDebris(ctx, debris);
}
