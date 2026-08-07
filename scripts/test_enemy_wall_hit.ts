import assert from "node:assert/strict";
import { TILES, TILE_SIZE } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy/index.js";
import { Player } from "../js/entities/player.js";

console.log("🧪 Running Test Case: Hitting Enemies Through Walls Protection...\n");

// Setup TileMap
const tileMap = new TileMap();
tileMap.cols = 30;
tileMap.rows = 18;
tileMap.grid = new Array(30 * 18).fill(TILES.AIR);

// 1. Place a solid brick wall column at column 2 (x = 64..96)
for (let r = 0; r < 18; r++) {
  tileMap.grid[r * 30 + 2] = TILES.BRICK;
}

// 2. Setup EnemyManager and place an enemy BEHIND the solid wall (at x = 100, column 3)
const enemyManager = new EnemyManager(tileMap);
enemyManager.addFlitzer(100, 32); // Enemy behind wall at x=100..120, y=32..52

assert.equal(enemyManager.enemies.length, 1, "Enemy should exist behind wall");
const enemy = enemyManager.enemies[0];
const enemyId = enemy.id;

// 3. Setup Player in front of the wall (at x = 0, y = 32, facing right)
const player = new Player(null as any, tileMap);
player.x = 0;
player.y = 32;
player.facingRight = true;

console.log("📍 Initial State:");
console.log(`   Player at x=${player.x}, y=${player.y} (facing right)`);
console.log(`   Solid Wall at column 2 (x=64..96)`);
console.log(`   Enemy '${enemyId}' at x=${enemy.x}, y=${enemy.y} (BEHIND the wall)`);

// 4. Trigger player phase beam attack with input
const input = {
  sequenceId: 1,
  left: false,
  right: false,
  up: false,
  down: false,
  thrust: false,
  phase: true,
  suicide: false,
};

// Execute player update / local effects
player.update(0.01, input, enemyManager);

console.log("\n💥 Fired Phase Beam towards wall...");

// 5. Verify: Enemy behind solid wall MUST NOT be damaged or destroyed!
const remainingEnemies = enemyManager.enemies.length;
console.log(`   Remaining enemies: ${remainingEnemies}`);

assert.equal(
  remainingEnemies,
  1,
  "Enemy behind solid wall was incorrectly destroyed by Phase Beam!",
);

console.log("✅ Enemy behind solid wall was safely protected by wall collision!");
console.log("\n🎉 TEST PASSED: Enemies CANNOT be hit through walls!");
