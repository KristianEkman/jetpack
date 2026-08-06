/* ==========================================================================
   TILEMAP & WORLD ENGINE
   ========================================================================== */

import { EnemyManager } from "../entities/enemy.js";
import { Player } from "../entities/player.js";
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TILES,
  GAME_EVENTS,
} from "../shared/constants.js";
import { LevelData } from "../shared/payloads.js";
import { ParticleSpec } from "../shared/types.js";

export { TILE_SIZE, GRID_COLS, GRID_ROWS, TILES };

export interface DissolvedBrick {
  index: number;
  col: number;
  row: number;
  originalTile: number;
  timer: number;
}

export interface TeleporterPad {
  tiles: number[];
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface DebrisObject {
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  gravity?: number;
  life: number;
  maxLife: number;
  bounce?: number;
  radius?: number;
  speed?: number;
}

type TileMapListener = (payload?: any) => void;

export class TileMap {
  cols: number;
  rows: number;
  grid: number[];
  dissolvedBricks: DissolvedBrick[];
  portalAngle: number;
  totalEmeralds: number;
  collectedEmeralds: number;
  teleporters: TeleporterPad[];
  particles: ParticleSpec[];
  debris: DebrisObject[];
  listeners: Record<string, TileMapListener[]>;
  spawnPoints: { x: number; y: number }[];
  effectsEnabled: boolean;

  constructor(options: { effectsEnabled?: boolean } = {}) {
    this.cols = GRID_COLS;
    this.rows = GRID_ROWS;
    this.grid = new Array(this.rows * this.cols).fill(TILES.AIR);

    // Dissolved Phase Bricks timer queue: { index, originalTile, timer }
    this.dissolvedBricks = [];

    // Animated portal angle & particle timer
    this.portalAngle = 0;
    this.totalEmeralds = 0;
    this.collectedEmeralds = 0;

    // Teleporters array: list of tile indices
    this.teleporters = [];

    // Particles & Debris System
    this.particles = [];
    this.debris = [];

    // Event listeners for world updates
    this.listeners = {};

    this.spawnPoints = [];
    this.effectsEnabled = options.effectsEnabled ?? true;
  }

