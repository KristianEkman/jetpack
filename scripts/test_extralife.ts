import assert from "node:assert/strict";
import { TILES, PLAYER_PHYSICS, GAME_EVENTS, TILE_SIZE } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { Player } from "../js/entities/player.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { PALETTE } from "../js/editor/level_editor.js";

console.log("🧪 Running Extra Life Feature Test Suite...\n");

// 1. Check Constants
console.log("1️⃣  Testing Constants...");
assert.equal(TILES.EXTRA_LIFE, 19, "TILES.EXTRA_LIFE must be 19");
assert.equal(PLAYER_PHYSICS.MAX_LIVES, 9, "PLAYER_PHYSICS.MAX_LIVES must be 9");
assert.equal(PLAYER_PHYSICS.SCORE_PER_EXTRA_LIFE, 10000, "SCORE_PER_EXTRA_LIFE must be 10000");
console.log("   ✅ Constants verified.");

// 2. Check PALETTE in Level Editor
console.log("2️⃣  Testing Palette Integration...");
const extraLifePaletteItem = PALETTE.find((item) => item.type === TILES.EXTRA_LIFE);
assert.ok(extraLifePaletteItem, "Extra Life must exist in Level Editor PALETTE");
assert.equal(extraLifePaletteItem.icon, "❤️");
console.log("   ✅ Palette item verified.");

// 3. Check Campaign Level Parsing for Extra Life
console.log("3️⃣  Testing Campaign Level Parsing...");
let foundExtraLifeInCampaign = false;
for (const level of CAMPAIGN_LEVELS) {
  if (level.grid.includes(TILES.EXTRA_LIFE)) {
    foundExtraLifeInCampaign = true;
    break;
  }
}
assert.ok(foundExtraLifeInCampaign, "Campaign levels should include TILES.EXTRA_LIFE items");
console.log("   ✅ Campaign levels verified.");

// 4. Test Player Collecting EXTRA_LIFE Tile
console.log("4️⃣  Testing Player Collecting EXTRA_LIFE Tile...");
const tileMap = new TileMap();
// Create empty grid
tileMap.cols = 30;
tileMap.rows = 18;
tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
tileMap.grid[1 + 1 * 30] = TILES.EXTRA_LIFE;

const player = new Player(null as any, tileMap);
player.x = 32;
player.y = 32;
player.lives = 3;
player.score = 0;

let itemCollectedPayload: any = null;
tileMap.on(GAME_EVENTS.ITEM_COLLECTED, (payload: any) => {
  itemCollectedPayload = payload;
});

// Trigger tile collision
player.checkCollectibles();

assert.equal(tileMap.getTile(1, 1), TILES.AIR, "Extra Life tile should be set to AIR upon pickup");
assert.equal(player.lives, 4, "Player lives should increase from 3 to 4");
assert.equal(player.score, 1000, "Player score should increase by 1000");
assert.ok(itemCollectedPayload, "ITEM_COLLECTED event should be emitted");
assert.equal(itemCollectedPayload.tileType, TILES.EXTRA_LIFE);
assert.equal(itemCollectedPayload.lives, 4);
console.log("   ✅ Player pickup logic verified.");

// 5. Test Score Milestone Extra Life & Max Lives Cap
console.log("5️⃣  Testing Score Milestone & Max Lives Cap...");
player.lives = 8;
player.score = 9500;

// Adding 600 points crosses 10,000 pts milestone
player.addScore(600);
assert.equal(player.score, 10100);
assert.equal(player.lives, 9, "Player lives should increase to 9 at 10,000 pts milestone");

// Adding another 20,000 points shouldn't exceed MAX_LIVES cap of 9
player.addScore(20000);
assert.equal(player.score, 30100);
assert.equal(player.lives, 9, "Player lives should be capped at MAX_LIVES (9)");
console.log("   ✅ Score milestone & max lives cap verified.");

console.log("\n🎉 ALL EXTRA LIFE TESTS PASSED CLEANLY!");
