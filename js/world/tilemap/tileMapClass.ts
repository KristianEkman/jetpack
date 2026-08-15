import { EnemyManager } from "../../entities/enemy/index.js";
import { Player } from "../../entities/player.js";
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TILES,
  GAME_EVENTS,
} from "../../shared/constants.js";
import { LevelData } from "../../shared/payloads.js";
import { ParticleSpec } from "../../shared/types.js";
import {
  DebrisObject,
  DissolvedBrick,
  TeleporterPad,
  TileMapListener,
} from "./types.js";
import {
  addDeathExplosion as addDeathExplosionEffect,
  addSparkles as addSparklesEffect,
  updateDebris,
  updateParticles,
} from "./tileEffects.js";
import { renderTile as renderSingleTile, renderTileMap } from "./tileRenderer.js";

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
  collectedExtraLifePositions: Set<string>;

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
    this.collectedExtraLifePositions = new Set();

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

  on<T = any>(event: string, callback: TileMapListener<T>): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback as TileMapListener);
  }

  off<T = any>(event: string, callback: TileMapListener<T>): void {
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

  markExtraLifeCollected(col: number, row: number): void {
    this.collectedExtraLifePositions.add(`${col},${row}`);
  }

  resetExtraLifeState(): void {
    this.collectedExtraLifePositions.clear();
  }

  loadLevelData(levelData: LevelData, isRestart: boolean = false): void {
    this.grid = [...levelData.grid];
    if (!isRestart) {
      this.resetExtraLifeState();
    } else {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.collectedExtraLifePositions.has(`${c},${r}`)) {
            this.grid[r * this.cols + c] = TILES.AIR;
          }
        }
      }
    }
    this.dissolvedBricks = [];
    this.particles = [];
    this.debris = [];
    this.collectedEmeralds = 0;
    this.countTotalEmeralds();
    this.rebuildTeleporters();
    this.rebuildSpawnPoints(levelData);
  }

  rebuildSpawnPoints(levelData?: LevelData): void {
    this.spawnPoints = [];
    if (levelData && typeof levelData.spawnX === "number" && typeof levelData.spawnY === "number") {
      this.spawnPoints.push({ x: levelData.spawnX, y: levelData.spawnY });
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r * this.cols + c] === TILES.SPAWN) {
          const spX = c * TILE_SIZE + 4;
          const spY = r * TILE_SIZE + 2;
          if (!this.spawnPoints.some((p) => p.x === spX && p.y === spY)) {
            this.spawnPoints.push({ x: spX, y: spY });
          }
        }
      }
    }
    if (this.spawnPoints.length === 0) {
      this.spawnPoints.push({ x: 128, y: 100 });
    }
  }

  getPrimarySpawnPoint(): { x: number; y: number } {
    if (!this.spawnPoints || this.spawnPoints.length === 0) {
      this.rebuildSpawnPoints();
    }
    return this.spawnPoints[0] || { x: 128, y: 100 };
  }

  getTile(col: number, row: number): number {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return TILES.BRICK; // Out of bounds is solid brick
    }
    return this.grid[row * this.cols + col];
  }

  setTile(col: number, row: number, tileType: number): void {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      if (this.getTile(col, row) === TILES.EXTRA_LIFE && tileType === TILES.AIR) {
        this.markExtraLifeCollected(col, row);
      }
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
    return (
      tile === TILES.BRICK ||
      tile === TILES.PHASE_BRICK ||
      tile === TILES.ICE ||
      tile === TILES.CONVEYOR_LEFT ||
      tile === TILES.CONVEYOR_RIGHT
    );
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

    // Update particles & debris
    updateParticles(this.particles, dt);
    updateDebris(this.debris, dt, (c, r) => this.isSolid(c, r));
  }

  addDeathExplosion(x: number, y: number, facingRight: boolean = true): void {
    addDeathExplosionEffect(
      this.debris,
      x,
      y,
      facingRight,
      this.effectsEnabled,
    );
  }

  addSparkles(
    x: number,
    y: number,
    color: string = "#00ffcc",
    count: number = 8,
  ): void {
    addSparklesEffect(
      this.particles,
      x,
      y,
      color,
      count,
      this.effectsEnabled,
    );
  }

  isExitUnlocked(enemyManager?: EnemyManager | null): boolean {
    const emeraldsCleared = this.collectedEmeralds >= this.totalEmeralds;
    const bossAlive = enemyManager ? enemyManager.hasAliveBoss() : false;
    return emeraldsCleared && !bossAlive;
  }

  render(
    ctx: CanvasRenderingContext2D,
    isEditor: boolean = false,
    enemyManager?: EnemyManager | null,
  ): void {
    const hasBoss = enemyManager ? enemyManager.hasAliveBoss() : false;
    renderTileMap(
      ctx,
      this.cols,
      this.rows,
      (c, r) => this.getTile(c, r),
      this.dissolvedBricks,
      this.particles,
      this.debris,
      this.portalAngle,
      this.collectedEmeralds,
      this.totalEmeralds,
      isEditor,
      hasBoss,
    );
  }

  renderTile(
    ctx: CanvasRenderingContext2D,
    tile: number,
    x: number,
    y: number,
    c: number,
    r: number,
    hasBoss: boolean = false,
  ): void {
    renderSingleTile(
      ctx,
      tile,
      x,
      y,
      c,
      r,
      this.portalAngle,
      this.collectedEmeralds,
      this.totalEmeralds,
      hasBoss,
    );
  }
}
