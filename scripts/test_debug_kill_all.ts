/* ==========================================================================
   DEBUG KILL-ALL-ENEMIES SHORTCUT (Ctrl+Shift+K) TEST SUITE
   Verifies the hidden debug shortcut kills every enemy (including the boss),
   clears projectiles, and does not interfere with the plain-K suicide key.
   ========================================================================== */

import assert from "node:assert/strict";

import { setupMockDom, mockWindow } from "./test_mock_dom.js";

setupMockDom({});

const { Game, GAME_STATES } = await import("../js/game.js");
const { EnemyManager } = await import("../js/entities/enemy/index.js");
const { TileMap, TILES } = await import("../js/world/tilemap.js");
const { ENEMY_TYPES } = await import("../js/entities/enemy/types.js");

console.log("🧪 Running Debug Kill-All-Enemies Shortcut Test Suite...\n");

// ── 1. EnemyManager.killAllEnemies() ───────────────────────────────────────
console.log("1️⃣  Testing EnemyManager.killAllEnemies()...");
{
  const tileMap = new TileMap();
  const enemyManager = new EnemyManager(tileMap, null);

  enemyManager.addFlitzer(100, 100);
  enemyManager.addHomingMissile(200, 200);
  enemyManager.addTurret(300, 300);
  enemyManager.addBoss(400, 400, 10);
  enemyManager.projectiles.push({ x: 0, y: 0, vx: 1, vy: 1 } as never);

  const destroyedIds: string[] = [];
  enemyManager.onEnemyDestroyed = ({ enemyId }: { enemyId: string }) => {
    destroyedIds.push(enemyId);
  };

  const boss = enemyManager.enemies.find((e) => e.type === ENEMY_TYPES.BOSS);
  assert.ok(boss, "boss should exist before kill-all");

  const killed = enemyManager.killAllEnemies();

  assert.equal(killed, 4, "all 4 enemies should be destroyed");
  assert.equal(enemyManager.enemies.length, 0, "no enemies should remain");
  assert.equal(enemyManager.projectiles.length, 0, "projectiles should be cleared");
  assert.equal(enemyManager.hasAliveBoss(), false, "boss should no longer block the exit unlock");
  assert.equal(destroyedIds.length, 4, "onEnemyDestroyed should fire for every enemy");

  // Killing the boss triggers the normal treasure burst (emeralds/gold tiles)
  const treasureTiles = tileMap.grid.filter(
    (t) => t === TILES.EMERALD || t === TILES.GOLD,
  ).length;
  assert.ok(treasureTiles > 0, "boss death should drop its treasure burst");
}
console.log("   ✅ EnemyManager.killAllEnemies() verified.\n");

// ── 2. Ctrl+Shift+K keyboard wiring ────────────────────────────────────────
console.log("2️⃣  Testing Ctrl+Shift+K shortcut wiring...");
const game = new Game();
{
  game.gameState = GAME_STATES.PLAYING;
  game.isMultiplayer = false;
  game.enemyManager.clear();
  game.enemyManager.addFlitzer(100, 100);
  game.enemyManager.addBoss(400, 400, 10);

  mockWindow.dispatchEvent({
    type: "keydown",
    code: "KeyK",
    ctrlKey: true,
    shiftKey: true,
    preventDefault(): void {},
  });

  assert.equal(game.enemyManager.enemies.length, 0, "Ctrl+Shift+K should kill all enemies");
  assert.equal(game.input.keys.suicide, false, "Ctrl+Shift+K must not trigger the suicide key");
}
console.log("   ✅ Ctrl+Shift+K shortcut verified.\n");

// ── 3. Plain K still triggers suicide ──────────────────────────────────────
console.log("3️⃣  Testing plain K suicide key is preserved...");
{
  mockWindow.dispatchEvent({
    type: "keydown",
    code: "KeyK",
    ctrlKey: false,
    shiftKey: false,
    preventDefault(): void {},
  });
  assert.equal(game.input.keys.suicide, true, "plain K should still set the suicide key");

  mockWindow.dispatchEvent({
    type: "keyup",
    code: "KeyK",
    preventDefault(): void {},
  });
  assert.equal(game.input.keys.suicide, false, "releasing K should clear the suicide key");

  // K with only one modifier is not the debug shortcut
  mockWindow.dispatchEvent({
    type: "keydown",
    code: "KeyK",
    ctrlKey: true,
    shiftKey: false,
    preventDefault(): void {},
  });
  assert.equal(game.input.keys.suicide, true, "Ctrl+K (no shift) should behave as plain K");
  mockWindow.dispatchEvent({ type: "keyup", code: "KeyK", preventDefault(): void {} });
}
console.log("   ✅ Plain K suicide key preserved.\n");

// ── 4. Shortcut is gated to single-player PLAYING ──────────────────────────
console.log("4️⃣  Testing shortcut gating...");
{
  // Not in PLAYING state
  game.gameState = GAME_STATES.PAUSED;
  game.enemyManager.addFlitzer(100, 100);
  mockWindow.dispatchEvent({
    type: "keydown",
    code: "KeyK",
    ctrlKey: true,
    shiftKey: true,
    preventDefault(): void {},
  });
  assert.equal(game.enemyManager.enemies.length, 1, "shortcut should do nothing when not playing");

  // Multiplayer (server is authoritative over enemies)
  game.gameState = GAME_STATES.PLAYING;
  game.isMultiplayer = true;
  mockWindow.dispatchEvent({
    type: "keydown",
    code: "KeyK",
    ctrlKey: true,
    shiftKey: true,
    preventDefault(): void {},
  });
  assert.equal(game.enemyManager.enemies.length, 1, "shortcut should do nothing in multiplayer");
  game.isMultiplayer = false;
  game.enemyManager.clear();
}
console.log("   ✅ Shortcut gating verified.\n");

// Clean up audio and game loop at end of test run
game.audio.stopMusic();
game.audio.stopThrust();
if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
game.loop.stop();

console.log("🎉 ALL DEBUG KILL-ALL-ENEMIES SHORTCUT TESTS PASSED!\n");
