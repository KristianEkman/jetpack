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

console.log("\n🎉 ALL BOSS ENEMY TESTS PASSED CLEANLY!");
