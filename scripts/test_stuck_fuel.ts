import assert from "node:assert/strict";
import { TILES, TILE_SIZE } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { Player } from "../js/entities/player.js";

console.log("🧪 Running Stuck & Fuel K-Key Test Suite...\n");

// 1. Create a sealed room where player is trapped
console.log("1️⃣  Setting up sealed tilemap environment...");
const tileMap = new TileMap();
tileMap.cols = 10;
tileMap.rows = 10;
tileMap.grid = new Array(10 * 10).fill(TILES.BRICK); // Fill all with solid BRICK

// Carve a 1x1 air pocket at col 2, row 2 for the player
const playerCol = 2;
const playerRow = 2;
tileMap.grid[playerCol + playerRow * tileMap.cols] = TILES.AIR;
tileMap.grid[playerCol + (playerRow + 1) * tileMap.cols] = TILES.BRICK; // Solid floor beneath

const player = new Player(null as any, tileMap);
player.x = playerCol * TILE_SIZE;
player.y = playerRow * TILE_SIZE;
player.fuel = 0; // Out of fuel!
player.isGrounded = true;

assert.equal(player.isStuck, false, "Initial player.isStuck must be false");
assert.equal(player.isDead, false, "Initial player.isDead must be false");
console.log("   ✅ Environment initialized.");

// 2. Run checkStuck for 2 simulated seconds
console.log("2️⃣  Testing checkStuck with 0 fuel in trapped room...");
for (let i = 0; i < 20; i++) {
  player.checkStuck(0.1);
}

assert.equal(player.isStuck, true, "player.isStuck must be true when trapped with 0 fuel");
assert.equal(player.isDead, false, "player.isDead MUST remain false (must NOT be killed automatically)");
console.log("   ✅ Player is marked as stuck but NOT killed.");

// 3. Test suicide input (pressing 'K' key)
console.log("3️⃣  Testing pressing 'K' key (suicide input)...");
player.processLocalEffects(0.1, {
  left: false,
  right: false,
  up: false,
  down: false,
  thrust: false,
  phase: false,
  suicide: true, // K key pressed
  sequenceId: 1
}, null);

assert.equal(player.isDead, true, "Pressing K key must set player.isDead to true");
assert.equal(player.isStuck, false, "Dead player must have player.isStuck set to false");
console.log("   ✅ Pressing 'K' key self-destructs player.");

console.log("\n🎉 ALL STUCK & FUEL K-KEY TESTS PASSED CLEANLY!");
