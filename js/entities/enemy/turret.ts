/* ==========================================================================
   TURRET ENEMY BEHAVIOR & RENDERING
   ========================================================================== */

import { Player } from "../player.js";
import { Enemy, Projectile } from "./types.js";

export function updateTurret(
  enemy: Enemy,
  dt: number,
  targetPlayer: Player | null,
  projectiles: Projectile[],
): void {
  enemy.timer = (enemy.timer || 0) + dt;
  if (enemy.timer >= (enemy.fireInterval || 2.0) && targetPlayer) {
    enemy.timer = 0;
    const dx =
      targetPlayer.x +
      targetPlayer.width / 2 -
      (enemy.x + enemy.width / 2);
    const dy =
      targetPlayer.y +
      targetPlayer.height / 2 -
      (enemy.y + enemy.height / 2);
    const angle = Math.atan2(dy, dx);

    projectiles.push({
      x: enemy.x + enemy.width / 2,
      y: enemy.y + enemy.height / 2,
      vx: Math.cos(angle) * 220,
      vy: Math.sin(angle) * 220,
      radius: 5,
      life: 3.5,
    });
  }
}

export function renderTurret(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  player: Player | null,
): void {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height / 2;

  let angle = Math.PI / 2;
  if (player && !player.isDead) {
    angle = Math.atan2(
      player.y + player.height / 2 - cy,
      player.x + player.width / 2 - cx,
    );
  }

  ctx.fillStyle = "#1e272e";
  ctx.fillRect(enemy.x + 2, enemy.y + 10, 20, 14);
  ctx.strokeStyle = "#485460";
  ctx.lineWidth = 1;
  ctx.strokeRect(enemy.x + 2, enemy.y + 10, 20, 14);

  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(enemy.x + 4, enemy.y + 20, 4, 3);
  ctx.fillRect(enemy.x + 10, enemy.y + 20, 4, 3);
  ctx.fillRect(enemy.x + 16, enemy.y + 20, 4, 3);

  if (player && !player.isDead) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 0, 85, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 160, cy + Math.sin(angle) * 160);
    ctx.stroke();
    ctx.restore();
  }

  ctx.translate(cx, cy);
  ctx.rotate(angle);

  ctx.fillStyle = "#0f171e";
  ctx.fillRect(2, -5, 10, 3);
  ctx.fillRect(2, 2, 10, 3);

  ctx.fillStyle = "#ff0044";
  ctx.fillRect(10, -5, 2, 3);
  ctx.fillRect(10, 2, 2, 3);

  ctx.fillStyle = "#2c3e50";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e74c3c";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const chargeRatio = Math.min(
    1,
    (enemy.timer || 0) / (enemy.fireInterval || 2.0),
  );
  const glowRad = 2 + chargeRatio * 2;
  ctx.fillStyle = chargeRatio > 0.8 ? "#ffffff" : "#ff0033";
  ctx.beginPath();
  ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
  ctx.fill();
}
