import assert from "node:assert/strict";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { TileMap, TILES } from "../js/world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy/index.js";

console.log("🧪 Running Stage 7 Boss Level Validation Suite...\n");

// 1. Check CAMPAIGN_LEVELS count
assert.ok(CAMPAIGN_LEVELS.length >= 7, "CAMPAIGN_LEVELS should contain at least 7 levels");

const stage7 = CAMPAIGN_LEVELS[6];
assert.equal(stage7.name, "Stage 7: Mecha Core Fortress");
console.log("1️⃣  Stage 7 metadata verified.");

// 2. TileMap loading & Grid layout validation
const tileMap = new TileMap();
tileMap.loadLevelData(stage7);

let spawnCount = 0;
let exitCount = 0;
let emeraldCount = 0;

for (let r = 0; r < tileMap.rows; r++) {
    for (let c = 0; c < tileMap.cols; c++) {
        const tile = tileMap.getTile(c, r);
        if (tile === TILES.SPAWN) spawnCount++;
        if (tile === TILES.EXIT_PORTAL) exitCount++;
        if (tile === TILES.EMERALD) emeraldCount++;
    }
}

assert.equal(spawnCount, 1, "Stage 7 must have exactly 1 SPAWN tile");
assert.equal(exitCount, 1, "Stage 7 must have exactly 1 EXIT_PORTAL tile");
assert.ok(emeraldCount > 0, "Stage 7 must have emerald collectibles");
console.log(`2️⃣  Tilemap verified: ${spawnCount} spawn, ${exitCount} exit portal, ${emeraldCount} emeralds.`);

// 3. Enemy Spawning Verification
const enemyManager = new EnemyManager(tileMap);
if (stage7.flitzers) {
    stage7.flitzers.forEach(f => enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
}
if (stage7.missiles) {
    stage7.missiles.forEach(m => enemyManager.addHomingMissile(m.x, m.y));
}
if (stage7.turrets) {
    stage7.turrets.forEach(t => enemyManager.addTurret(t.x, t.y, t.fireInterval));
}
if (stage7.bosses) {
    stage7.bosses.forEach(b => enemyManager.addBoss(b.x, b.y, b.hp || 10));
}

const bossEnemies = enemyManager.enemies.filter(e => e.type === ENEMY_TYPES.BOSS);
assert.equal(bossEnemies.length, 1, "EnemyManager should contain 1 Boss enemy for Stage 7");
assert.equal(bossEnemies[0].hp, 10, "Stage 7 Boss HP should be 10");
assert.equal(bossEnemies[0].maxHp, 10, "Stage 7 Boss Max HP should be 10");

assert.equal(enemyManager.enemies.length, 6, "Total enemies for Stage 7 should be 6 (1 Boss, 2 Flitzers, 1 Missile, 2 Turrets)");
console.log("3️⃣  Enemy spawner verified with Boss (10 HP) and supporting artillery.");

console.log("\n🎉 STAGE 7 BOSS LEVEL VALIDATION PASSED PERFECTLY!");
