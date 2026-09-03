/* ==========================================================================
   FIREWORKS SHOW
   Celebration effect for the campaign-complete finale: periodic sparkle
   bursts and shockwave rings erupting over the tile map. DOM-free and
   Node-safe so it stays runnable under tsx (tests, server).
   ========================================================================== */

import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "../shared/constants.js";
import { TileMap } from "./tilemap.js";

const FIREWORK_COLORS = [
  "#ffd700",
  "#ff2a5f",
  "#00ffcc",
  "#33ff77",
  "#00e5ff",
  "#ff9f1c",
  "#c77dff",
];

const SPARKLES_PER_BURST = 42;
const SHOCKWAVE_EVERY_N_BURSTS = 3;

export class FireworksShow {
  spawnTimer: number;
  burstCount: number;

  constructor() {
    this.spawnTimer = 0;
    this.burstCount = 0;
  }

  reset(): void {
    this.spawnTimer = 0;
    this.burstCount = 0;
  }

  update(dt: number, tileMap: TileMap): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = 0.35 + Math.random() * 0.35;

    const mapWidth = GRID_COLS * TILE_SIZE;
    const mapHeight = GRID_ROWS * TILE_SIZE;
    const x = (0.1 + Math.random() * 0.8) * mapWidth;
    const y = (0.08 + Math.random() * 0.5) * mapHeight;
    const color = FIREWORK_COLORS[this.burstCount % FIREWORK_COLORS.length];

    tileMap.addSparkles(x, y, color, SPARKLES_PER_BURST);
    if (this.burstCount % SHOCKWAVE_EVERY_N_BURSTS === 0) {
      tileMap.addShockwave(x, y, color);
    }

    this.burstCount++;
  }
}
