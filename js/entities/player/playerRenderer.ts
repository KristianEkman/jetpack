/* ==========================================================================
   PLAYER CANVAS RENDERER
   ========================================================================== */

import { TILE_SIZE } from "../../shared/constants.js";
import type { Player } from "./playerClass.js";

export function renderPlayer(player: Player, ctx: CanvasRenderingContext2D): void {
  if (player.isDead) return;

  ctx.save();

  if (player.respawnInvulnerability > 0) {
    if (Math.floor(player.animTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }
  }

  if (!player.isLocal) {
    player.animTimer += 0.016;
  }

  const isMovingOnGround =
    (player.isGrounded || Math.abs(player.vy) < 25) &&
    !player.isThrusting &&
    !player.isClimbing &&
    Math.abs(player.vx) > 5;

  let strideX = 0;
  let liftY1 = 0;
  let liftY2 = 0;
  let walkBobY = 0;

  if (isMovingOnGround) {
    const speedRatio = Math.min(1.5, Math.abs(player.vx) / 100);
    const walkSpeed = 14 * Math.max(0.5, speedRatio);
    const legSwing = Math.sin(player.animTimer * walkSpeed);
    strideX = legSwing * 3.5;
    liftY1 = Math.max(0, legSwing) * 2;
    liftY2 = Math.max(0, -legSwing) * 2;
    walkBobY = Math.abs(Math.sin(player.animTimer * walkSpeed)) * 2.0;
  }

  const px = player.x;
  const py = player.y - walkBobY;

  ctx.fillStyle = "#3b82f6";
  const leg1X = px + 4 + strideX;
  const leg1Height = 6 - liftY1;
  ctx.fillRect(leg1X, py + 22, 5, leg1Height);

  ctx.fillStyle = "#1d4ed8";
  const boot1X = player.facingRight ? leg1X : leg1X - 1;
  ctx.fillRect(boot1X, py + 22 + leg1Height - 2, 6, 2);

  ctx.fillStyle = "#7f8c8d";
  const packX = player.facingRight ? px - 4 : px + player.width - 2;
  ctx.fillRect(packX, py + 6, 6, 16);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(packX + 1, py + 8, 4, 4);

  if (player.isThrusting) {
    const flameLen = 8 + Math.random() * 8;
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.moveTo(packX + 1, py + 22);
    ctx.lineTo(packX + 5, py + 22);
    ctx.lineTo(packX + 3, py + 22 + flameLen);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffff00";
    ctx.beginPath();
    ctx.moveTo(packX + 2, py + 22);
    ctx.lineTo(packX + 4, py + 22);
    ctx.lineTo(packX + 3, py + 22 + flameLen * 0.6);
    ctx.closePath();
    ctx.fill();

    if (!player.isLocal && player.tileMap) {
      const smokeX = packX + 3;
      const smokeY = py + 22;
      player.tileMap.addSparkles(smokeX, smokeY, "#ff6600", 1);
      if (Math.random() < 0.3) {
        player.tileMap.addSparkles(smokeX, smokeY, "#aaaaaa", 1);
      }
    }
  }

  ctx.fillStyle = player.color || "#00ffcc";
  ctx.fillRect(px + 4, py + 8, 14, 14);

  ctx.fillStyle = "#ecf0f1";
  ctx.beginPath();
  ctx.arc(px + 11, py + 6, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3498db";
  const visorX = player.facingRight ? px + 11 : px + 5;
  ctx.fillRect(visorX, py + 3, 6, 5);

  ctx.fillStyle = "#60a5fa";
  const leg2X = px + 13 - strideX;
  const leg2Height = 6 - liftY2;
  ctx.fillRect(leg2X, py + 22, 5, leg2Height);

  ctx.fillStyle = "#2563eb";
  const boot2X = player.facingRight ? leg2X : leg2X - 1;
  ctx.fillRect(boot2X, py + 22 + leg2Height - 2, 6, 2);

  if (player.isPhasing) {
    if (!player.isLocal && player.tileMap) {
      const dir = player.facingRight ? 1 : -1;
      const startX = player.facingRight ? px + player.width : px;
      const startY = py + 12;
      player.phaseBeamLength = 160;
      for (let dist = 0; dist <= 160; dist += 8) {
        const targetX = startX + dir * dist;
        const targetCol = Math.floor(targetX / TILE_SIZE);
        const targetRow = Math.floor(startY / TILE_SIZE);
        if (player.tileMap.isSolid(targetCol, targetRow)) {
          player.phaseBeamLength = dist;
          break;
        }
      }
    }

    const beamStartX = player.facingRight ? px + player.width : px;
    const beamStartY = py + 12;
    const beamEndX = player.facingRight
      ? beamStartX + player.phaseBeamLength
      : beamStartX - player.phaseBeamLength;

    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.lineTo(beamEndX, beamStartY);
    ctx.stroke();

    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.lineTo(beamEndX, beamStartY);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.lineTo(beamEndX, beamStartY);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(beamStartX, beamStartY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(beamEndX, beamStartY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.arc(beamEndX, beamStartY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.respawnInvulnerability > 0) {
    ctx.save();
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px + player.width / 2, py + player.height / 2, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (player.name && player.showNameTag) {
    ctx.save();
    ctx.font = "bold 9px Orbitron, sans-serif";
    ctx.textAlign = "center";

    const tagText = player.name;
    const textWidth = ctx.measureText(tagText).width;
    const tagX = px + player.width / 2;
    const tagY = py - 10;

    ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
    ctx.fillRect(tagX - textWidth / 2 - 5, tagY - 9, textWidth + 10, 12);
    ctx.strokeStyle = player.color || "#00f0ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX - textWidth / 2 - 5, tagY - 9, textWidth + 10, 12);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(tagText, tagX, tagY);
    ctx.restore();
  }

  if (player.isStuck && !player.isDead) {
    ctx.save();
    ctx.font = "bold 11px Orbitron, sans-serif";
    ctx.textAlign = "center";

    const line1 = "⚠️ NO FUEL!";
    const line2 = "PRESS 'K' TO RESPAWN";

    const w1 = ctx.measureText(line1).width;
    const w2 = ctx.measureText(line2).width;
    const boxWidth = Math.max(w1, w2) + 14;
    const boxHeight = 32;

    const tagX = px + player.width / 2;
    const baseY = py - (player.name && player.showNameTag ? 42 : 28);

    ctx.fillStyle = "rgba(255, 0, 85, 0.9)";
    ctx.fillRect(tagX - boxWidth / 2, baseY - 12, boxWidth, boxHeight);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tagX - boxWidth / 2, baseY - 12, boxWidth, boxHeight);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(line1, tagX, baseY);
    ctx.fillText(line2, tagX, baseY + 14);
    ctx.restore();
  }

  ctx.restore();
}
