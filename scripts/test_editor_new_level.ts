/* ==========================================================================
   LEVEL EDITOR "CREATE NEW LEVEL" RESET TEST SUITE
   Verifies that LevelEditor.resetForNewLevel() produces a truly fresh canvas
   (blank grid, no lingering level id/name/release flag) so uploading a new
   level never silently overwrites a previously edited one.
   ========================================================================== */

import assert from "node:assert/strict";

import { setupMockDom } from "./test_mock_dom.js";
import type { CustomLevelHeader } from "../js/shared/payloads.js";


// ── 1. Headless DOM & Web API Mock Harness ─────────────────────────────────
setupMockDom({ playerColor: "#00ffcc" });


// ── 2. Dynamic Import of Game Controller & Dependencies ────────────────────

const { Game } = await import("../js/game.js");
const { TILES } = await import("../js/world/tilemap.js");

console.log("🧪 Starting Level Editor New-Level Reset Test Suite...\n");

const game = new Game();

// ── Test 1: Reset clears a dirty editor state ──────────────────────────────
console.log("1️⃣  Testing resetForNewLevel clears dirty editor state...");

// Simulate a previously edited/uploaded level sitting in the editor
game.tileMap.setTile(3, 3, TILES.BRICK);
game.tileMap.setTile(5, 5, TILES.EMERALD);
game.editor.currentLevelId = "existing-level-123";
game.editor.levelName = "My Old Level";
game.editor.isReleased = false;

game.editor.resetForNewLevel();

assert.ok(
  game.tileMap.grid.every((t: number) => t === TILES.AIR),
  "Grid should be completely cleared to AIR",
);
assert.equal(game.editor.currentLevelId, null, "currentLevelId should be reset to null (new upload, not update)");
assert.equal(game.editor.levelName, "Custom Level", "levelName should reset to default");
assert.equal(game.editor.isReleased, true, "isReleased should reset to default true");
console.log("   ✅ Dirty editor state fully reset.\n");

// ── Test 2: Upload after reset would create, not update ────────────────────
console.log("2️⃣  Testing fresh editor uploads as a new level...");

assert.equal(
  game.editor.currentLevelId,
  null,
  "Upload flow keys off currentLevelId — null means POST (create) instead of PUT (update)",
);
console.log("   ✅ Reset guarantees create-not-update upload behavior.\n");

// ── Test 3: Reset is idempotent on an already-blank canvas ─────────────────
console.log("3️⃣  Testing resetForNewLevel is idempotent...");

game.editor.resetForNewLevel();
assert.ok(
  game.tileMap.grid.every((t: number) => t === TILES.AIR),
  "Grid should still be all AIR after a second reset",
);
assert.equal(game.editor.currentLevelId, null, "currentLevelId still null");
console.log("   ✅ Idempotent reset verified.\n");

// ── Test 4: Community list shows the user's own levels at the top ──────────
console.log("4️⃣  Testing own levels are pinned to the top of the community list...");

localStorage.setItem("jetpack_user_id", "user-1");

const makeHeader = (id: string, authorId: string, name: string): CustomLevelHeader => ({
  id,
  name,
  authorId,
  authorName: `Author ${authorId}`,
  createdAt: 1,
  updatedAt: 1,
  highScore: 0,
  highScoreUser: "",
  averageRating: 0,
  ratingCount: 0,
  isReleased: true,
});

game.levelManager.fetchCustomLevels = async () => [
  makeHeader("lvl-a", "user-2", "Other Level A"),
  makeHeader("lvl-b", "user-1", "My Level B"),
  makeHeader("lvl-c", "user-3", "Other Level C"),
  makeHeader("lvl-d", "user-1", "My Level D"),
];

await game.uiManager.loadCommunityLevelsUI();

const listContainer = document.getElementById("communityLevelList");
assert.ok(listContainer, "Community level list container should exist");
assert.equal(listContainer.children.length, 4, "All 4 levels should be rendered");
assert.ok(
  listContainer.children[0].innerHTML.includes("My Level B"),
  "First card should be the user's own level B",
);
assert.ok(
  listContainer.children[1].innerHTML.includes("My Level D"),
  "Second card should be the user's own level D",
);
assert.ok(
  listContainer.children[2].innerHTML.includes("Other Level A"),
  "Other players' levels should follow after own levels",
);
console.log("   ✅ Own levels pinned to the top, others keep their order.\n");

// ── Test 5: Order is unchanged when logged out ─────────────────────────────
console.log("5️⃣  Testing list order is untouched when logged out...");

localStorage.removeItem("jetpack_user_id");
await game.uiManager.loadCommunityLevelsUI();

assert.ok(
  listContainer.children[0].innerHTML.includes("Other Level A"),
  "Logged-out view should keep the original server order",
);
console.log("   ✅ Logged-out order unchanged.\n");

// Clean up audio and game loop at end of test run
game.audio.stopMusic();
game.audio.stopThrust();
if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
game.loop.stop();

console.log("🎉 ALL LEVEL EDITOR NEW-LEVEL RESET TESTS PASSED PERFECTLY!\n");
