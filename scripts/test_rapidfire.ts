import assert from "node:assert/strict";
import { TILES, PLAYER_PHYSICS, GAME_EVENTS } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { Player } from "../js/entities/player.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { PALETTE } from "../js/editor/level_editor.js";

console.log("🧪 Running Rapid Fire Power-Up Test Suite...\n");

// 1. Check Constants
console.log("1️⃣  Testing Constants...");
assert.equal(TILES.RAPID_FIRE, 21, "TILES.RAPID_FIRE must be 21");
assert.equal(PLAYER_PHYSICS.RAPID_FIRE_DURATION, 15.0, "RAPID_FIRE_DURATION must be 15 seconds");
assert.equal(PLAYER_PHYSICS.RAPID_FIRE_COOLDOWN, 0.08, "RAPID_FIRE_COOLDOWN must be 0.08 seconds");
console.log("   ✅ Constants verified.");

// 2. Check Level Editor Palette
console.log("2️⃣  Testing Palette Integration...");
const rapidFirePaletteItem = PALETTE.find((item) => item.type === TILES.RAPID_FIRE);
assert.ok(rapidFirePaletteItem, "Rapid Fire must exist in Level Editor PALETTE");
assert.equal(rapidFirePaletteItem.icon, "⚡");
console.log("   ✅ Palette item verified.");

// 3. Check Campaign Level Parsing for Rapid Fire
console.log("3️⃣  Testing Campaign Level Parsing...");
let foundRapidFireInCampaign = false;
for (const level of CAMPAIGN_LEVELS) {
  if (level.grid.includes(TILES.RAPID_FIRE)) {
    foundRapidFireInCampaign = true;
    break;
  }
}
assert.ok(foundRapidFireInCampaign, "Campaign levels should include TILES.RAPID_FIRE items");
console.log("   ✅ Campaign levels verified.");

// 4. Test Player Collecting RAPID_FIRE Tile
console.log("4️⃣  Testing Player Collecting RAPID_FIRE Tile...");
const tileMap = new TileMap();
tileMap.cols = 30;
tileMap.rows = 18;
tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
tileMap.grid[1 + 1 * 30] = TILES.RAPID_FIRE;

const player = new Player(null as any, tileMap);
player.x = 32;
player.y = 32;
player.score = 0;
assert.equal(player.rapidFireTimer, 0, "Initial rapidFireTimer must be 0");
assert.equal(player.isRapidFireActive(), false, "isRapidFireActive must be false initially");

let itemCollectedPayload: any = null;
tileMap.on(GAME_EVENTS.ITEM_COLLECTED, (payload: any) => {
  itemCollectedPayload = payload;
});

// Trigger pickup collision
player.checkCollectibles();

assert.equal(tileMap.getTile(1, 1), TILES.AIR, "Rapid Fire tile should be set to AIR upon pickup");
assert.equal(player.rapidFireTimer, 15.0, "rapidFireTimer must be set to 15.0s");
assert.equal(player.isRapidFireActive(), true, "isRapidFireActive must be true after pickup");
assert.equal(player.score, 300, "Player score should increase by 300");
assert.ok(itemCollectedPayload, "ITEM_COLLECTED event should be emitted");
assert.equal(itemCollectedPayload.tileType, TILES.RAPID_FIRE);
assert.equal(itemCollectedPayload.rapidFireTimer, 15.0);
console.log("   ✅ Player pickup logic verified.");

// 5. Test Firing Cooldown Accelerates with Rapid Fire
console.log("5️⃣  Testing Rapid Fire Firing Cooldown...");
player.rapidFireTimer = 10.0;
player.phaseCooldown = 0;

// Fire phase beam
player.performPhaseBeam(null);
assert.equal(
  player.phaseCooldown,
  PLAYER_PHYSICS.RAPID_FIRE_COOLDOWN,
  "Phase cooldown during rapid fire must be 0.08s",
);

// Without rapid fire
player.rapidFireTimer = 0;
player.phaseCooldown = 0;
player.performPhaseBeam(null);
assert.equal(
  player.phaseCooldown,
  PLAYER_PHYSICS.PHASE_COOLDOWN_TIME,
  "Normal phase cooldown must be 0.3s",
);
console.log("   ✅ Firing cooldown speedup verified.");

// 6. Test Timer Decrement and Expiration over Simulation
console.log("6️⃣  Testing Timer Decrement & Expiration...");
player.rapidFireTimer = 1.0;
player.simulateMovement(0.5, { left: false, right: false, up: false, down: false, thrust: false, phase: false } as any);
assert.equal(player.rapidFireTimer.toFixed(1), "0.5", "rapidFireTimer should decrease to 0.5s");

player.simulateMovement(0.6, { left: false, right: false, up: false, down: false, thrust: false, phase: false } as any);
assert.equal(player.rapidFireTimer, 0, "rapidFireTimer should clamp at 0");
assert.equal(player.isRapidFireActive(), false, "isRapidFireActive must be false after timer expires");
console.log("   ✅ Timer countdown verified.");

console.log("\n🎉 ALL RAPID FIRE TESTS PASSED CLEANLY!");
