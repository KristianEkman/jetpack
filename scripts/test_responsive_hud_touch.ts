/* ==========================================================================
   RESPONSIVE HUD & TOUCH CONTROLS TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🧪 Starting Responsive HUD & Mobile Touch Controls Test Suite...\n");

// ── 1. HTML & CSS Static Structure Verification ─────────────────────────────

console.log("1️⃣  Verifying HTML & CSS Responsive Structure...");

const indexHtmlPath = path.resolve(__dirname, "../index.html");
const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");

const hudCssPath = path.resolve(__dirname, "../styles/hud.css");
const hudCss = fs.readFileSync(hudCssPath, "utf-8");

const viewportCssPath = path.resolve(__dirname, "../styles/viewport.css");
const viewportCss = fs.readFileSync(viewportCssPath, "utf-8");

// A. Check HUD mobile bar & dropdown structure
assert.ok(indexHtml.includes('class="hud-mobile-bar"'), "index.html must contain .hud-mobile-bar");
assert.ok(indexHtml.includes('id="btnHudToggle"'), "index.html must contain #btnHudToggle button");
assert.ok(indexHtml.includes('id="hudDropdown"'), "index.html must contain #hudDropdown container");
assert.ok(indexHtml.includes('id="fuelBarFill"'), "Fuel bar fill must exist");
assert.ok(indexHtml.includes('id="fuelText"'), "Fuel text must exist");

// Check that fuel is inside hud-mobile-bar
const mobileBarStart = indexHtml.indexOf('<div class="hud-mobile-bar">');
const dropdownStart = indexHtml.indexOf('<div id="hudDropdown"');
const mobileBarContent = indexHtml.substring(mobileBarStart, dropdownStart);

assert.ok(mobileBarContent.includes("fuel-item"), "fuel-item must be placed inside hud-mobile-bar");
assert.ok(mobileBarContent.includes("btnHudToggle"), "btnHudToggle must be placed inside hud-mobile-bar");

// B. Check that other HUD stats (Level, Score, Lives, Emeralds) are inside hud-dropdown-content
const dropdownContent = indexHtml.substring(dropdownStart, indexHtml.indexOf('</header>'));
assert.ok(dropdownContent.includes('id="hudLevel"'), "hudLevel must be inside dropdown");
assert.ok(dropdownContent.includes('id="hudScore"'), "hudScore must be inside dropdown");
assert.ok(dropdownContent.includes('id="hudLives"'), "hudLives must be inside dropdown");
assert.ok(dropdownContent.includes('id="hudEmeralds"'), "hudEmeralds must be inside dropdown");
assert.ok(dropdownContent.includes('id="btnPause"'), "btnPause must be inside dropdown");

// C. Check that Touch Controls are placed UNDER the canvas / outside canvasWrapper
const canvasWrapperEndIndex = indexHtml.indexOf('</div>\n\n            <!-- Touchscreen Virtual Gamepad');
const touchGamepadIndex = indexHtml.indexOf('id="touchGamepad"');
assert.ok(touchGamepadIndex > 0, "touchGamepad must exist in index.html");
assert.ok(canvasWrapperEndIndex > 0 && touchGamepadIndex > canvasWrapperEndIndex, "touchGamepad must be placed outside and below canvasWrapper");

// D. Check CSS responsive rules
assert.ok(hudCss.includes("@media (max-width: 768px)"), "hud.css must contain responsive media query");
assert.ok(hudCss.includes(".hud-bar.hud-open .hud-dropdown-content"), "hud.css must support .hud-open state");
assert.ok(viewportCss.includes(".touch-gamepad"), "viewport.css must style touch gamepad");

console.log("   ✅ HTML & CSS structure verified.\n");

// ── 2. Headless DOM Mock Verification of UIManager & InputHandler ───────────

console.log("2️⃣  Testing Interactive Behavior in Mock DOM...");

import {
  MockElement,
  createMockElement,
  getOrRegisterMockElement,
  setupMockDom,
  elementCache,
} from "./test_mock_dom.js";

setupMockDom();
const elementMap = elementCache;

// Setup child for btnHudToggle
const toggleTextEl = createMockElement("toggleText", "span");
toggleTextEl.className = "hud-toggle-text";
toggleTextEl.textContent = "HUD ▾";
getOrRegisterMockElement("btnHudToggle").appendChild(toggleTextEl);


// Dynamically import UIManager & InputHandler
const { UIManager } = await import("../js/ui/uiManager.js");
const { InputHandler } = await import("../js/engine/input.js");

// Mock Game
const mockGame: any = {
  input: {
    onPausePress: null,
  },
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
  player: {
    score: 1250,
    lives: 3,
    fuel: 85,
    rapidFireTimer: 0,
  },
  tileMap: {
    collectedEmeralds: 4,
    totalEmeralds: 10,
  },
  currentLevelIndex: 2,
  isCustomLevel: false,
  togglePause: () => {},
  resumeGame: () => {},
  levelManager: {
    startLevel: () => {},
  },
  network: {
    connect: () => {},
    listRooms: () => {},
  },
};

const uiManager = new UIManager(mockGame);
uiManager.bindUI();

const gameHud = elementMap.get("gameHud")!;
const btnHudToggle = elementMap.get("btnHudToggle")!;

// Test 1: Toggle HUD dropdown open
console.log("3️⃣  Testing HUD Dropdown Toggle Click...");
assert.equal(gameHud.classList.contains("hud-open"), false, "HUD should initially be closed");
assert.equal(btnHudToggle.getAttribute("aria-expanded"), null);

btnHudToggle.dispatchEvent({ type: "click", stopPropagation: () => {} });
assert.equal(gameHud.classList.contains("hud-open"), true, "HUD should be open after toggle click");
assert.equal(btnHudToggle.getAttribute("aria-expanded"), "true", "aria-expanded should be true");
assert.equal(toggleTextEl.textContent, "HUD ▴", "Toggle text should display open arrow");

// Test 2: Toggle HUD dropdown closed
btnHudToggle.dispatchEvent({ type: "click", stopPropagation: () => {} });
assert.equal(gameHud.classList.contains("hud-open"), false, "HUD should be closed after second toggle click");
assert.equal(btnHudToggle.getAttribute("aria-expanded"), "false", "aria-expanded should be false");
assert.equal(toggleTextEl.textContent, "HUD ▾", "Toggle text should display closed arrow");

// Test 3: Outside click closing
btnHudToggle.dispatchEvent({ type: "click", stopPropagation: () => {} });
assert.equal(gameHud.classList.contains("hud-open"), true);

const outsideTarget = createMockElement("outsideDiv");
(window as unknown as { dispatchEvent: (event: unknown) => boolean }).dispatchEvent({ type: "click", target: outsideTarget });
assert.equal(gameHud.classList.contains("hud-open"), false, "Outside click should close HUD dropdown");


assert.equal(btnHudToggle.getAttribute("aria-expanded"), "false");
console.log("   ✅ Dropdown open, close, and outside-click mechanics verified.");

// Test 4: updateHUD updates fuel and metrics
console.log("4️⃣  Testing HUD updates (Fuel Level & Stats)...");
uiManager.updateHUD();
assert.equal(elementMap.get("fuelBarFill")!.style.width, "85%", "Fuel fill bar should be 85%");
assert.equal(elementMap.get("fuelText")!.textContent, "85%", "Fuel text should display 85%");
assert.equal(elementMap.get("hudLevel")!.textContent, "3", "Level should display 3");
assert.equal(elementMap.get("hudScore")!.textContent, "001250", "Score should display 001250");
console.log("   ✅ HUD values update verified.");

// Test 5: Mobile Touch Controls binding
console.log("5️⃣  Testing Virtual Gamepad Touch Bindings...");
const inputHandler = new InputHandler();

const touchUp = elementMap.get("touchUp")!;
const touchDown = elementMap.get("touchDown")!;
const touchLeft = elementMap.get("touchLeft")!;
const touchRight = elementMap.get("touchRight")!;
const touchJetpack = elementMap.get("touchJetpack")!;
const touchPhase = elementMap.get("touchPhase")!;

// Test touch buttons press & release
touchJetpack.dispatchEvent({ type: "touchstart", preventDefault: () => {} });
assert.equal(inputHandler.keys.thrust, true, "touchJetpack touchstart should set thrust key");

touchJetpack.dispatchEvent({ type: "touchend", preventDefault: () => {} });
assert.equal(inputHandler.keys.thrust, false, "touchJetpack touchend should release thrust key");

touchLeft.dispatchEvent({ type: "touchstart", preventDefault: () => {} });
assert.equal(inputHandler.keys.left, true, "touchLeft touchstart should set left key");

touchLeft.dispatchEvent({ type: "touchcancel", preventDefault: () => {} });
assert.equal(inputHandler.keys.left, false, "touchLeft touchcancel should safely release left key");

touchPhase.dispatchEvent({ type: "mousedown", preventDefault: () => {} });
assert.equal(inputHandler.keys.phase, true, "touchPhase mousedown should set phase key");

touchPhase.dispatchEvent({ type: "mouseup", preventDefault: () => {} });
assert.equal(inputHandler.keys.phase, false, "touchPhase mouseup should release phase key");

console.log("   ✅ Virtual touch gamepad controls verified.");

console.log("\n🎉 ALL RESPONSIVE HUD & TOUCH CONTROLS TESTS PASSED PERFECTLY!");
