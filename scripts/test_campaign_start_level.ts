/* ==========================================================================
   CAMPAIGN LEADERBOARD START-LEVEL GATING TEST SUITE
   Verifies that only campaign runs started at Stage 1 are eligible for the
   Top 10 campaign leaderboard: picking a later stage in the level select
   (or retrying there after a game over) must not submit scores.
   ========================================================================== */

import assert from "node:assert/strict";

import { setupMockDom, getOrRegisterMockElement } from "./test_mock_dom.js";

setupMockDom({});

const { Game } = await import("../js/game.js");
const { CAMPAIGN_LEVELS } = await import("../js/levels/campaign.js");
const { leaderboardService } = await import("../js/network/leaderboardService.js");

console.log("🧪 Running Campaign Leaderboard Start-Level Gating Test Suite...\n");

const game = new Game();
game.isMultiplayer = false;
game.isCustomLevel = false;
getOrRegisterMockElement("campaignCompleteLeaderboardNotice");
getOrRegisterMockElement("gameOverLeaderboardNotice");

// Count how often the run-end flow would talk to the leaderboard backend.
let qualifyChecks = 0;
const origCheck = leaderboardService.checkIfScoreQualifies.bind(leaderboardService);
leaderboardService.checkIfScoreQualifies = async (): Promise<boolean> => {
  qualifyChecks++;
  return false; // stop before any auth/submission path
};

// ── 1. Fresh start at a later stage is tracked ─────────────────────────────
console.log("1️⃣  Testing that a level-select start records the start stage...");
{
  const lastIndex = CAMPAIGN_LEVELS.length - 1;
  game.levelManager.startLevel(lastIndex);
  assert.equal(
    game.campaignStartLevelIndex,
    lastIndex,
    "fresh start at the final stage should record it as the run start",
  );
}
console.log("   ✅ Level-select start stage tracked.\n");

// ── 2. Completing the campaign from a late start skips the leaderboard ─────
console.log("2️⃣  Testing that a Stage 10 run is NOT submitted to the leaderboard...");
{
  game.player.score = 50000;
  qualifyChecks = 0;
  await game.handleCampaignRunEnd(true);
  assert.equal(
    qualifyChecks,
    0,
    "run started at Stage 10 should never reach the leaderboard qualification check",
  );
}
console.log("   ✅ Late-start run excluded from leaderboard.\n");

// ── 3. Game over on a late-start run also skips the leaderboard ────────────
console.log("3️⃣  Testing game-over on a late-start run...");
{
  qualifyChecks = 0;
  await game.handleCampaignRunEnd(false);
  assert.equal(qualifyChecks, 0, "game over after a late start should skip the leaderboard too");
}
console.log("   ✅ Late-start game over excluded from leaderboard.\n");

// ── 4. Full campaign from Stage 1 stays eligible ───────────────────────────
console.log("4️⃣  Testing that a Stage 1 run still reaches the leaderboard...");
{
  game.levelManager.startLevel(0);
  assert.equal(game.campaignStartLevelIndex, 0, "fresh start at Stage 1 should record stage 0");

  // Campaign progression and death restarts must keep the original start stage.
  game.levelManager.startLevel(1, false, true);
  assert.equal(game.campaignStartLevelIndex, 0, "next-level progression should keep the run start");
  game.levelManager.startLevel(1, true);
  assert.equal(game.campaignStartLevelIndex, 0, "death restart should keep the run start");

  game.player.score = 50000;
  qualifyChecks = 0;
  await game.handleCampaignRunEnd(true);
  assert.equal(qualifyChecks, 1, "Stage 1 run should still check leaderboard qualification");
}
console.log("   ✅ Stage 1 run remains leaderboard-eligible.\n");

// ── 5. Game-over retry at a later stage starts a new (ineligible) run ──────
console.log("5️⃣  Testing retry-after-game-over at a later stage...");
{
  game.levelManager.startLevel(0);
  game.levelManager.startLevel(4, false, true); // progress to stage 5
  game.levelManager.restartCurrentLevel(false); // retry after game over: fresh run here
  assert.equal(
    game.campaignStartLevelIndex,
    4,
    "retry after game over begins a fresh run from the current stage",
  );

  game.player.score = 50000;
  qualifyChecks = 0;
  await game.handleCampaignRunEnd(true);
  assert.equal(qualifyChecks, 0, "retried run from stage 5 should skip the leaderboard");
}
console.log("   ✅ Game-over retry correctly re-anchors the run start.\n");

leaderboardService.checkIfScoreQualifies = origCheck;

// Clean up audio and game loop at end of test run
game.audio.stopMusic();
game.audio.stopThrust();
if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
game.loop.stop();

console.log("🎉 ALL CAMPAIGN START-LEVEL GATING TESTS PASSED!\n");
