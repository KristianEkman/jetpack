/* ==========================================================================
   CAMPAIGN COMPLETE CELEBRATION TEST SUITE
   Verifies the campaign finale: new game state, final-level detection,
   fireworks show, victory fanfare, and the celebration flow in Game.
   ========================================================================== */

import assert from "node:assert/strict";

import { setupMockDom, getOrRegisterMockElement } from "./test_mock_dom.js";

setupMockDom({});

const { Game, GAME_STATES } = await import("../js/game.js");
const { CAMPAIGN_LEVELS } = await import("../js/levels/campaign.js");
const { isFinalCampaignLevel } = await import("../js/levels/levelManager.js");
const { FireworksShow } = await import("../js/world/fireworks.js");
const { TileMap } = await import("../js/world/tilemap.js");
const { AudioManager } = await import("../js/audio/audioManager.js");

console.log("🧪 Running Campaign Complete Celebration Test Suite...\n");

// ── 1. New game state exists ───────────────────────────────────────────────
console.log("1️⃣  Testing CAMPAIGN_COMPLETE game state...");
assert.equal(
  GAME_STATES.CAMPAIGN_COMPLETE,
  "campaign_complete",
  "GAME_STATES should include CAMPAIGN_COMPLETE",
);
console.log("   ✅ CAMPAIGN_COMPLETE state verified.\n");

// ── 2. Final campaign level detection ──────────────────────────────────────
console.log("2️⃣  Testing isFinalCampaignLevel() boundary...");
const lastIndex = CAMPAIGN_LEVELS.length - 1;
assert.equal(isFinalCampaignLevel(lastIndex), true, "last index should be final");
assert.equal(isFinalCampaignLevel(lastIndex - 1), false, "second-to-last index should not be final");
assert.equal(isFinalCampaignLevel(0), false, "first index should not be final");
console.log(`   ✅ Final-level boundary verified (campaign has ${CAMPAIGN_LEVELS.length} levels).\n`);

// ── 3. FireworksShow spawns bursts and shockwaves ──────────────────────────
console.log("3️⃣  Testing FireworksShow particle & shockwave spawning...");
{
  const tileMap = new TileMap();
  const fireworks = new FireworksShow();

  fireworks.update(0.016, tileMap);
  assert.equal(tileMap.particles.length, 42, "first burst should spawn 42 sparkle particles");
  const shockwaves = tileMap.debris.filter((d: { type: string }) => d.type === "shockwave");
  assert.equal(shockwaves.length, 1, "first burst should also spawn a shockwave ring");
  assert.equal(shockwaves[0].radius, 6, "shockwave should start with a small radius");
  assert.ok((shockwaves[0].speed ?? 0) > 0, "shockwave should expand over time");

  fireworks.update(1.0, tileMap);
  assert.equal(tileMap.particles.length, 84, "second burst should add 42 more particles");
  assert.equal(
    tileMap.debris.filter((d: { type: string }) => d.type === "shockwave").length,
    1,
    "second burst should not spawn another shockwave (every 3rd burst only)",
  );

  fireworks.reset();
  assert.equal(fireworks.burstCount, 0, "reset should clear burstCount");
  assert.equal(fireworks.spawnTimer, 0, "reset should clear spawnTimer");
}
console.log("   ✅ FireworksShow spawning verified.\n");

// ── 4. Victory fanfare exists on the audio stack ───────────────────────────
console.log("4️⃣  Testing campaign fanfare audio hook...");
{
  const audio = new AudioManager();
  assert.equal(typeof audio.playCampaignFanfare, "function", "AudioManager should expose playCampaignFanfare");
  audio.playCampaignFanfare();
}
console.log("   ✅ playCampaignFanfare verified.\n");

