/* ==========================================================================
   BOSS ENEMY BEHAVIOR & RENDERING
   ========================================================================== */

import { TILE_SIZE, TileMap } from "../../world/tilemap.js";
import { Player } from "../player.js";
import { Enemy, Projectile } from "./types.js";

export function hasBossTileCollision(
  tileMap: TileMap,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!tileMap || typeof tileMap.isSolid !== "function") return false;
  const minCol = Math.floor(x / TILE_SIZE);
  const maxCol = Math.floor((x + width - 1) / TILE_SIZE);
  const minRow = Math.floor(y / TILE_SIZE);
  const maxRow = Math.floor((y + height - 1) / TILE_SIZE);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (tileMap.isSolid(c, r)) {
        return true;
      }
    }
  }
  return false;
}

export function updateBoss(
  tileMap: TileMap,
  enemy: Enemy,
  dt: number,
  livingPlayers: Player[],
  projectiles: Projectile[],
  getClosestPlayer: (enemy: Enemy, players: Player[]) => Player | null,
  addHomingMissile: (x: number, y: number) => void,
  hasActiveHomingMissile?: () => boolean,
): void {
  enemy.hitFlashTimer = Math.max(0, (enemy.hitFlashTimer || 0) - dt);

  const maxHp = enemy.maxHp || 10;
  const currentHp = enemy.hp !== undefined ? enemy.hp : maxHp;
  if (currentHp <= maxHp / 2) {
    enemy.phase = 2;
  } else {
    enemy.phase = 1;
  }

  const isPhase2 = enemy.phase === 2;
  const speedMult = isPhase2 ? 1.4 : 1.0;
  const currentSpeed = 90 * speedMult;

  if (enemy.vx === undefined || enemy.vx === 0) enemy.vx = currentSpeed;
  if (enemy.vx > 0) enemy.vx = currentSpeed;
  if (enemy.vx < 0) enemy.vx = -currentSpeed;

  const nextX = enemy.x + (enemy.vx || currentSpeed) * dt;
  if (hasBossTileCollision(tileMap, nextX, enemy.y, enemy.width, enemy.height)) {
    if ((enemy.vx || 0) > 0) {
      enemy.vx = -currentSpeed;
    } else {
      enemy.vx = currentSpeed;
    }
  } else {
    enemy.x = nextX;
  }

  const minX = TILE_SIZE;
  const mapWidth =
    tileMap && tileMap.cols
      ? tileMap.cols * TILE_SIZE
      : 960;
  const maxX = mapWidth - TILE_SIZE - enemy.width;
  if (enemy.x < minX) {
    enemy.x = minX;
    enemy.vx = currentSpeed;
  } else if (enemy.x > maxX) {
    enemy.x = maxX;
    enemy.vx = -currentSpeed;
  }

  const startY = enemy.startY !== undefined ? enemy.startY : enemy.y;
  const nextY =
    startY +
    Math.sin((enemy.animTimer || 0) * (isPhase2 ? 3.5 : 2.0)) * 12;
  if (!hasBossTileCollision(tileMap, enemy.x, nextY, enemy.width, enemy.height)) {
    enemy.y = nextY;
  }

  if (enemy.laserCharging) {
    enemy.laserChargeTimer = (enemy.laserChargeTimer || 0) - dt;
    if ((enemy.laserChargeTimer || 0) <= 0) {
      enemy.laserCharging = false;
      enemy.laserActiveTimer = 0.7;
    }
  } else if ((enemy.laserActiveTimer || 0) > 0) {
    enemy.laserActiveTimer = (enemy.laserActiveTimer || 0) - dt;
    const beamX = enemy.laserX !== undefined ? enemy.laserX : enemy.x + enemy.width / 2;
    const beamHalfWidth = 18;

    for (const p of livingPlayers) {
      if (
        p.x + p.width >= beamX - beamHalfWidth &&
        p.x <= beamX + beamHalfWidth &&
        p.y + p.height >= enemy.y + enemy.height
      ) {
        p.takeDamage();
      }
    }
  } else {
    enemy.attackTimer = (enemy.attackTimer || 0) + dt;
    const attackInterval = isPhase2 ? 1.5 : 2.2;

    if ((enemy.attackTimer || 0) >= attackInterval) {
      enemy.attackTimer = 0;

      const targetPlayer = getClosestPlayer(enemy, livingPlayers);
      const targetX = targetPlayer ? targetPlayer.x + targetPlayer.width / 2 : enemy.x + enemy.width / 2;
      const targetY = targetPlayer ? targetPlayer.y + targetPlayer.height / 2 : enemy.y + 200;

      const missileActive = hasActiveHomingMissile ? hasActiveHomingMissile() : false;

      if (isPhase2 && !missileActive) {
        addHomingMissile(enemy.x + enemy.width / 2, enemy.y + enemy.height);
      } else {
        for (const wingX of [enemy.x + 12, enemy.x + enemy.width - 12]) {
          const dx = targetX - wingX;
          const dy = targetY - (enemy.y + enemy.height);
          const angle = Math.atan2(dy, dx);
          projectiles.push({
            x: wingX,
            y: enemy.y + enemy.height - 5,
            vx: Math.cos(angle) * 200,
            vy: Math.sin(angle) * 200,
            radius: 5,
            life: 4.0,
          });
        }
      }
    }
  }

  if (tileMap && tileMap.addSparkles) {
    if (isPhase2 && Math.random() < 0.6) {
      tileMap.addSparkles(
        enemy.x + Math.random() * enemy.width,
        enemy.y + Math.random() * enemy.height,
        "#ff0033",
        1,
      );
    }
  }
}

