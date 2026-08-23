import assert from "node:assert/strict";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { TileMap, TILES } from "../js/world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy/index.js";
import { RoomManager } from "../server/roomManager.js";
import { Player } from "../js/entities/player.js";

console.log("🧪 Running Stage 10 Cyber Omega Core Validation Suite...\n");

// 1. Check CAMPAIGN_LEVELS count and metadata
console.log("1️⃣  Checking CAMPAIGN_LEVELS count and Stage 10 metadata...");
assert.ok(CAMPAIGN_LEVELS.length >= 10, `CAMPAIGN_LEVELS must contain at least 10 levels (found ${CAMPAIGN_LEVELS.length})`);

const stage10 = CAMPAIGN_LEVELS[9];
assert.equal(stage10.name, "Stage 10: Cyber Omega Core", "Stage 10 name should match");
assert.ok(stage10.bosses && stage10.bosses.length > 0, "Stage 10 must configure at least 1 boss");

const bossConfig = stage10.bosses[0];
assert.equal(bossConfig.bossName, "MECHA CORE OMEGA", "Boss name should be MECHA CORE OMEGA");
assert.equal(bossConfig.hp, 25, "Boss HP should be 25");
assert.equal(bossConfig.width, 128, "Boss width should be 128");
assert.equal(bossConfig.height, 96, "Boss height should be 96");
console.log(`   ✅ Stage 10 metadata & boss config verified: ${stage10.name} (Boss: ${bossConfig.bossName}, HP: ${bossConfig.hp}, Size: ${bossConfig.width}x${bossConfig.height})`);

// 2. TileMap loading & Grid layout validation
console.log("2️⃣  Validating TileMap and Arena Grid Layout...");
const tileMap = new TileMap({ effectsEnabled: false });
tileMap.loadLevelData(stage10);

let spawnCount = 0;
let exitCount = 0;
let emeraldCount = 0;
let goldCount = 0;
let rapidFireCount = 0;
let extraLifeCount = 0;
let teleporterCount = 0;
let phaseBrickCount = 0;
let iceCount = 0;
let conveyorCount = 0;
let energyDrainCount = 0;
let fuelCount = 0;
let vineCount = 0;
let ladderCount = 0;

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
        if (tile === TILES.PHASE_BRICK) phaseBrickCount++;
        if (tile === TILES.ICE) iceCount++;
        if (tile === TILES.CONVEYOR_LEFT || tile === TILES.CONVEYOR_RIGHT) conveyorCount++;
        if (tile === TILES.ENERGY_DRAIN) energyDrainCount++;
        if (tile === TILES.FUEL) fuelCount++;
        if (tile === TILES.VINE) vineCount++;
        if (tile === TILES.LADDER) ladderCount++;
    }
}

assert.equal(spawnCount, 1, "Stage 10 must have exactly 1 SPAWN tile");
assert.equal(exitCount, 1, "Stage 10 must have exactly 1 EXIT_PORTAL tile");
assert.ok(emeraldCount >= 5, `Stage 10 should have emeralds (found ${emeraldCount})`);
assert.ok(goldCount >= 1, `Stage 10 should have gold coins (found ${goldCount})`);
assert.ok(rapidFireCount >= 1, "Stage 10 should have Rapid Fire powerup");
assert.ok(extraLifeCount >= 1, "Stage 10 should have Extra Life item");
assert.equal(teleporterCount, 2, `Stage 10 should have exactly 2 teleporters (found ${teleporterCount})`);
assert.ok(phaseBrickCount >= 6, `Stage 10 should have phase bricks (found ${phaseBrickCount})`);
assert.ok(iceCount >= 5, `Stage 10 should have ice platforms (found ${iceCount})`);
assert.ok(conveyorCount >= 8, `Stage 10 should have conveyor belts (found ${conveyorCount})`);
assert.ok(energyDrainCount >= 4, `Stage 10 should have energy drain hazards (found ${energyDrainCount})`);
assert.ok(fuelCount >= 2, `Stage 10 should have fuel pads (found ${fuelCount})`);
assert.ok(vineCount >= 1, `Stage 10 should have vines (found ${vineCount})`);
assert.ok(ladderCount >= 2, `Stage 10 should have ladders (found ${ladderCount})`);

