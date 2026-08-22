import assert from "node:assert/strict";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { TileMap, TILES } from "../js/world/tilemap.js";
import { EnemyManager } from "../js/entities/enemy/index.js";
import { RoomManager } from "../server/roomManager.js";

console.log("🧪 Running Stage 9 Quantum Citadel Validation Suite...\n");

// 1. Check CAMPAIGN_LEVELS count and metadata
assert.ok(CAMPAIGN_LEVELS.length >= 9, "CAMPAIGN_LEVELS should contain at least 9 levels");

const stage9 = CAMPAIGN_LEVELS[8];
assert.equal(stage9.name, "Stage 9: Quantum Citadel", "Stage 9 name should match");
console.log("1️⃣  Stage 9 metadata verified: " + stage9.name);

// 2. TileMap loading & Grid layout validation
const tileMap = new TileMap();
tileMap.loadLevelData(stage9);

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

assert.equal(spawnCount, 1, "Stage 9 must have exactly 1 SPAWN tile");
assert.equal(exitCount, 1, "Stage 9 must have exactly 1 EXIT_PORTAL tile");
assert.ok(emeraldCount >= 5, `Stage 9 should have emeralds to collect (found ${emeraldCount})`);
assert.ok(goldCount >= 1, `Stage 9 should have gold coins (found ${goldCount})`);
assert.ok(rapidFireCount >= 1, "Stage 9 should have Rapid Fire powerup");
assert.ok(extraLifeCount >= 1, "Stage 9 should have Extra Life item");
assert.equal(teleporterCount, 2, `Stage 9 should have exactly 2 teleporters (found ${teleporterCount})`);
assert.ok(phaseBrickCount >= 10, `Stage 9 should have phase bricks (found ${phaseBrickCount})`);
assert.ok(iceCount >= 5, `Stage 9 should have ice platforms (found ${iceCount})`);
assert.ok(conveyorCount >= 10, `Stage 9 should have conveyor belts (found ${conveyorCount})`);
assert.ok(energyDrainCount >= 4, `Stage 9 should have energy drain hazards (found ${energyDrainCount})`);
assert.ok(fuelCount >= 2, `Stage 9 should have fuel pads (found ${fuelCount})`);
assert.ok(vineCount >= 1, `Stage 9 should have vines (found ${vineCount})`);
assert.ok(ladderCount >= 2, `Stage 9 should have ladders (found ${ladderCount})`);

console.log(`2️⃣  Tilemap verified: ${emeraldCount} emeralds, ${goldCount} gold, ${teleporterCount} teleporters, ${phaseBrickCount} phase bricks, ${iceCount} ice, ${conveyorCount} conveyors, ${energyDrainCount} energy drains.`);

// 3. Enemy Spawner Verification
const enemyManager = new EnemyManager(tileMap);
if (stage9.flitzers) {
    stage9.flitzers.forEach(f => enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
}
if (stage9.missiles) {
    stage9.missiles.forEach(m => enemyManager.addHomingMissile(m.x, m.y));
}
if (stage9.turrets) {
    stage9.turrets.forEach(t => enemyManager.addTurret(t.x, t.y, t.fireInterval));
}
const flitzers = enemyManager.enemies.filter(e => e.type === "flitzer");
const missiles = enemyManager.enemies.filter(e => e.type === "homing_missile");
const turrets = enemyManager.enemies.filter(e => e.type === "turret");

assert.equal(flitzers.length, 2, "Stage 9 should have 2 Flitzer enemies");
assert.equal(missiles.length, 1, "Stage 9 should have 1 Homing Missile");
assert.equal(turrets.length, 1, "Stage 9 should have 1 Turret");
assert.equal(enemyManager.enemies.length, 4, "Stage 9 should have 4 total active enemies");
console.log("3️⃣  Enemy spawner verified with 2 flitzers, 1 missile, and 1 turret.");

// 4. Server Room Manager & Level Selection Integration
const roomManager = new RoomManager();
const room = roomManager.createRoom("host_socket_9", {
    playerName: "QuantumHost",
    levelIndex: 8,
});

assert.equal(room.levelIndex, 8, "Room levelIndex should be 8");
assert.equal(room.mapName, "Stage 9: Quantum Citadel", "Room mapName should match Stage 9");
assert.equal(room.tileMap.totalEmeralds, emeraldCount, "Server room tilemap should count emeralds correctly");

console.log("4️⃣  Server RoomManager created Stage 9 room and synchronized correctly.");

console.log("\n🎉 STAGE 9 QUANTUM CITADEL VALIDATION PASSED PERFECTLY!");
