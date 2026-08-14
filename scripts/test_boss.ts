import assert from "node:assert/strict";
import { TILES } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy/index.js";
import { Player } from "../js/entities/player.js";

console.log("🧪 Running Boss Enemy Test Suite...\n");

// 1. Check Constants
console.log("1️⃣  Testing Constants & Types...");
assert.equal(TILES.ENEMY_BOSS, 20, "TILES.ENEMY_BOSS must be 20");
assert.equal(ENEMY_TYPES.BOSS, "boss", "ENEMY_TYPES.BOSS must be 'boss'");
console.log("   ✅ Constants & enemy types verified.");

// 2. Test Instantiating Boss Enemy
console.log("2️⃣  Testing EnemyManager.addBoss...");
const tileMap = new TileMap();
tileMap.cols = 30;
tileMap.rows = 18;
tileMap.grid = new Array(30 * 18).fill(TILES.AIR);

const enemyManager = new EnemyManager(tileMap);
enemyManager.addBoss(100, 50, 20, "boss_alpha");

assert.equal(enemyManager.enemies.length, 1, "Boss enemy should be added");
const boss = enemyManager.enemies[0];
assert.equal(boss.id, "boss_alpha");
assert.equal(boss.type, ENEMY_TYPES.BOSS);
assert.equal(boss.hp, 20);
assert.equal(boss.maxHp, 20);
assert.equal(boss.phase, 1);
assert.equal(boss.width, 80);
assert.equal(boss.height, 64);
console.log("   ✅ Boss creation verified.");

// 3. Test Boss AI & Movement Updates
console.log("3️⃣  Testing Boss AI & Movement Updates...");
const player = new Player(null as any, tileMap);
player.x = 200;
player.y = 300;

// Run 10 ticks
const initialX = boss.x;
for (let i = 0; i < 10; i++) {
  enemyManager.update(0.05, [player]);
}
assert.notEqual(boss.x, initialX, "Boss position should update horizontally over ticks");
console.log("   ✅ Boss movement updates verified.");

// 4. Test Damage Handling & Phase Transition
console.log("4️⃣  Testing Boss Damage Handling & Phase Transition...");
// Initial HP is 20, maxHp is 20. Damage 5 times -> HP = 15 (Phase 1)
enemyManager.damageEnemy(boss.id, 5, player.id);
assert.equal(boss.hp, 15);
assert.equal(boss.phase, 1, "Boss should still be Phase 1 when HP > 50%");

// Damage 6 more times -> HP = 9 (<= 50% of 20, so 10 or less triggers Phase 2)
enemyManager.damageEnemy(boss.id, 6, player.id);
assert.equal(boss.hp, 9);
assert.equal(boss.phase, 2, "Boss should transition to Phase 2 (Enraged Mode) when HP <= 50%");
assert.equal(boss.hitFlashTimer, 0.15, "Boss hitFlashTimer should be set on damage");
console.log("   ✅ Damage handling and Phase 2 transition verified.");

// 5. Test Boss Defeat / Destruction
console.log("5️⃣  Testing Boss Defeat & Destruction...");
let destroyedData: any = null;
enemyManager.onEnemyDestroyed = (data) => {
  destroyedData = data;
};

// Deal remaining 9 damage to reduce HP to 0
const wasDestroyed = enemyManager.damageEnemy(boss.id, 9, player.id);
assert.equal(wasDestroyed, true, "damageEnemy should return true when HP reaches 0");
assert.equal(enemyManager.enemies.length, 0, "Boss should be removed from enemyManager upon defeat");
assert.ok(destroyedData, "onEnemyDestroyed callback should trigger");
assert.equal(destroyedData.enemyId, "boss_alpha");
assert.equal(destroyedData.playerId, player.id);
console.log("   ✅ Boss defeat and destruction verified.");

// 6. Test Multiplayer Serialization & Snapshot Application
console.log("6️⃣  Testing Network Serialization & Snapshot Roundtrip...");
const serverManager = new EnemyManager(tileMap);
serverManager.addBoss(300, 100, 30, "server_boss_1");
const sBoss = serverManager.enemies[0];
sBoss.hp = 12;
sBoss.phase = 2;

const serialized = serverManager.serializeEnemies();
assert.equal(serialized.length, 1);
const serializedBoss = serialized[0];
assert.equal(serializedBoss[0], "server_boss_1");
assert.equal(serializedBoss[1], ENEMY_TYPES.BOSS);
assert.equal(serializedBoss[9], 12); // hp
assert.equal(serializedBoss[10], 30); // maxHp
assert.equal(serializedBoss[11], 2); // phase

