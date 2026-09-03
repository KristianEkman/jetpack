/* ==========================================================================
   AUTH GATING TEST SUITE
   Validates that guests can play the campaign without logging in, while
   multiplayer and the startup flow correctly require / skip authentication.
   ========================================================================== */

import assert from "node:assert/strict";

console.log("🧪 Starting Auth Gating Test Suite...\n");

import { setupMockDom, getOrRegisterMockElement } from "./test_mock_dom.js";

setupMockDom();

// Dynamically import modules under test (after mock DOM is in place)
const { userAuthUI } = await import("../js/ui/userAuthUI.js");
const { userService } = await import("../js/network/userService.js");
const { UIManager } = await import("../js/ui/uiManager.js");

// ── 1. Guest startup does not force the login modal ─────────────────────────

console.log("1️⃣  Verifying guests are not prompted to log in on startup...");

const authModal = getOrRegisterMockElement("userAuthModal");
authModal.classList.add("hidden");

userAuthUI.init();
// Allow the validateSession() promise chain to settle
await new Promise((resolve) => setTimeout(resolve, 10));

assert.equal(
  authModal.classList.contains("hidden"),
  true,
  "Login modal must NOT auto-open for guests on startup",
);
assert.equal(userService.isLoggedIn(), false, "No user should be logged in");
console.log("   ✅ Startup leaves guests at the main menu, no forced login.\n");

// ── 2. Wire up the main menu via UIManager with a mock game ─────────────────

console.log("2️⃣  Binding main menu buttons with a mock game...");

const calls: Record<string, number> = {
  connect: 0,
  listRooms: 0,
  showHubView: 0,
  startLevel: 0,
};

const mockGame: any = {
  isMultiplayer: true,
  isCanvasRenderedForState: true,
  currentLevelIndex: 0,
  input: { onPausePress: null },
  audio: {
    isSfxMuted: false,
    isMusicMuted: false,
    toggleSfx: () => false,
    toggleMusic: () => false,
    toggleMute: () => false,
    startMenuMusic: () => {},
    stopThrust: () => {},
    stopMusic: () => {},
  },
  player: { score: 0, lives: 3, fuel: 100, rapidFireTimer: 0 },
  tileMap: { collectedEmeralds: 0, totalEmeralds: 0 },
  togglePause: () => {},
  resumeGame: () => {},
  levelManager: {
    startLevel: () => {
      calls.startLevel++;
    },
  },
  multiplayerController: {
    showHubView: () => {
      calls.showHubView++;
    },
  },
  network: {
    connect: () => {
      calls.connect++;
    },
    listRooms: () => {
      calls.listRooms++;
    },
  },
};

const uiManager = new UIManager(mockGame);
uiManager.bindUI();

const dlgMultiplayer = getOrRegisterMockElement("dlgMultiplayer");
dlgMultiplayer.classList.add("hidden");
console.log("   ✅ UI bound.\n");

// ── 3. Guests CAN start the campaign ────────────────────────────────────────

console.log("3️⃣  Verifying guests can start the campaign...");

getOrRegisterMockElement("btnStartGame").dispatchEvent({ type: "click" });

assert.equal(calls.startLevel, 1, "Campaign level 1 should start for a guest");
assert.equal(mockGame.isMultiplayer, false, "Campaign start must force single-player mode");
console.log("   ✅ Campaign starts without any account.\n");

// ── 4. Guests are blocked from multiplayer ──────────────────────────────────

console.log("4️⃣  Verifying guests are blocked from multiplayer...");

getOrRegisterMockElement("btnMultiplayer").dispatchEvent({ type: "click" });

assert.equal(calls.connect, 0, "Guest must NOT trigger network.connect()");
assert.equal(calls.listRooms, 0, "Guest must NOT trigger network.listRooms()");
assert.equal(calls.showHubView, 0, "Guest must NOT reach the multiplayer hub");
assert.equal(
  dlgMultiplayer.classList.contains("hidden"),
  true,
  "Multiplayer dialog must stay closed for guests",
);
assert.equal(
  authModal.classList.contains("hidden"),
  false,
  "Login modal should open when a guest clicks MULTIPLAYER",
);
assert.equal(
  getOrRegisterMockElement("bannerText").textContent,
  "PLEASE LOG IN TO PLAY MULTIPLAYER",
  "Guest should see a login-required banner",
);
console.log("   ✅ Multiplayer requires a logged-in user.\n");

// ── 5. Logged-in users reach the multiplayer hub ────────────────────────────

console.log("5️⃣  Verifying logged-in users can play multiplayer...");

localStorage.setItem("jetpack_user_id", "user-test-123");
localStorage.setItem("jetpack_user_name", "TestPilot");

getOrRegisterMockElement("btnMultiplayer").dispatchEvent({ type: "click" });

assert.equal(calls.connect, 1, "Logged-in user should trigger network.connect()");
assert.equal(calls.listRooms, 1, "Logged-in user should trigger network.listRooms()");
assert.equal(calls.showHubView, 1, "Logged-in user should reach the multiplayer hub");
assert.equal(
  dlgMultiplayer.classList.contains("hidden"),
  false,
  "Multiplayer dialog should open for logged-in users",
);
console.log("   ✅ Multiplayer hub opens for logged-in users.\n");

console.log("🎉 ALL AUTH GATING TESTS PASSED PERFECTLY!");