const primarySpawn = tileMap.getPrimarySpawnPoint();
assert.equal(tileMap.isAreaSolid(primarySpawn.x, primarySpawn.y), false, "Spawn point must not be solid");

console.log(`   ✅ Arena verified: ${emeraldCount} emeralds, ${goldCount} gold, ${teleporterCount} teleporters, ${phaseBrickCount} phase bricks, ${iceCount} ice, ${conveyorCount} conveyors, ${energyDrainCount} energy drains.`);

// 3. Enemy Manager & Big Boss Instantiation
console.log("3️⃣  Testing EnemyManager and Mecha Core Omega Boss...");
const enemyManager = new EnemyManager(tileMap);
if (stage10.flitzers) {
    stage10.flitzers.forEach(f => enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
}
if (stage10.missiles) {
    stage10.missiles.forEach(m => enemyManager.addHomingMissile(m.x, m.y));
}
if (stage10.turrets) {
    stage10.turrets.forEach(t => enemyManager.addTurret(t.x, t.y, t.fireInterval));
}
if (stage10.bosses) {
    stage10.bosses.forEach(b => enemyManager.addBoss(b.x, b.y, b.hp || 25, null, b.bossName, b.width, b.height));
}

assert.equal(enemyManager.hasAliveBoss(), true, "Stage 10 must have an alive boss");
const boss = enemyManager.enemies.find(e => e.type === ENEMY_TYPES.BOSS);
assert.ok(boss, "Boss enemy should exist in enemyManager");
assert.equal(boss.bossName, "MECHA CORE OMEGA");
assert.equal(boss.hp, 25);
assert.equal(boss.maxHp, 25);
assert.equal(boss.width, 128, "Boss width should be 128 (bigger boss)");
assert.equal(boss.height, 96, "Boss height should be 96 (bigger boss)");
assert.equal(boss.phase, 1);

// 4. Test Boss Combat Updates, Multi-Projectiles, and Phase 2 Enraged Mode
console.log("4️⃣  Testing Big Boss Combat Behavior & Phase 2 Spread Attacks...");
const player = new Player(null, tileMap);
player.x = 400;
player.y = 400;
player.respawnInvulnerability = 0;

// Test Phase 1 attack updates
boss.attackTimer = 1.95;
enemyManager.update(0.02, [player]);
assert.ok(enemyManager.projectiles.length >= 2, "Boss should fire dual wing blasters in Phase 1");

// Damage boss down to Phase 2 (HP <= 12.5 -> HP 12)
enemyManager.damageEnemy(boss.id, 13, player.id);
assert.equal(boss.hp, 12);
assert.equal(boss.phase, 2, "Boss should transition to Phase 2 enraged mode");

// Test Phase 2 triple spread attacks
enemyManager.projectiles = [];
boss.hasSpawnedPhase2Missile = true; // Skip first missile spawn to test triple plasma spread
boss.attackTimer = 1.34;
enemyManager.update(0.02, [player]);
assert.equal(enemyManager.projectiles.length, 3, "Omega Boss in Phase 2 should fire 3-way triple plasma burst");

console.log("   ✅ Big Boss Phase 1 & Phase 2 triple attacks verified.");

// 5. Test Server Room Manager Level 10 Integration
console.log("5️⃣  Testing Multiplayer Server Room Level 10 Setup...");
const roomManager = new RoomManager();
const room = roomManager.createRoom("host_omega_10", {
    playerName: "OmegaChallenger",
    levelIndex: 9,
});

assert.equal(room.levelIndex, 9, "Room levelIndex should be 9");
assert.equal(room.mapName, "Stage 10: Cyber Omega Core", "Room mapName should match Stage 10");
assert.equal(room.tileMap.totalEmeralds, emeraldCount, "Server room tilemap should count Stage 10 emeralds correctly");

console.log("   ✅ Server RoomManager successfully hosted Stage 10.");

console.log("\n🎉 STAGE 10 CYBER OMEGA CORE VALIDATION PASSED PERFECTLY!");
