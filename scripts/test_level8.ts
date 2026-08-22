import assert from "node:assert/strict";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { TileMap, TILES } from "../js/world/tilemap.js";
import { EnemyManager } from "../js/entities/enemy/index.js";

console.log("🧪 Running Stage 8 Bonus Level Validation Suite...\n");

// 1. Check CAMPAIGN_LEVELS count and metadata
assert.ok(CAMPAIGN_LEVELS.length >= 8, "CAMPAIGN_LEVELS should contain at least 8 levels");

const stage8 = CAMPAIGN_LEVELS[7];
assert.equal(stage8.name, "Stage 8: Bonus Treasure Vault");
console.log("1️⃣  Stage 8 metadata verified.");

// 2. TileMap loading & Grid layout validation
const tileMap = new TileMap();
tileMap.loadLevelData(stage8);

let spawnCount = 0;
let exitCount = 0;
let emeraldCount = 0;
let goldCount = 0;
let rapidFireCount = 0;
let extraLifeCount = 0;
let teleporterCount = 0;

for (let r = 0; r < tileMap.rows; r++) {
    for (let c = 0; c < tileMap.cols; c++) {
        const tile = tileMap.getTile(c, r);
        if (tile === TILES.SPAWN) spawnCount++;
        if (tile === TILES.EXIT_PORTAL) exitCount++;
        if (tile === TILES.EMERALD) emeraldCount++;
        if (tile === TILES.GOLD) goldCount++;
        if (tile === TILES.RAPID_FIRE) rapidFireCount++;
        if (tile === TILES.EXTRA_LIFE) extraLifeCount++;
        if (tile === TILES.TELEPORTER) teleporterCount++;
    }
}

assert.equal(spawnCount, 1, "Stage 8 must have exactly 1 SPAWN tile");
assert.equal(exitCount, 1, "Stage 8 must have exactly 1 EXIT_PORTAL tile");
assert.ok(emeraldCount >= 30, `Stage 8 should have abundant emeralds (found ${emeraldCount})`);
assert.ok(goldCount >= 30, `Stage 8 should have abundant gold coins (found ${goldCount})`);
assert.ok(rapidFireCount >= 1, "Stage 8 should have Rapid Fire powerup");
assert.ok(extraLifeCount >= 1, "Stage 8 should have Extra Life item");
assert.ok(teleporterCount >= 2, "Stage 8 should have teleporters");
console.log(`2️⃣  Tilemap verified: ${spawnCount} spawn, ${exitCount} exit, ${emeraldCount} emeralds, ${goldCount} gold coins, powerups & teleporters.`);

// 3. Enemy Spawner Verification
const enemyManager = new EnemyManager(tileMap);
if (stage8.flitzers) {
    stage8.flitzers.forEach(f => enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
}
assert.equal(enemyManager.enemies.length, 2, "Stage 8 should have 2 playful Flitzer enemies");
console.log("3️⃣  Enemy spawner verified with 2 playful bonus flitzers.");

console.log("\n🎉 STAGE 8 BONUS LEVEL VALIDATION PASSED PERFECTLY!");