const clientManager = new EnemyManager(tileMap);
clientManager.applyEnemySnapshot(serialized, []);
assert.equal(clientManager.enemies.length, 1, "Client should construct Boss from snapshot");
const cBoss = clientManager.enemies[0];
assert.equal(cBoss.id, "server_boss_1");
assert.equal(cBoss.type, ENEMY_TYPES.BOSS);
assert.equal(cBoss.hp, 12);
assert.equal(cBoss.maxHp, 30);
assert.equal(cBoss.phase, 2);
console.log("   ✅ Multiplayer snapshot serialization verified.");

// 7. Test PALETTE Integration in Level Editor
console.log("7️⃣  Testing Level Editor PALETTE Integration...");
import { PALETTE } from "../js/editor/level_editor.js";
const bossPaletteItem = PALETTE.find((item) => item.type === TILES.ENEMY_BOSS);
assert.ok(bossPaletteItem, "Boss Enemy must exist in Level Editor PALETTE");
assert.equal(bossPaletteItem.name, "Boss Enemy");
assert.equal(bossPaletteItem.icon, "👾");
console.log("   ✅ Level Editor PALETTE integration verified.");

// 8. Test Boss TileMap Wall Collision & Bounce
console.log("8️⃣  Testing Boss Wall Collision & Bounce...");
const wallTileMap = new TileMap();
wallTileMap.cols = 30;
wallTileMap.rows = 18;
wallTileMap.grid = new Array(30 * 18).fill(TILES.AIR);

// Place a wall brick column right in front of where boss will move
// Boss starts at x=100, width=80. Placing a wall column at col 6 (x=192..224)
for (let r = 0; r < 18; r++) {
  wallTileMap.grid[r * 30 + 6] = TILES.BRICK;
}

const wallEnemyManager = new EnemyManager(wallTileMap);
wallEnemyManager.addBoss(100, 50, 25, "boss_wall_test");
const wBoss = wallEnemyManager.enemies[0];
wBoss.vx = 90; // moving right towards col 6 (x=192)

// Move towards the wall until collision and bounce
let bounced = false;
for (let i = 0; i < 30; i++) {
  wallEnemyManager.update(0.05, [player]);
  assert.ok(
    wBoss.x + wBoss.width <= 192,
    `Boss position (${wBoss.x + wBoss.width}) should not penetrate wall at x=192`,
  );
  if ((wBoss.vx || 0) < 0) {
    bounced = true;
    break;
  }
}
assert.ok(
  bounced,
  "Boss velocity should reverse to negative when colliding with a wall",
);
console.log("   ✅ Boss wall collision & bounce verified.");

// 9. Test Boss Required for Exit Portal Enablement
console.log("9️⃣  Testing Boss Required for Exit Portal Enablement...");
const exitTileMap = new TileMap();
exitTileMap.totalEmeralds = 5;
exitTileMap.collectedEmeralds = 5;

const exitEnemyManager = new EnemyManager(exitTileMap);

// Without boss: exit is unlocked when all emeralds are collected
assert.equal(
  exitEnemyManager.hasAliveBoss(),
  false,
  "hasAliveBoss should be false when no boss exists",
);
assert.equal(
  exitTileMap.isExitUnlocked(exitEnemyManager),
  true,
  "Exit should be unlocked when all emeralds are collected and no boss exists",
);

// Add boss: exit is locked even though all emeralds are collected
exitEnemyManager.addBoss(100, 50, 10, "boss_gatekeeper");
assert.equal(
  exitEnemyManager.hasAliveBoss(),
  true,
  "hasAliveBoss should be true when active boss exists",
);
assert.equal(
  exitTileMap.isExitUnlocked(exitEnemyManager),
  false,
  "Exit MUST be locked while boss is still alive, even with all emeralds collected",
);

// Defeat boss: exit unlocks (boss drops loot emeralds which increase totalEmeralds)
exitEnemyManager.damageEnemy("boss_gatekeeper", 10, player.id);
assert.equal(
  exitEnemyManager.hasAliveBoss(),
  false,
  "hasAliveBoss should be false after boss is defeated",
);
// Collect any extra emeralds dropped by the boss
exitTileMap.collectedEmeralds = exitTileMap.totalEmeralds;
assert.equal(
  exitTileMap.isExitUnlocked(exitEnemyManager),
  true,
  "Exit MUST be unlocked after boss is killed and all emeralds collected",
);
console.log("   ✅ Boss exit portal enablement requirement verified.");

// 10. Test Boss Phase 2 Single Homing Missile Cap
console.log("10️⃣ Testing Boss Phase 2 Single Active Homing Missile Cap...");
const p2TileMap = new TileMap();
p2TileMap.cols = 30;
p2TileMap.rows = 18;
p2TileMap.grid = new Array(30 * 18).fill(TILES.AIR);

const p2EnemyManager = new EnemyManager(p2TileMap);
p2EnemyManager.addBoss(100, 50, 10, "boss_p2_cap");
const p2Boss = p2EnemyManager.enemies[0];
p2Boss.hp = 5; // Set HP to <= 50% to trigger Phase 2