// ── 5. Full celebration flow through Game/LevelManager ─────────────────────
console.log("5️⃣  Testing campaign-complete flow via triggerLevelComplete()...");
const game = new Game();
let portalWarps = 0;
const origPortalWarp = game.audio.playPortalWarp.bind(game.audio);
game.audio.playPortalWarp = (): void => {
  portalWarps++;
};
let fanfares = 0;
const origFanfare = game.audio.playCampaignFanfare.bind(game.audio);
game.audio.playCampaignFanfare = (): void => {
  fanfares++;
  origFanfare();
};

{
  const dlgCampaign = getOrRegisterMockElement("dlgCampaignComplete");
  let campaignDialogShown = false;
  dlgCampaign.showModal = (): void => {
    campaignDialogShown = true;
  };

  game.gameState = GAME_STATES.PLAYING;
  game.isMultiplayer = false;
  game.isCustomLevel = false;
  game.currentLevelIndex = CAMPAIGN_LEVELS.length - 1;
  game.player.score = 5000;
  game.player.fuel = 50;
  game.levelManager.celebrationDialogDelaySec = 0.05;

  game.levelManager.triggerLevelComplete();

  assert.equal(
    game.gameState,
    GAME_STATES.CAMPAIGN_COMPLETE,
    "finishing the final level should enter CAMPAIGN_COMPLETE",
  );
  assert.equal(fanfares, 1, "campaign fanfare should play on the final level");
  assert.equal(portalWarps, 0, "portal warp should be skipped on the final level so it does not mask the fanfare");
  assert.equal(game.player.score, 6500, "final level score bonus (1000 + fuel) should still be added");
  assert.equal(
    campaignDialogShown,
    false,
    "dialog should be deferred so the fireworks play over the visible level first",
  );
  assert.equal(
    getOrRegisterMockElement("statCampaignScore").textContent,
    "006500",
    "campaign score stat should be padded to 6 digits",
  );
  assert.equal(game.fireworks.burstCount, 0, "fireworks show should be reset for the finale");

  // The celebration state keeps particles flowing but freezes the player
  const playerX = game.player.x;
  game.update(0.016);
  assert.ok(game.tileMap.particles.length > 0, "update() in CAMPAIGN_COMPLETE should spawn fireworks");
  assert.equal(game.player.x, playerX, "player should not move during the celebration");
  assert.equal(game.gameState, GAME_STATES.CAMPAIGN_COMPLETE, "state should remain CAMPAIGN_COMPLETE");

  // The dialog appears after the celebration delay
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(campaignDialogShown, true, "dlgCampaignComplete should be shown after the celebration delay");
}
console.log("   ✅ Campaign-complete flow verified.\n");

// ── 6. Non-final levels still use the regular level-complete flow ──────────
console.log("6️⃣  Testing regular level-complete flow is preserved...");
{
  const dlgLevel = getOrRegisterMockElement("dlgLevelComplete");
  let levelDialogShown = false;
  dlgLevel.showModal = (): void => {
    levelDialogShown = true;
  };

  game.gameState = GAME_STATES.PLAYING;
  game.currentLevelIndex = 2;

  game.levelManager.triggerLevelComplete();

  assert.equal(
    game.gameState,
    GAME_STATES.LEVEL_COMPLETE,
    "finishing a non-final level should enter LEVEL_COMPLETE",
  );
  assert.equal(levelDialogShown, true, "dlgLevelComplete should be shown for non-final levels");
  assert.equal(portalWarps, 1, "portal warp should still play on non-final levels");
  assert.equal(fanfares, 1, "campaign fanfare should not play again on non-final levels");

  game.audio.playPortalWarp = origPortalWarp;
  game.audio.playCampaignFanfare = origFanfare;
}
console.log("   ✅ Regular level-complete flow verified.\n");

// Clean up audio and game loop at end of test run
game.audio.stopMusic();
game.audio.stopThrust();
if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
game.loop.stop();

console.log("🎉 ALL CAMPAIGN COMPLETE CELEBRATION TESTS PASSED!\n");
