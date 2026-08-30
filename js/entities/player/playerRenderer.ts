/* ==========================================================================
   PLAYER CANVAS RENDERER
   ========================================================================== */

import { TILE_SIZE } from "../../shared/constants.js";
import type { Player } from "./playerClass.js";

export function renderPlayer(player: Player, ctx: CanvasRenderingContext2D): void {
  if (player.isDead) return;

  ctx.save();

  if (player.respawnInvulnerability > 0) {
    // Gentle energy pulse without making the sprite vanish or flash invisibly
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(player.animTimer * 14);
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
    player.walkPhase = (player.walkPhase || 0) + 0.016 * walkSpeed;
    const legSwing = Math.sin(player.walkPhase);
    strideX = legSwing * 3.5;
    liftY1 = Math.max(0, legSwing) * 2;
    liftY2 = Math.max(0, -legSwing) * 2;
    walkBobY = Math.abs(Math.sin(player.walkPhase)) * 2.0;
  } else if (player.walkPhase) {
    player.walkPhase = player.walkPhase % (Math.PI * 2);
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

    const isRapid = player.rapidFireTimer > 0;
    const outerColor = isRapid ? "rgba(255, 170, 0, 0.45)" : "rgba(0, 240, 255, 0.35)";
    const mainColor = isRapid ? "#ffaa00" : "#00f0ff";
    const coreColor = isRapid ? "#ffee55" : "#ffffff";

    ctx.strokeStyle = outerColor;
    ctx.lineWidth = isRapid ? 12 : 10;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.lineTo(beamEndX, beamStartY);
    ctx.stroke();

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.lineTo(beamEndX, beamStartY);
    ctx.stroke();

    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.lineTo(beamEndX, beamStartY);
    ctx.stroke();

    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(beamStartX, beamStartY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = outerColor;
    ctx.beginPath();
    ctx.arc(beamEndX, beamStartY, isRapid ? 10 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(beamEndX, beamStartY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.rapidFireTimer > 0) {
    ctx.save();
    const pulse = (Math.sin(player.animTimer * 25) + 1) * 0.5;
    const auraRadius = 18 + pulse * 4;
    const cx = px + player.width / 2;
    const cy = py + player.height / 2;

    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, auraRadius);
    grad.addColorStop(0, `rgba(255, 230, 0, ${0.45 + pulse * 0.25})`);
    grad.addColorStop(0.6, `rgba(255, 100, 0, ${0.25 + pulse * 0.15})`);
    grad.addColorStop(1, "rgba(255, 170, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 220, 0, ${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#ffea00";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (player.respawnInvulnerability > 0) {
    ctx.save();
    const cx = px + player.width / 2;
    const cy = py + player.height / 2;
    const invulnRatio = Math.min(1, player.respawnInvulnerability / 2.5);
    const themeColor = player.color || "#00f0ff";

    // 1. Vertical re-materialization beacon beam during the first 1.2s of spawn
    if (player.respawnInvulnerability > 1.3) {
      const beamProgress = (player.respawnInvulnerability - 1.3) / 1.2;
      ctx.save();
      const beamWidth = 18 * beamProgress + 4;
      const grad = ctx.createLinearGradient(
        cx - beamWidth,
        0,
        cx + beamWidth,
        0,
      );
      grad.addColorStop(0, "rgba(0, 240, 255, 0)");
      grad.addColorStop(0.5, `rgba(0, 240, 255, ${0.4 * beamProgress})`);
      grad.addColorStop(1, "rgba(0, 240, 255, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - beamWidth, 0, beamWidth * 2, 600);

      // Bright core ray
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * beamProgress})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, 600);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Radiant energy forcefield shield bubble
    const pulse = (Math.sin(player.animTimer * 10) + 1) * 0.5;
    const shieldRadius = 19 + pulse * 2.5;

    const shieldGrad = ctx.createRadialGradient(
      cx,
      cy,
      4,
      cx,
      cy,
      shieldRadius,
    );
    shieldGrad.addColorStop(0, "rgba(0, 240, 255, 0.05)");
    shieldGrad.addColorStop(0.7, "rgba(0, 240, 255, 0.18)");
    shieldGrad.addColorStop(1, `rgba(0, 240, 255, ${0.45 * invulnRatio})`);

    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, shieldRadius, 0, Math.PI * 2);
    ctx.fill();

    // Outer rotating energy ring
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 10;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -player.animTimer * 25;
    ctx.beginPath();
    ctx.arc(cx, cy, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner counter-rotating ring
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 4;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = player.animTimer * 30;
    ctx.beginPath();
    ctx.arc(cx, cy, shieldRadius - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // 3. Local Player "▼ YOU" spawn indicator badge
    if (player.isLocal && player.respawnInvulnerability > 0.6) {
      ctx.save();
      const badgeY = py - 26 + Math.sin(player.animTimer * 10) * 3;
      ctx.font = "900 10px Orbitron, sans-serif";
      ctx.textAlign = "center";

      const badgeText = "▼ YOU";
      const textW = ctx.measureText(badgeText).width;

      ctx.fillStyle = "rgba(0, 240, 255, 0.95)";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.fillRect(cx - textW / 2 - 4, badgeY - 10, textW + 8, 13);

      ctx.fillStyle = "#05070c";
      ctx.shadowBlur = 0;
      ctx.fillText(badgeText, cx, badgeY);
      ctx.restore();
    }
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

  renderPlayerProjectiles(player, ctx);

  ctx.restore();
}

export function renderPlayerProjectiles(
  player: Player,
  ctx: CanvasRenderingContext2D,
): void {
  if (!player.projectiles || player.projectiles.length === 0) return;

  for (const proj of player.projectiles) {
    ctx.save();
    ctx.translate(proj.x, proj.y);

    if (proj.type === "spread_cannon") {
      const angle = proj.rotation || Math.atan2(proj.vy, proj.vx);
      ctx.rotate(angle);

      // Long tapered trail makes the fast bolt direction readable at a glance.
      const trail = ctx.createLinearGradient(-18, 0, 2, 0);
      trail.addColorStop(0, "rgba(0, 240, 255, 0)");
      trail.addColorStop(0.55, "rgba(0, 240, 255, 0.5)");
      trail.addColorStop(1, "rgba(255, 0, 221, 0.9)");
      ctx.fillStyle = trail;
      ctx.beginPath();
      ctx.moveTo(-19, 0);
      ctx.lineTo(1, -2.4);
      ctx.lineTo(1, 2.4);
      ctx.closePath();
      ctx.fill();

      // Glow halo
      ctx.fillStyle = "rgba(255, 0, 221, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main beam bolt
      ctx.fillStyle = "#ff00dd";
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.type === "plasma_grenade") {
      const pulse = (Math.sin(Date.now() / 80) + 1) * 0.5;
      const radius = proj.radius || 6;
      ctx.rotate(proj.rotation || 0);

      // Outer radial aura
      const auraGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius + 4 + pulse * 2);
      auraGrad.addColorStop(0, "rgba(0, 255, 102, 0.8)");
      auraGrad.addColorStop(0.6, "rgba(0, 255, 102, 0.3)");
      auraGrad.addColorStop(1, "rgba(0, 255, 102, 0)");
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      // Segmented metal shell around a hot plasma chamber.
      const shell = ctx.createRadialGradient(-2, -2, 1, 0, 0, radius);
      shell.addColorStop(0, "#caffd7");
      shell.addColorStop(0.35, "#00ff66");
      shell.addColorStop(1, "#006b35");
      ctx.fillStyle = shell;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 55, 28, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-radius, 0);
      ctx.lineTo(radius, 0);
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, radius);
      ctx.stroke();

      // Rotating core ring
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // Core hot center
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Fast blinking fuse pips communicate that the grenade is live.
      const fuseProgress = 1 - proj.life / Math.max(0.001, proj.maxLife);
      ctx.fillStyle = fuseProgress > 0.65 && pulse > 0.45 ? "#ffffff" : "#ffcc00";
      ctx.fillRect(-1.5, -radius - 2, 3, 2);
    } else if (proj.type === "seeker_missile") {
      const angle = proj.rotation || Math.atan2(proj.vy, proj.vx);
      ctx.rotate(angle);

      // Rocket engine exhaust flame
      const flameLen = 6 + Math.random() * 5;
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(-6, 2);
      ctx.lineTo(-6 - flameLen, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.moveTo(-6, -1);
      ctx.lineTo(-6, 1);
      ctx.lineTo(-6 - flameLen * 0.6, 0);
      ctx.closePath();
      ctx.fill();

      // Rocket fuselage body
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(-6, -2.5, 10, 5);

      // Tail fins
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(-3, -2.5);
      ctx.lineTo(-6, -2.5);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-6, 5);
      ctx.lineTo(-3, 2.5);
      ctx.lineTo(-6, 2.5);
      ctx.closePath();
      ctx.fill();

      // Nose cone
      ctx.fillStyle = "#ff2200";
      ctx.beginPath();
      ctx.moveTo(4, -2.5);
      ctx.lineTo(8, 0);
      ctx.lineTo(4, 2.5);
      ctx.closePath();
      ctx.fill();

      // Sensor tip
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 5;
      ctx.fillStyle = "#bfffff";
      ctx.beginPath();
      ctx.arc(7.4, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // A rotating lock ring distinguishes the guided missile from a rocket.
      const scanAngle = Date.now() / 120;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(7.4, 0, 4.2, scanAngle, scanAngle + Math.PI * 0.75);
      ctx.stroke();
    }

    ctx.restore();
  }
}