  on(event: string, callback: TileMapListener): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback: TileMapListener): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      (cb) => cb !== callback,
    );
  }

  emit(event: string, payload?: unknown): void {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        cb(payload);
      }
    }
  }

  loadLevelData(levelData: LevelData): void {
    this.grid = [...levelData.grid];
    this.dissolvedBricks = [];
    this.particles = [];
    this.debris = [];
    this.collectedEmeralds = 0;
    this.countTotalEmeralds();
    this.rebuildTeleporters();
  }

  getTile(col: number, row: number): number {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return TILES.BRICK; // Out of bounds is solid brick
    }
    return this.grid[row * this.cols + col];
  }

  setTile(col: number, row: number, tileType: number): void {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[row * this.cols + col] = tileType;
      this.rebuildTeleporters();
    }
  }

  countTotalEmeralds(): void {
    let count = 0;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === TILES.EMERALD) {
        count++;
      }
    }
    this.totalEmeralds = count;
  }

  rebuildTeleporters(): void {
    this.teleporters = [];

    const visited = new Set<number>();
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === TILES.TELEPORTER && !visited.has(i)) {
        // Group contiguous teleporter tiles into a single Teleporter Pad node
        const padTiles: number[] = [];
        const queue: number[] = [i];
        visited.add(i);

        let sumCol = 0;
        let sumRow = 0;

        while (queue.length > 0) {
          const curr = queue.shift()!;
          padTiles.push(curr);

          const c = curr % this.cols;
          const r = Math.floor(curr / this.cols);
          sumCol += c;
          sumRow += r;

          const neighbors = [
            { c: c - 1, r },
            { c: c + 1, r },
            { c, r: r - 1 },
            { c, r: r + 1 },
          ];

          for (let n of neighbors) {
            if (n.c >= 0 && n.c < this.cols && n.r >= 0 && n.r < this.rows) {
              const nIdx = n.r * this.cols + n.c;
              if (this.grid[nIdx] === TILES.TELEPORTER && !visited.has(nIdx)) {
                visited.add(nIdx);
                queue.push(nIdx);
              }
            }
          }
        }

        const avgCol = sumCol / padTiles.length;
        const avgRow = sumRow / padTiles.length;

        this.teleporters.push({
          tiles: padTiles,
          col: avgCol,
          row: avgRow,
          x: avgCol * TILE_SIZE,
          y: avgRow * TILE_SIZE,
        });
      }
    }
  }

  // Check if tile is solid for collision
  isSolid(col: number, row: number): boolean {
    const tile = this.getTile(col, row);
    return [
      TILES.BRICK,
      TILES.PHASE_BRICK,
      TILES.ICE,
      TILES.CONVEYOR_LEFT,
      TILES.CONVEYOR_RIGHT,
    ].includes(tile as any);
  }

  // Check climbable
  isClimbable(col: number, row: number): boolean {
    const tile = this.getTile(col, row);
    return tile === TILES.LADDER || tile === TILES.VINE;
  }

  // Phase Shifter beam targeting: dissolves phaseable brick at tile
  phaseTile(col: number, row: number): boolean {
    const tile = this.getTile(col, row);
    if (tile === TILES.PHASE_BRICK) {
      const index = row * this.cols + col;
      // Prevent duplicating restoration timer
      if (!this.dissolvedBricks.some((b) => b.index === index)) {
        this.grid[index] = TILES.AIR;
        this.dissolvedBricks.push({
          index,
          col,
          row,
          originalTile: TILES.PHASE_BRICK,
          timer: 5.0, // Re-solidifies in 5 seconds
        });

        // Spawn disintegration particles
        this.addSparkles(
          col * TILE_SIZE + 16,
          row * TILE_SIZE + 16,
          "#00e5ff",
          12,
        );
        this.emit(GAME_EVENTS.TILE_PHASED, {
          col,
          row,
          index,
          originalTile: TILES.PHASE_BRICK,
        });
        return true;
      }
    }
    return false;
  }

  // Force re-solidifying a dissolved phase brick
  restoreTile(col: number, row: number): boolean {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows)
      return false;
    const index = row * this.cols + col;
    this.grid[index] = TILES.PHASE_BRICK;
    const dIdx = this.dissolvedBricks.findIndex((b) => b.index === index);
    if (dIdx !== -1) {
      this.dissolvedBricks.splice(dIdx, 1);
    }
    this.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, "#00ffcc", 10);
    this.emit(GAME_EVENTS.TILE_RESTORED, {
      col,
      row,
      index,
      tile: TILES.PHASE_BRICK,
    });
    return true;
  }

  update(
    dt: number,
    player: Player | null = null,
    enemyManager: EnemyManager | null = null,
  ): void {
    // Update portal animation rotation
    this.portalAngle += dt * 3;

    // Collect entities to check for tile occupancy
    const entities: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    if (player && !player.isDead) entities.push(player);
    if (enemyManager && enemyManager.enemies) {
      for (const enemy of enemyManager.enemies) {
        entities.push(enemy);
      }
    }

    // Update dissolved phase bricks restoration timer
    for (let i = this.dissolvedBricks.length - 1; i >= 0; i--) {
      const brick = this.dissolvedBricks[i];
      brick.timer -= dt;

      // Flash warning when about to rebuild
      if (brick.timer <= 0.8 && Math.floor(brick.timer * 10) % 2 === 0) {
        this.addSparkles(
          brick.col * TILE_SIZE + 16,
          brick.row * TILE_SIZE + 16,
          "#ffcc00",
          2,
        );
      }

      if (brick.timer <= 0) {
        const brickLeft = brick.col * TILE_SIZE;
        const brickRight = brickLeft + TILE_SIZE;
        const brickTop = brick.row * TILE_SIZE;
        const brickBottom = brickTop + TILE_SIZE;

        // Check if any entity currently overlaps this phase brick tile
        const isOccupied = entities.some((e) => {
          const eLeft = e.x;
          const eRight = e.x + e.width;
          const eTop = e.y;
          const eBottom = e.y + e.height;
          return (
            eLeft < brickRight &&
            eRight > brickLeft &&
            eTop < brickBottom &&
            eBottom > brickTop
          );
        });

        if (isOccupied) {
          // Delay re-solidification while occupied so entities don't get trapped inside solid geometry
          brick.timer = 0.4;
          this.addSparkles(
            brick.col * TILE_SIZE + 16,
            brick.row * TILE_SIZE + 16,
            "#ffaa00",
            3,
          );
        } else {
          // Re-solidify brick cleanly via restoreTile event
          this.restoreTile(brick.col, brick.row);
        }
      }
    }

    // Update particles
    if (this.particles) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt;

        if (p.isSmoke) {
          p.size = Math.min(10, p.size + dt * 6);
          p.vy -= dt * 12; // Gently float upward
        } else {
          p.size = Math.max(0, p.size - dt * 2);
        }

        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    // Update Debris Physics & Particle Spawning
    if (this.debris) {
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const d = this.debris[i];
        d.life -= dt;
        if (d.life <= 0) {
          this.debris.splice(i, 1);
          continue;
        }

        if (d.type === "shockwave") {
          if (d.radius !== undefined && d.speed !== undefined) {
            d.radius += d.speed * dt;
          }
          continue;
        }

        // Gravity & Velocity
        if (d.gravity) {
          d.vy += d.gravity * dt;
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.rotSpeed) {
          d.rot += d.rotSpeed * dt;
        }

        // Tile Collision & Bouncing for physical debris
        if (d.bounce) {
          const col = Math.floor(d.x / TILE_SIZE);
          const row = Math.floor(d.y / TILE_SIZE);
          if (this.isSolid(col, row)) {
            d.vy = -d.vy * d.bounce;
            d.vx *= 0.65;
            d.y += d.vy * dt * 2;
            d.rotSpeed *= -0.4;
            if (Math.abs(d.vy) < 20) d.vy = 0;
          }
        }
      }
    }
  }

  addDeathExplosion(x: number, y: number, facingRight: boolean = true): void {
    if (!this.effectsEnabled) return;

    const packX = facingRight ? x - 4 : x + 18;
    const packY = y + 6;

    // 1. JETPACK BREAKING INTO PARTS:
    this.debris.push({
      type: "jetpack_top",
      x: packX,
      y: packY,
      vx: (facingRight ? -70 : 70) + (Math.random() - 0.5) * 30,
      vy: -150 - Math.random() * 40,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 14,
      gravity: 450,
      life: 2.0,
      maxLife: 2.0,
      bounce: 0.5,
    });

    this.debris.push({
      type: "jetpack_bottom",
      x: packX,
      y: packY + 8,
      vx: (facingRight ? -40 : 40) + (Math.random() - 0.5) * 40,
      vy: -110 - Math.random() * 40,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 16,
      gravity: 480,
      life: 2.0,
      maxLife: 2.0,
      bounce: 0.5,
    });

    this.debris.push({
      type: "fuel_cell",
      x: packX + 1,
      y: packY + 2,
      vx: (facingRight ? -110 : 110) + (Math.random() - 0.5) * 50,
      vy: -180 - Math.random() * 50,
      rot: 0,
      rotSpeed: (facingRight ? -1 : 1) * (15 + Math.random() * 10),
      gravity: 500,
      life: 2.0,
      maxLife: 2.0,
      bounce: 0.6,
    });

    this.debris.push({
      type: "nozzle",
      x: packX + 1,
      y: packY + 14,
      vx: (facingRight ? -30 : 30) + (Math.random() - 0.5) * 50,
      vy: -90 - Math.random() * 30,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 20,
      gravity: 520,
      life: 1.8,
      maxLife: 1.8,
      bounce: 0.4,
    });

    // 2. CHARACTER / SUIT PARTS:
    this.debris.push({
      type: "helmet",
      x: x + 11,
      y: y + 6,
      vx: (facingRight ? 30 : -30) + (Math.random() - 0.5) * 40,
      vy: -130 - Math.random() * 40,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 10,
      gravity: 450,
      life: 2.0,
      maxLife: 2.0,
      bounce: 0.55,
    });

    this.debris.push({
      type: "suit",
      x: x + 4,
      y: y + 8,
      vx: (Math.random() - 0.5) * 30,
      vy: -60 - Math.random() * 30,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 6,
      gravity: 500,
      life: 1.8,
      maxLife: 1.8,
      bounce: 0.4,
    });

    this.debris.push({
      type: "boot",
      x: x + 4,
      y: y + 22,
      vx: -35 + (Math.random() - 0.5) * 20,
      vy: -80 - Math.random() * 30,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 550,
      life: 1.8,
      maxLife: 1.8,
      bounce: 0.5,
    });
    this.debris.push({
      type: "boot",
      x: x + 13,
      y: y + 22,
      vx: 35 + (Math.random() - 0.5) * 20,
      vy: -90 - Math.random() * 30,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 550,
      life: 1.8,
      maxLife: 1.8,
      bounce: 0.5,
    });
  }

  addSparkles(
    x: number,
    y: number,
    color: string = "#00ffcc",
    count: number = 8,
  ): void {
    if (!this.effectsEnabled || !this.particles) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 20;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * 0.016,
        vy: Math.sin(angle) * speed * 0.016,
        color,
        size: Math.random() * 4 + 2,
        life: Math.random() * 0.4 + 0.2,
        maxLife: 0.6,
      });
    }
  }

  // Canvas Render Engine for TileMap
  render(ctx: CanvasRenderingContext2D, isEditor: boolean = false): void {
    ctx.clearRect(0, 0, this.cols * TILE_SIZE, this.rows * TILE_SIZE);

    // Draw Background Grid Lines
    ctx.strokeStyle = "rgba(0, 255, 204, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= this.cols; c++) {
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, this.rows * TILE_SIZE);
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(this.cols * TILE_SIZE, r * TILE_SIZE);
    }
    ctx.stroke();

    // Render Tiles
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.getTile(c, r);
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

        this.renderTile(ctx, tile, x, y, c, r);
      }
    }

    // Render Dissolved Phase Bricks Ghost Outlines
    for (let b of this.dissolvedBricks) {
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
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Debris Objects Layer
    for (let d of this.debris) {
      const alpha = Math.max(0, Math.min(1, d.life / (d.maxLife || 1)));
      ctx.save();
      ctx.globalAlpha = alpha;

      if (d.type === "helmet") {
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

  renderTile(
    ctx: CanvasRenderingContext2D,
    tile: number,
    x: number,
    y: number,
    c: number,
    r: number,
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
        const arrow = tile === TILES.CONVEYOR_LEFT ? "◄" : "►";
        ctx.fillText(arrow, x + 8, y + 22);
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

      case TILES.EMERALD: {
        const hoverOffset = Math.sin(Date.now() / 250) * 1.5;
        const cx = x + 16;
        const cy = y + 16 + hoverOffset;
        const pulseGlow = (Math.sin(Date.now() / 180) + 1) * 0.5;

        const glowRadius = 17 + pulseGlow * 2.5;
        const outerGlow = ctx.createRadialGradient(
          cx,
          cy,
          2,
          cx,
          cy,
          glowRadius,
        );
        outerGlow.addColorStop(
          0,
          `rgba(0, 255, 136, ${0.5 + pulseGlow * 0.25})`,
        );
        outerGlow.addColorStop(
          0.5,
          `rgba(0, 255, 204, ${0.2 + pulseGlow * 0.15})`,
        );
        outerGlow.addColorStop(1, "rgba(0, 255, 136, 0)");
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        const pTL = { x: cx - 6.5, y: cy - 10 };
        const pTR = { x: cx + 6.5, y: cy - 10 };
        const pML = { x: cx - 11, y: cy - 3 };
        const pMR = { x: cx + 11, y: cy - 3 };
        const pB = { x: cx, y: cy + 11 };
        const pC = { x: cx, y: cy - 2 };

        const pCrownL = { x: cx - 3.5, y: cy - 3 };
        const pCrownR = { x: cx + 3.5, y: cy - 3 };

        ctx.fillStyle = "#003c73";
        ctx.beginPath();
        ctx.moveTo(pML.x, pML.y);
        ctx.lineTo(pCrownL.x, pCrownL.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#00549e";
        ctx.beginPath();
        ctx.moveTo(pCrownL.x, pCrownL.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#006ec7";
        ctx.beginPath();
        ctx.moveTo(pCrownR.x, pCrownR.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#0085ed";
        ctx.beginPath();
        ctx.moveTo(pMR.x, pMR.y);
        ctx.lineTo(pCrownR.x, pCrownR.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#009ee3";
        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pML.x, pML.y);
        ctx.lineTo(pCrownL.x, pCrownL.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#1ad1ff";
        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pCrownL.x, pCrownL.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#4de1ff";
        ctx.beginPath();
        ctx.moveTo(pTR.x, pTR.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.lineTo(pCrownR.x, pCrownR.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#00c3ff";
        ctx.beginPath();
        ctx.moveTo(pTR.x, pTR.y);
        ctx.lineTo(pCrownR.x, pCrownR.y);
        ctx.lineTo(pMR.x, pMR.y);
        ctx.closePath();
        ctx.fill();

        const tableGrad = ctx.createLinearGradient(pTL.x, pTL.y, pTR.x, pC.y);
        tableGrad.addColorStop(0, "#ffffff");
        tableGrad.addColorStop(0.35, "#cceeff");
        tableGrad.addColorStop(0.7, "#80dfff");
        tableGrad.addColorStop(1, "#33ccff");
        ctx.fillStyle = tableGrad;
        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.lineTo(pMR.x, pMR.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.lineTo(pML.x, pML.y);
        ctx.closePath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pCrownL.x, pCrownL.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.moveTo(pTR.x, pTR.y);
        ctx.lineTo(pCrownR.x, pCrownR.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.moveTo(pML.x, pML.y);
        ctx.lineTo(pCrownL.x, pCrownL.y);
        ctx.moveTo(pMR.x, pMR.y);
        ctx.lineTo(pCrownR.x, pCrownR.y);
        ctx.moveTo(pCrownL.x, pCrownL.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.lineTo(pCrownR.x, pCrownR.y);
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.moveTo(pC.x, pC.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        const flareTime = Date.now() / 180;
        const flareSize = (Math.sin(flareTime) + 1) * 3 + 2.5;
        const flareAlpha = (Math.sin(flareTime) + 1) * 0.4 + 0.5;
        const fx = pTL.x + 1;
        const fy = pTL.y + 1;

        ctx.strokeStyle = `rgba(255, 255, 255, ${flareAlpha})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(fx - flareSize, fy);
        ctx.lineTo(fx + flareSize, fy);
        ctx.moveTo(fx, fy - flareSize);
        ctx.lineTo(fx, fy + flareSize);
        const diag = flareSize * 0.6;
        ctx.moveTo(fx - diag, fy - diag);
        ctx.lineTo(fx + diag, fy + diag);
        ctx.moveTo(fx + diag, fy - diag);
        ctx.lineTo(fx - diag, fy + diag);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case TILES.FUEL: {
        const now = Date.now();
        const hoverY = Math.sin(now / 220) * 1.5;
        const pulse = (Math.sin(now / 180) + 1) * 0.5;
        const cx = x + 16;
        const cy = y + 16 + hoverY;

        ctx.save();

        const outerGlow = ctx.createRadialGradient(
          cx,
          cy,
          2,
          cx,
          cy,
          16 + pulse * 2,
        );
        outerGlow.addColorStop(0, `rgba(255, 170, 0, ${0.45 + pulse * 0.2})`);
        outerGlow.addColorStop(0.6, `rgba(255, 80, 0, ${0.15 + pulse * 0.1})`);
        outerGlow.addColorStop(1, "rgba(255, 80, 0, 0)");
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, 16 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        const shadowScale = Math.max(0.6, 1 - hoverY * 0.12);
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(
          cx,
          y + 29,
          8 * shadowScale,
          2.5 * shadowScale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const w = 16;
        const h = 18;
        const bx = cx - w / 2;
        const by = cy - h / 2 + 2;

        ctx.fillStyle = "#1c2833";
        ctx.fillRect(cx - 6, by - 5, 12, 3);

        ctx.fillStyle = "#bdc3c7";
        ctx.fillRect(cx - 5, by - 5, 3, 2);
        ctx.fillRect(cx - 1, by - 5, 3, 2);
        ctx.fillRect(cx + 3, by - 5, 3, 2);

        ctx.fillStyle = "#d35400";
        ctx.fillRect(bx + 1, by - 4, 4, 3);
        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(bx + 1.5, by - 5, 3, 1.5);

        const bodyGrad = ctx.createLinearGradient(bx, 0, bx + w, 0);
        bodyGrad.addColorStop(0, "#b02a00");
        bodyGrad.addColorStop(0.25, "#e74c3c");
        bodyGrad.addColorStop(0.55, "#ff5522");
        bodyGrad.addColorStop(0.75, "#ff8800");
        bodyGrad.addColorStop(1, "#800c2f");

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(bx, by, w, h, 2);
        } else {
          ctx.rect(bx, by, w, h);
        }
        ctx.fill();

        ctx.strokeStyle = "#200500";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(bx + 3, by + 3);
        ctx.lineTo(bx + w - 3, by + h - 3);
        ctx.moveTo(bx + w - 3, by + 3);
        ctx.lineTo(bx + 3, by + h - 3);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 3.5, by + 4);
        ctx.lineTo(bx + w - 3.5, by + h - 2);
        ctx.moveTo(bx + w - 3.5, by + 4);
        ctx.lineTo(bx + 3.5, by + h - 2);
        ctx.stroke();

        const fx = cx;
        const fy = by + h / 2 - 0.5;

        ctx.fillStyle = "#ff2200";
        ctx.beginPath();
        ctx.moveTo(fx, fy - 5);
        ctx.bezierCurveTo(fx + 4, fy - 1, fx + 4, fy + 4, fx, fy + 4);
        ctx.bezierCurveTo(fx - 4, fy + 4, fx - 4, fy - 1, fx, fy - 5);
        ctx.fill();

        ctx.fillStyle = "#ffeb3b";
        ctx.beginPath();
        ctx.moveTo(fx, fy - 3);
        ctx.bezierCurveTo(fx + 2.5, fy, fx + 2.5, fy + 3, fx, fy + 3);
        ctx.bezierCurveTo(fx - 2.5, fy + 3, fx - 2.5, fy, fx, fy - 3);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(fx, fy - 1);
        ctx.bezierCurveTo(fx + 1.2, fy + 0.8, fx + 1.2, fy + 2, fx, fy + 2);
        ctx.bezierCurveTo(fx - 1.2, fy + 2, fx - 1.2, fy + 0.8, fx, fy - 1);
        ctx.fill();

        const gw = 2.5;
        const gh = 10;
        const gx = bx + w - 3.5;
        const gy = by + 4;

        ctx.fillStyle = "#100500";
        ctx.fillRect(gx, gy, gw, gh);

        const slosh = Math.sin(now / 150) * 0.5;
        const fillH = 7 + slosh;
        const fillY = gy + (gh - fillH);

        const fuelGrad = ctx.createLinearGradient(0, fillY, 0, gy + gh);
        fuelGrad.addColorStop(0, "#ffee00");
        fuelGrad.addColorStop(1, "#ff5500");

        ctx.fillStyle = fuelGrad;
        ctx.fillRect(gx, fillY, gw, gh - (fillY - gy));

        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillRect(bx + 1.5, by + 2, 1.2, h - 4);

        const glintTime = now / 180;
        const glintAlpha = (Math.sin(glintTime) + 1) * 0.45 + 0.1;
        const glintSize = (Math.sin(glintTime) + 1) * 1.5 + 1;
        const capGx = bx + 3;
        const capGy = by - 4;

        ctx.strokeStyle = `rgba(255, 255, 255, ${glintAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(capGx - glintSize, capGy);
        ctx.lineTo(capGx + glintSize, capGy);
        ctx.moveTo(capGx, capGy - glintSize);
        ctx.lineTo(capGx, capGy + glintSize);
        ctx.stroke();

        ctx.restore();
        break;
      }

      case TILES.GOLD:
        ctx.fillStyle = "#f1c40f";
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d35400";
        ctx.stroke();
        break;

      case TILES.SPAWN:
        ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = "#00ffcc";
        ctx.font = "10px Orbitron, sans-serif";
        ctx.fillText("START", x + 2, y + 20);
        break;

      case TILES.EXIT_PORTAL:
        const isUnlocked = this.collectedEmeralds >= this.totalEmeralds;
        ctx.save();
        ctx.translate(x + 16, y + 16);
        ctx.rotate(this.portalAngle);

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

      case TILES.TELEPORTER: {
        const now = Date.now();
        const pulse = (Math.sin(now / 150) + 1) * 0.5;
        const rot = (now / 350) % (Math.PI * 2);
        const cx = x + 16;
        const cy = y + 16;

        ctx.save();

        const glow = ctx.createRadialGradient(
          cx,
          cy,
          2,
          cx,
          cy,
          17 + pulse * 2,
        );
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

        // High-visibility outer glow & white outline
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

        // Vibrant missile body gradient
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

        // Yellow hazard stripe
        ctx.fillStyle = "#ffee00";
        ctx.fillRect(-2, -5, 4, 10);
        ctx.fillStyle = "#111111";
        ctx.fillRect(0, -5, 2, 10);

        // Bright fins
        ctx.fillStyle = "#ff0033";
        ctx.fillRect(-8, -9, 4, 4);
        ctx.fillRect(-8, 5, 4, 4);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(-8, -9, 4, 4);
        ctx.strokeRect(-8, 5, 4, 4);

        // Thruster flame preview
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

        // Pulsing Tip Beacon
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

      case TILES.EXTRA_LIFE: {
        const now = Date.now();
        const hoverY = Math.sin(now / 220) * 1.8;
        const pulse = (Math.sin(now / 180) + 1) * 0.5;
        const cx = x + 16;
        const cy = y + 16 + hoverY;

        ctx.save();

        // Pulsing glow aura
        const glowRadius = 16 + pulse * 2.5;
        const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRadius);
        glow.addColorStop(0, `rgba(255, 45, 85, ${0.5 + pulse * 0.25})`);
        glow.addColorStop(0.5, `rgba(255, 120, 160, ${0.25 + pulse * 0.15})`);
        glow.addColorStop(1, "rgba(255, 45, 85, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Ground shadow
        const shadowScale = Math.max(0.6, 1 - hoverY * 0.12);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(cx, y + 29, 7 * shadowScale, 2.2 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Heart shape bezier
        const heartGrad = ctx.createLinearGradient(cx - 8, cy - 8, cx + 8, cy + 8);
        heartGrad.addColorStop(0, "#ff5e83");
        heartGrad.addColorStop(0.5, "#ff2d55");
        heartGrad.addColorStop(1, "#c0002d");

        ctx.fillStyle = heartGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 8);
        ctx.bezierCurveTo(cx - 10, cy + 2, cx - 11, cy - 6, cx - 5, cy - 8);
        ctx.bezierCurveTo(cx - 2, cy - 8, cx, cy - 5, cx, cy - 4);
        ctx.bezierCurveTo(cx, cy - 5, cx + 2, cy - 8, cx + 5, cy - 8);
        ctx.bezierCurveTo(cx + 11, cy - 6, cx + 10, cy + 2, cx, cy + 8);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Highlight sheen
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.beginPath();
        ctx.arc(cx - 3.5, cy - 4.5, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }
    }
  }
}
