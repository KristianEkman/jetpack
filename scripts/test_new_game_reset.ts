/* ==========================================================================
   NEW GAME STATE RESET TEST SUITE
   Verifies that starting a new level resets lives/score/fuel/ammo, unless
   continuing a campaign (next level) or restarting after death.
   ========================================================================== */

import assert from "node:assert/strict";

import { setupMockDom } from "./test_mock_dom.js";

setupMockDom({});

const { Game, GAME_STATES } = await import("../js/game.js");
const { TILES, PLAYER_PHYSICS, WEAPON_TYPES } = await import("../js/shared/constants.js");
const { Player } = await import("../js/entities/player.js");
const { TileMap } = await import("../js/world/tilemap.js");

console.log("🧪 Running New Game State Reset Test Suite...\n");

// ── 1. Player.resetForNewGame() ────────────────────────────────────────────
console.log("1️⃣  Testing Player.resetForNewGame()...");
{
  const tileMap = new TileMap();
  const player = new Player(null, tileMap);

  // Dirty every piece of progress state
  player.score = 12345;
  player.lives = 1;
  player.fuel = 30;
  player.activeWeapon = WEAPON_TYPES.SPREAD_CANNON;
  player.weaponAmmo.spread_cannon = 5;
  player.weaponAmmo.plasma_grenade = 3;
  player.weaponAmmo.seeker_missile = 2;

  player.resetForNewGame();

  assert.equal(player.score, 0, "score should reset to 0");
  assert.equal(player.lives, PLAYER_PHYSICS.INITIAL_LIVES, "lives should reset to INITIAL_LIVES (3)");
  assert.equal(player.fuel, player.maxFuel, "fuel should reset to maxFuel");
  assert.equal(player.activeWeapon, WEAPON_TYPES.PHASE_BEAM, "active weapon should reset to phase beam");
  assert.equal(player.weaponAmmo.phase_beam, Infinity, "phase beam ammo should stay infinite");
  assert.equal(player.weaponAmmo.spread_cannon, 0, "spread cannon ammo should reset to 0");
  assert.equal(player.weaponAmmo.plasma_grenade, 0, "plasma grenade ammo should reset to 0");
  assert.equal(player.weaponAmmo.seeker_missile, 0, "seeker missile ammo should reset to 0");
}
console.log("   ✅ Player.resetForNewGame() verified.\n");

// ── Shared game fixture ────────────────────────────────────────────────────
const game = new Game();

function dirtyPlayer(): void {
  game.player.score = 9999;
  game.player.lives = 1;
  game.player.fuel = 25;
  game.player.activeWeapon = WEAPON_TYPES.SEEKER_MISSILE;
  game.player.weaponAmmo.seeker_missile = 4;
}

function assertFreshState(context: string): void {
  assert.equal(game.player.lives, PLAYER_PHYSICS.INITIAL_LIVES, `${context}: lives should reset to 3`);
  assert.equal(game.player.score, 0, `${context}: score should reset to 0`);
  assert.equal(game.player.fuel, game.player.maxFuel, `${context}: fuel should reset to full`);
  assert.equal(game.player.activeWeapon, WEAPON_TYPES.PHASE_BEAM, `${context}: weapon should reset to phase beam`);
  assert.equal(game.player.weaponAmmo.seeker_missile, 0, `${context}: ammo should reset to 0`);
  assert.equal(game.gameState, GAME_STATES.PLAYING, `${context}: game should be PLAYING`);
}

function assertPreservedState(context: string): void {
  assert.equal(game.player.lives, 1, `${context}: lives should be preserved`);
  assert.equal(game.player.score, 9999, `${context}: score should be preserved`);
  assert.equal(game.player.activeWeapon, WEAPON_TYPES.SEEKER_MISSILE, `${context}: weapon should be preserved`);
  assert.equal(game.player.weaponAmmo.seeker_missile, 4, `${context}: ammo should be preserved`);
  assert.equal(game.gameState, GAME_STATES.PLAYING, `${context}: game should be PLAYING`);
}

// ── 2. Fresh campaign level start resets ──────────────────────────────────
console.log("2️⃣  Testing fresh campaign level start (menu / level select)...");
dirtyPlayer();
game.levelManager.startLevel(0);
assertFreshState("startLevel(0)");
console.log("   ✅ Fresh startLevel resets player progress.\n");

// ── 3. Campaign next-level progression preserves ──────────────────────────
console.log("3️⃣  Testing campaign next-level progression...");
dirtyPlayer();
game.levelManager.startLevel(1, false, true);
assertPreservedState("startLevel(1, continueCampaign)");
assert.equal(game.currentLevelIndex, 1, "currentLevelIndex should advance");
console.log("   ✅ Campaign continuation preserves player progress.\n");

// ── 4. Restart after death preserves ──────────────────────────────────────
console.log("4️⃣  Testing restart after death (isRestart=true)...");
dirtyPlayer();
game.levelManager.startLevel(0, true);
assertPreservedState("startLevel(0, isRestart)");
console.log("   ✅ Death restart preserves player progress.\n");

// ── 5. Custom level play resets (unless restart) ──────────────────────────
console.log("5️⃣  Testing custom level start...");
const customRecord = {
  id: "test-level-1",
  name: "Test Level",
  authorId: "author-1",
  authorName: "Tester",
  createdAt: 0,
  updatedAt: 0,
  grid: new Array(30 * 18).fill(TILES.AIR),
  highScore: 0,
  highScoreUser: "",
  ratingSum: 0,
  ratingCount: 0,
  averageRating: 0,
};

dirtyPlayer();
game.levelManager.startCustomLevelRecord(customRecord);
assertFreshState("startCustomLevelRecord(fresh)");
assert.equal(game.isCustomLevel, true, "custom level flag should be set");

dirtyPlayer();
game.levelManager.startCustomLevelRecord(customRecord, true);
assertPreservedState("startCustomLevelRecord(isRestart)");
console.log("   ✅ Custom level start/reset behavior verified.\n");

// ── 6. Editor playtest resets (unless restart) ────────────────────────────
console.log("6️⃣  Testing editor playtest...");
// Build a minimal valid level in the editor tilemap: spawn + portal + emerald
game.tileMap.cols = 30;
game.tileMap.rows = 18;
game.tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
game.tileMap.setTile(2, 2, TILES.SPAWN);
game.tileMap.setTile(27, 15, TILES.EXIT_PORTAL);
game.tileMap.setTile(15, 8, TILES.EMERALD);

dirtyPlayer();
game.levelManager.playtestCustomLevel();
assertFreshState("playtestCustomLevel(fresh)");

dirtyPlayer();
game.levelManager.playtestCustomLevel(true);
assertPreservedState("playtestCustomLevel(isRestart)");
console.log("   ✅ Editor playtest start/reset behavior verified.\n");

// Clean up audio and game loop at end of test run
game.audio.stopMusic();
game.audio.stopThrust();
if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
game.loop.stop();

console.log("🎉 ALL NEW GAME STATE RESET TESTS PASSED!\n");
