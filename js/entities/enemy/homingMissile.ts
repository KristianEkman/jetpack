/* ==========================================================================
   HOMING MISSILE BEHAVIOR & RENDERING
   ========================================================================== */

import { TileMap } from "../../world/tilemap.js";
import { Player } from "../player.js";
import { Enemy } from "./types.js";

export function updateHomingMissile(
  tileMap: TileMap,
  enemy: Enemy,
  dt: number,
  targetPlayer: Player | null,
): void {
  if (targetPlayer) {
    const dx =
      targetPlayer.x +
      targetPlayer.width / 2 -
      (enemy.x + enemy.width / 2);
    const dy =
      targetPlayer.y +
      targetPlayer.height / 2 -
      (enemy.y + enemy.height / 2);
    const angle = Math.atan2(dy, dx);

    enemy.vx = Math.cos(angle) * (enemy.speed || 90);
    enemy.vy = Math.sin(angle) * (enemy.speed || 90);
  }

  enemy.x += (enemy.vx || 0) * dt;
  enemy.y += (enemy.vy || 0) * dt;

  if (Math.random() < 0.75 && tileMap && tileMap.addSparkles) {
    const trailColors = ["#ffffff", "#ffee00", "#ff5500", "#ff0033"];
    const col = trailColors[Math.floor(Math.random() * trailColors.length)];
    tileMap.addSparkles(
      enemy.x + enemy.width / 2 - (enemy.vx || 0) * 0.06,
      enemy.y + enemy.height / 2 - (enemy.vy || 0) * 0.06,
      col,
      1,
    );
  }
}

export function renderHomingMissile(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
): void {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height / 2;
  const angle = Math.atan2(enemy.vy || 0, enemy.vx || 0);

  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const pulse = (Math.sin(Date.now() / 80) + 1) / 2;

  // Thruster jet flame
  const flameLen = 14 + Math.random() * 10;
  const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
  flameGrad.addColorStop(0, "#ffffff");
  flameGrad.addColorStop(0.25, "#ffee00");
  flameGrad.addColorStop(0.65, "#ff4400");
  flameGrad.addColorStop(1, "rgba(255, 0, 0, 0)");
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.lineTo(-8 - flameLen, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();

  // Hot inner core
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(-10 - Math.random() * 4, 0);
  ctx.lineTo(-6, 2);
  ctx.closePath();
  ctx.fill();

  // Glowing aura & high-contrast white outer outline
  ctx.save();
  ctx.shadowColor = "#ff2200";
  ctx.shadowBlur = 12 + pulse * 6;

  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(4, -7);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-8, 6);
  ctx.lineTo(4, 7);
  ctx.closePath();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-5, -3);
  ctx.moveTo(-2, 5);
  ctx.lineTo(-8, 11);
  ctx.lineTo(-5, 3);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();

  // Main body: vibrant rocket gradient
  const bodyGrad = ctx.createLinearGradient(-8, -6, 12, 6);
  bodyGrad.addColorStop(0, "#ff2200");
  bodyGrad.addColorStop(0.5, "#ff5500");
  bodyGrad.addColorStop(1, "#ffcc00");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(4, -6);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-8, 5);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.fill();

  // Hazard stripes for extra readability
  ctx.fillStyle = "#ffee00";
  ctx.fillRect(-2, -5, 4, 10);
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, -5, 2, 10);

  // Inner dark border
  ctx.strokeStyle = "#880000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(4, -6);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-8, 5);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.stroke();

  // Vibrant red fins
  ctx.fillStyle = "#ff0033";
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-5, -3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, 5);
  ctx.lineTo(-8, 10);
  ctx.lineTo(-5, 3);
  ctx.closePath();
  ctx.fill();

  // Fin accent border
  ctx.strokeStyle = "#ffee00";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(-8, -10);
  ctx.moveTo(-2, 5);
  ctx.lineTo(-8, 10);
  ctx.stroke();

  // Pulsing warning beacon tip
  ctx.fillStyle = "#ff0000";
  ctx.beginPath();
  ctx.arc(5, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const beaconRad = 4 + pulse * 3.5;
  ctx.fillStyle = `rgba(255, 230, 0, ${0.4 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(8, 0, beaconRad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pulse > 0.5 ? "#ffffff" : "#ffff00";
  ctx.beginPath();
  ctx.arc(8, 0, 2, 0, Math.PI * 2);
  ctx.fill();
}