export function renderBoss(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  player: Player | null,
): void {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height / 2;
  const animTimer = enemy.animTimer || 0;
  const isPhase2 = (enemy.phase || 1) === 2;
  const isHit = (enemy.hitFlashTimer || 0) > 0;

  if (enemy.laserCharging) {
    const laserX = enemy.laserX !== undefined ? enemy.laserX : cx;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 0, 55, 0.65)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(laserX, enemy.y + enemy.height);
    ctx.lineTo(laserX, 576);
    ctx.stroke();

    ctx.strokeStyle = "#ff0055";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(laserX, 540, 16 + Math.sin(animTimer * 20) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if ((enemy.laserActiveTimer || 0) > 0) {
    const laserX = enemy.laserX !== undefined ? enemy.laserX : cx;
    ctx.save();
    ctx.fillStyle = "rgba(255, 0, 85, 0.4)";
    ctx.fillRect(laserX - 22, enemy.y + enemy.height, 44, 576);

    ctx.fillStyle = "rgba(255, 100, 150, 0.85)";
    ctx.fillRect(laserX - 12, enemy.y + enemy.height, 24, 576);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(laserX - 4, enemy.y + enemy.height, 8, 576);
    ctx.restore();
  }

  const auraRad = 52 + Math.sin(animTimer * 8) * 6;
  const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraRad);
  if (isHit) {
    auraGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    auraGrad.addColorStop(0.5, "rgba(255, 0, 85, 0.6)");
    auraGrad.addColorStop(1, "rgba(100, 0, 30, 0)");
  } else if (isPhase2) {
    auraGrad.addColorStop(0, "rgba(255, 0, 50, 0.8)");
    auraGrad.addColorStop(0.5, "rgba(180, 0, 30, 0.35)");
    auraGrad.addColorStop(1, "rgba(80, 0, 20, 0)");
  } else {
    auraGrad.addColorStop(0, "rgba(0, 200, 255, 0.6)");
    auraGrad.addColorStop(0.5, "rgba(0, 100, 200, 0.25)");
    auraGrad.addColorStop(1, "rgba(0, 50, 100, 0)");
  }
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, auraRad, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = isHit ? "#ffffff" : "#1a252f";
  ctx.strokeStyle = isPhase2 ? "#ff0044" : "#00d2d3";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-44, 10);
  ctx.lineTo(-38, 28);
  ctx.lineTo(-15, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(44, 10);
  ctx.lineTo(38, 28);
  ctx.lineTo(15, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isHit ? "#ffffff" : "#2c3e50";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(30, -12);
  ctx.lineTo(26, 22);
  ctx.lineTo(0, 30);
  ctx.lineTo(-26, 22);
  ctx.lineTo(-30, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = isHit ? "#ffffff" : isPhase2 ? "#ff0033" : "#3498db";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.strokeStyle = isPhase2 ? "rgba(255,0,85,0.7)" : "rgba(0,210,211,0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-20, -8);
  ctx.lineTo(0, 5);
  ctx.lineTo(20, -8);
  ctx.stroke();

  const corePulse = Math.sin(animTimer * 12) * 2;
  const coreRad = (isPhase2 ? 14 : 11) + corePulse;
  const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, coreRad);
  if (isPhase2) {
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.4, "#ff0044");
    coreGrad.addColorStop(1, "#800016");
  } else {
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.4, "#00d2d3");
    coreGrad.addColorStop(1, "#004b57");
  }
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, coreRad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();

  let eyeAngle = Math.PI / 2;
  if (player && !player.isDead) {
    eyeAngle = Math.atan2(
      player.y + player.height / 2 - cy,
      player.x + player.width / 2 - cx,
    );
  }
  const eyeEx = Math.cos(eyeAngle) * 4;
  const eyeEy = Math.sin(eyeAngle) * 4;

  ctx.fillStyle = isPhase2 ? "#ffff00" : "#ff0055";
  ctx.beginPath();
  ctx.arc(eyeEx, eyeEy - 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(eyeEx, eyeEy - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const maxHp = enemy.maxHp || 10;
  const currentHp = Math.max(0, enemy.hp !== undefined ? enemy.hp : maxHp);
  const hpRatio = Math.min(1, Math.max(0, currentHp / maxHp));

  const barWidth = 140;
  const barHeight = 12;
  const barX = cx - barWidth / 2;
  const barY = enemy.y - 24;

  ctx.fillStyle = "rgba(10, 15, 25, 0.85)";
  ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
  ctx.strokeStyle = isPhase2 ? "#ff0044" : "#00d2d3";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

  const fillWidth = (barWidth - 2) * hpRatio;
  let hpColor = "#2ecc71";
  if (hpRatio < 0.3) hpColor = "#e74c3c";
  else if (hpRatio < 0.6) hpColor = "#f1c40f";

  const hpGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
  hpGrad.addColorStop(0, hpColor);
  hpGrad.addColorStop(1, "#ffffff");

  ctx.fillStyle = hpGrad;
  ctx.fillRect(barX + 1, barY + 1, fillWidth, barHeight - 2);

  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const label = `${enemy.bossName || "MECHA CORE ALPHA"} - ${currentHp}/${maxHp}`;
  ctx.fillText(label, cx, barY - 5);
}