const testPlayer = new Player(null as any, p2TileMap);
testPlayer.x = 200;
testPlayer.y = 300;

// Update until first attack occurs
p2Boss.attackTimer = 1.5;
p2EnemyManager.update(0.01, [testPlayer]);

const activeMissiles1 = p2EnemyManager.enemies.filter((e) => e.type === ENEMY_TYPES.HOMING_MISSILE);
assert.equal(activeMissiles1.length, 1, "First attack in Phase 2 should spawn 1 homing missile");

// Force second attack while missile is still active
p2Boss.attackTimer = 1.5;
p2EnemyManager.update(0.01, [testPlayer]);

const activeMissiles2 = p2EnemyManager.enemies.filter((e) => e.type === ENEMY_TYPES.HOMING_MISSILE);
assert.equal(
  activeMissiles2.length,
  1,
  "Subsequent attacks while a homing missile is alive MUST NOT spawn additional homing missiles",
);

// Destroy the missile (simulating player shooting it down)
p2EnemyManager.enemies = p2EnemyManager.enemies.filter((e) => e.type !== ENEMY_TYPES.HOMING_MISSILE);
assert.equal(p2EnemyManager.enemies.filter((e) => e.type === ENEMY_TYPES.HOMING_MISSILE).length, 0);

// Force third attack after missile is destroyed
p2Boss.attackTimer = 1.5;
p2EnemyManager.update(0.01, [testPlayer]);

const activeMissiles3 = p2EnemyManager.enemies.filter((e) => e.type === ENEMY_TYPES.HOMING_MISSILE);
assert.equal(
  activeMissiles3.length,
  0,
  "Even after the first homing missile is destroyed, Phase 2 boss MUST NOT spawn another homing missile",
);
console.log("   ✅ Single homing missile total cap verified in Phase 2 (no re-spawning after shot).");

// 11. Test Boss Phase 2 Rapid Fire Power Up Ejection
console.log("11️⃣ Testing Boss Phase 2 Rapid Fire Power Up Ejection...");
const powerUpTileMap = new TileMap();
powerUpTileMap.cols = 30;
powerUpTileMap.rows = 18;
powerUpTileMap.grid = new Array(30 * 18).fill(TILES.AIR);

const powerUpEnemyManager = new EnemyManager(powerUpTileMap);
powerUpEnemyManager.addBoss(100, 50, 20, "boss_p2_powerup");
const pBoss = powerUpEnemyManager.enemies[0];

// Verify initial state has no RAPID_FIRE tiles
const initialRapidFireCount = powerUpTileMap.grid.filter((t) => t === TILES.RAPID_FIRE).length;
assert.equal(initialRapidFireCount, 0, "Initially there should be no rapid fire tiles");

// Deal damage to reduce HP from 20 to 10 (triggers Phase 2)
powerUpEnemyManager.damageEnemy(pBoss.id, 10, player.id);
assert.equal(pBoss.phase, 2, "Boss should transition to Phase 2");
assert.equal(pBoss.rapidFireEjected, true, "rapidFireEjected flag should be set to true");

const rapidFireCountAfterP2 = powerUpTileMap.grid.filter((t) => t === TILES.RAPID_FIRE).length;
assert.equal(rapidFireCountAfterP2, 1, "A rapid fire power up tile should be ejected upon reaching Phase 2");

const rfIndex = powerUpTileMap.grid.indexOf(TILES.RAPID_FIRE);
assert.ok(rfIndex !== -1, "Rapid fire tile should be found in map");
const rfCol = rfIndex % powerUpTileMap.cols;
const rfRow = Math.floor(rfIndex / powerUpTileMap.cols);
const bossCenterCol = Math.floor((pBoss.x + pBoss.width / 2) / 32);
const bossCenterRow = Math.floor((pBoss.y + pBoss.height / 2) / 32);
const dist = Math.max(Math.abs(rfCol - bossCenterCol), Math.abs(rfRow - bossCenterRow));
assert.ok(dist >= 4, `Rapid fire power up should be thrown further away (distance ${dist} >= 4 tiles)`);

// Further damage in Phase 2 must not eject a second power up
powerUpEnemyManager.damageEnemy(pBoss.id, 5, player.id);
const rapidFireCountAfterExtraDamage = powerUpTileMap.grid.filter((t) => t === TILES.RAPID_FIRE).length;
assert.equal(rapidFireCountAfterExtraDamage, 1, "Only one rapid fire power up tile should be ejected for Phase 2 transition");

console.log("   ✅ Phase 2 Rapid Fire power up ejection & thrown distance verified.");

console.log("\n🎉 ALL BOSS ENEMY TESTS PASSED CLEANLY!");
