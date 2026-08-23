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
  const isOmega = (enemy.width >= 100) || (enemy.bossName !== undefined && enemy.bossName.includes("OMEGA"));
  const speedMult = isPhase2 ? (isOmega ? 1.45 : 1.4) : (isOmega ? 1.05 : 1.0);
  const baseSpeed = 90 * speedMult;

  // Initialize diagonal velocity components if missing or 0
  if (enemy.vx === undefined || enemy.vx === 0) enemy.vx = baseSpeed * 0.8;
  if (enemy.vy === undefined || enemy.vy === 0) enemy.vy = baseSpeed * 0.6;

  // Maintain direction sign while scaling magnitude by phase speedMult
  const dirX = enemy.vx >= 0 ? 1 : -1;
  const dirY = enemy.vy >= 0 ? 1 : -1;
  enemy.vx = dirX * baseSpeed * 0.8;
  enemy.vy = dirY * baseSpeed * 0.6;

  // 1. Linear Horizontal movement & wall/tile bounce
  const minX = TILE_SIZE;
  const mapWidth = tileMap && tileMap.cols ? tileMap.cols * TILE_SIZE : 960;
  const maxX = mapWidth - TILE_SIZE - enemy.width;

  const nextX = enemy.x + enemy.vx * dt;
  if (
    hasBossTileCollision(tileMap, nextX, enemy.y, enemy.width, enemy.height) ||
    nextX < minX ||
    nextX > maxX
  ) {
    enemy.vx = -enemy.vx;
    if (nextX < minX) enemy.x = minX;
    else if (nextX > maxX) enemy.x = maxX;
  } else {
    enemy.x = nextX;
  }

  // 2. Linear Vertical movement & wall/tile bounce
  const minY = TILE_SIZE;
  const mapHeight = tileMap && tileMap.rows ? tileMap.rows * TILE_SIZE : 576;
  const maxY = mapHeight - TILE_SIZE - enemy.height;

  const nextY = enemy.y + enemy.vy * dt;
  if (
    hasBossTileCollision(tileMap, enemy.x, nextY, enemy.width, enemy.height) ||
    nextY < minY ||
    nextY > maxY
  ) {
    enemy.vy = -enemy.vy;
    if (nextY < minY) enemy.y = minY;
    else if (nextY > maxY) enemy.y = maxY;
  } else {
    enemy.y = nextY;
  }

  const scaleX = (enemy.width || 80) / 80;

  if (enemy.laserCharging) {
    enemy.laserChargeTimer = (enemy.laserChargeTimer || 0) - dt;
    if ((enemy.laserChargeTimer || 0) <= 0) {
      enemy.laserCharging = false;
      enemy.laserActiveTimer = isOmega ? 0.85 : 0.7;
    }
  } else if ((enemy.laserActiveTimer || 0) > 0) {
    enemy.laserActiveTimer = (enemy.laserActiveTimer || 0) - dt;
    const beamX = enemy.laserX !== undefined ? enemy.laserX : enemy.x + enemy.width / 2;
    const beamHalfWidth = 18 * scaleX;

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
    const attackInterval = isPhase2 ? (isOmega ? 1.35 : 1.5) : (isOmega ? 1.9 : 2.2);

    if ((enemy.attackTimer || 0) >= attackInterval) {
      enemy.attackTimer = 0;

      const targetPlayer = getClosestPlayer(enemy, livingPlayers);
      const targetX = targetPlayer ? targetPlayer.x + targetPlayer.width / 2 : enemy.x + enemy.width / 2;
      const targetY = targetPlayer ? targetPlayer.y + targetPlayer.height / 2 : enemy.y + 200;

      const missileSpawned = enemy.hasSpawnedPhase2Missile ?? false;

      if (isPhase2 && !missileSpawned) {
        enemy.hasSpawnedPhase2Missile = true;
        addHomingMissile(enemy.x + enemy.width / 2, enemy.y + enemy.height);
      } else {
        const wingOffset = 12 * scaleX;
        const firePositions = isOmega && isPhase2
          ? [enemy.x + wingOffset, enemy.x + enemy.width / 2, enemy.x + enemy.width - wingOffset]
          : [enemy.x + wingOffset, enemy.x + enemy.width - wingOffset];

        for (const fireX of firePositions) {
          const dx = targetX - fireX;
          const dy = targetY - (enemy.y + enemy.height);
          const angle = Math.atan2(dy, dx);
          projectiles.push({
            x: fireX,
            y: enemy.y + enemy.height - 5,
            vx: Math.cos(angle) * (isOmega ? 220 : 200),
            vy: Math.sin(angle) * (isOmega ? 220 : 200),
            radius: isOmega ? 6 : 5,
            life: 4.0,
          });
        }
      }
    }
  }

  if (tileMap && tileMap.addSparkles) {
    if (isPhase2 && Math.random() < (isOmega ? 0.8 : 0.6)) {
      tileMap.addSparkles(
        enemy.x + Math.random() * enemy.width,
        enemy.y + Math.random() * enemy.height,
        isOmega ? "#ff0055" : "#ff0033",
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
  const maxHp = enemy.maxHp || 10;
  const isOmega = (enemy.width >= 100) || (enemy.bossName !== undefined && enemy.bossName.includes("OMEGA"));

  const scaleX = (enemy.width || 80) / 80;
  const scaleY = (enemy.height || 64) / 64;
  const scale = (scaleX + scaleY) / 2;

  if (enemy.laserCharging) {
    const laserX = enemy.laserX !== undefined ? enemy.laserX : cx;
    ctx.save();
    ctx.strokeStyle = isOmega ? "rgba(255, 30, 80, 0.75)" : "rgba(255, 0, 55, 0.65)";
    ctx.lineWidth = Math.round(4 * scaleX);
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(laserX, enemy.y + enemy.height);
    ctx.lineTo(laserX, 576);
    ctx.stroke();

    ctx.strokeStyle = isOmega ? "#ff0077" : "#ff0055";
    ctx.lineWidth = Math.round(2 * scaleX);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(laserX, 540, (16 + Math.sin(animTimer * 20) * 4) * scaleX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if ((enemy.laserActiveTimer || 0) > 0) {
    const laserX = enemy.laserX !== undefined ? enemy.laserX : cx;
    const outerW = 44 * scaleX;
    const midW = 24 * scaleX;
    const innerW = 8 * scaleX;

    ctx.save();
    ctx.fillStyle = isOmega ? "rgba(255, 0, 110, 0.45)" : "rgba(255, 0, 85, 0.4)";
    ctx.fillRect(laserX - outerW / 2, enemy.y + enemy.height, outerW, 576);

    ctx.fillStyle = isOmega ? "rgba(255, 120, 180, 0.9)" : "rgba(255, 100, 150, 0.85)";
    ctx.fillRect(laserX - midW / 2, enemy.y + enemy.height, midW, 576);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(laserX - innerW / 2, enemy.y + enemy.height, innerW, 576);
    ctx.restore();
  }

  const auraRad = (52 + Math.sin(animTimer * 8) * 6) * scale;
  const auraGrad = ctx.createRadialGradient(cx, cy, 10 * scale, cx, cy, auraRad);
  if (isHit) {
    auraGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    auraGrad.addColorStop(0.5, "rgba(255, 0, 85, 0.7)");
    auraGrad.addColorStop(1, "rgba(100, 0, 30, 0)");
  } else if (isPhase2) {
    auraGrad.addColorStop(0, isOmega ? "rgba(255, 0, 90, 0.9)" : "rgba(255, 0, 50, 0.8)");
    auraGrad.addColorStop(0.5, isOmega ? "rgba(200, 0, 50, 0.45)" : "rgba(180, 0, 30, 0.35)");
    auraGrad.addColorStop(1, "rgba(80, 0, 20, 0)");
  } else {
    auraGrad.addColorStop(0, isOmega ? "rgba(160, 32, 240, 0.75)" : "rgba(0, 200, 255, 0.6)");
    auraGrad.addColorStop(0.5, isOmega ? "rgba(100, 0, 200, 0.35)" : "rgba(0, 100, 200, 0.25)");
    auraGrad.addColorStop(1, "rgba(0, 50, 100, 0)");
  }
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, auraRad, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scaleX, scaleY);

  ctx.fillStyle = isHit ? "#ffffff" : (isOmega ? "#151828" : "#1a252f");
  ctx.strokeStyle = isPhase2 ? "#ff0044" : (isOmega ? "#a855f7" : "#00d2d3");
  ctx.lineWidth = 2;

  // Left Wing
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-44, 10);
  ctx.lineTo(-38, 28);
  ctx.lineTo(-15, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right Wing
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(44, 10);
  ctx.lineTo(38, 28);
  ctx.lineTo(15, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Center Chassis
  ctx.fillStyle = isHit ? "#ffffff" : (isOmega ? "#23293e" : "#2c3e50");
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(30, -12);
  ctx.lineTo(26, 22);
  ctx.lineTo(0, 30);
  ctx.lineTo(-26, 22);
  ctx.lineTo(-30, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = isHit ? "#ffffff" : isPhase2 ? "#ff0033" : (isOmega ? "#9333ea" : "#3498db");
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Armor Detailing Lines
  ctx.strokeStyle = isPhase2
    ? "rgba(255,0,85,0.7)"
    : isOmega
    ? "rgba(192,132,252,0.75)"
    : "rgba(0,210,211,0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-20, -8);
  ctx.lineTo(0, 5);
  ctx.lineTo(20, -8);
  ctx.stroke();

  // Core Reactor
  const corePulse = Math.sin(animTimer * 12) * 2;
  const coreRad = (isPhase2 ? 14 : 11) + corePulse;
  const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, coreRad);
  if (isPhase2) {
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.4, isOmega ? "#ff0066" : "#ff0044");
    coreGrad.addColorStop(1, "#800016");
  } else {
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.4, isOmega ? "#c084fc" : "#00d2d3");
    coreGrad.addColorStop(1, isOmega ? "#581c87" : "#004b57");
  }
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, coreRad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Eye Tracking
  let eyeAngle = Math.PI / 2;
  if (player && !player.isDead) {
    eyeAngle = Math.atan2(
      player.y + player.height / 2 - cy,
      player.x + player.width / 2 - cx,
    );
  }
  const eyeEx = Math.cos(eyeAngle) * 4;
  const eyeEy = Math.sin(eyeAngle) * 4;

  ctx.fillStyle = isPhase2 ? "#ffff00" : (isOmega ? "#ff0055" : "#ff0055");
  ctx.beginPath();
  ctx.arc(eyeEx, eyeEy - 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(eyeEx, eyeEy - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Boss Health Bar
  const currentHp = Math.max(0, enemy.hp !== undefined ? enemy.hp : maxHp);
  const hpRatio = Math.min(1, Math.max(0, currentHp / maxHp));

  const barWidth = Math.max(140, Math.round(enemy.width * 1.5));
  const barHeight = isOmega ? 14 : 12;
  const barX = cx - barWidth / 2;
  const barY = enemy.y - (barHeight + 14);

  ctx.fillStyle = "rgba(10, 15, 25, 0.85)";
  ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
  ctx.strokeStyle = isPhase2 ? "#ff0044" : (isOmega ? "#c084fc" : "#00d2d3");
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

  const fontSize = isOmega ? "bold 11px sans-serif" : "bold 9px sans-serif";
  ctx.font = fontSize;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const label = `${enemy.bossName || (isOmega ? "MECHA CORE OMEGA" : "MECHA CORE ALPHA")} - ${currentHp}/${maxHp}`;
  ctx.fillText(label, cx, barY - 5);
}

