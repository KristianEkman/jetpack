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
assert.ok(hudCss.includes("hudDropdownSlide"), "hud.css must include animation for dropdown slide");
assert.ok(viewportCss.includes(".touch-gamepad"), "viewport.css must style touch gamepad");

console.log("   ✅ HTML & CSS structure verified.\n");

// ── 2. Headless DOM Mock Verification of UIManager & InputHandler ───────────

console.log("2️⃣  Testing Interactive Behavior in Mock DOM...");

interface MockElement {
  id: string;
  tagName: string;
  className: string;
  classList: {
    classes: Set<string>;
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    contains: (token: string) => boolean;
    toggle: (token: string, force?: boolean) => boolean;
  };
  style: Record<string, string>;
  dataset: Record<string, string>;
  textContent: string;
  innerHTML: string;
  value: string;
  attributes: Record<string, string>;
  children: MockElement[];
  parentElement: MockElement | null;
  listeners: Record<string, ((e?: any) => void)[]>;
  addEventListener: (event: string, handler: (event?: any) => void) => void;
  removeEventListener: (event: string, handler: (event?: any) => void) => void;
  dispatchEvent: (event: { type: string; preventDefault?: () => void; stopPropagation?: () => void; target?: any }) => boolean;
  appendChild: <T extends MockElement>(child: T) => T;
  removeChild: <T extends MockElement>(child: T) => T;
  querySelector: (selector: string) => MockElement | null;
  querySelectorAll: (selector: string) => MockElement[];
  setAttribute: (key: string, val: string) => void;
  getAttribute: (key: string) => string | null;
  closest: (selector: string) => MockElement | null;
  showModal: () => void;
  close: () => void;
  open?: boolean;
}

function createMockElement(id: string, tagName = "div"): MockElement {
  const classes = new Set<string>();
  const el: MockElement = {
    id,
    tagName: tagName.toUpperCase(),
    className: "",
    classList: {
      classes,
      add: (...tokens: string[]) => {
        tokens.forEach((t) => classes.add(t));
        el.className = Array.from(classes).join(" ");
      },
      remove: (...tokens: string[]) => {
        tokens.forEach((t) => classes.delete(t));
        el.className = Array.from(classes).join(" ");
      },
      contains: (token: string) => classes.has(token),
      toggle: (token: string, force?: boolean) => {
        const has = classes.has(token);
        const next = force !== undefined ? force : !has;
        if (next) classes.add(token);
        else classes.delete(token);
        el.className = Array.from(classes).join(" ");
        return next;
      },
    },
    style: {},
    dataset: {},
    textContent: "",
    innerHTML: "",
    value: "",
    attributes: {},
    children: [],
    parentElement: null,
    listeners: {},
    addEventListener(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
    removeEventListener(event, handler) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
      }
    },
    dispatchEvent(event) {
      const handlers = this.listeners[event.type] || [];
      event.target = event.target || this;
      handlers.forEach((h) => h(event));
      return true;
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentElement = null;
      return child;
    },
    querySelector(selector) {
      if (selector === ".hud-toggle-text") {
        return this.children.find((c) => c.className.includes("hud-toggle-text")) || null;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    setAttribute(key, val) {
      this.attributes[key] = val;
    },
    getAttribute(key) {
      return this.attributes[key] || null;
    },
    closest(selector) {
      if (selector === "#gameHud" && (this.id === "gameHud" || this.parentElement?.id === "gameHud")) {
        return this;
      }
      return null;
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  return el;
}

// Setup Global Mock DOM
const elementMap = new Map<string, MockElement>();
[
  "appContainer",
  "gameHud",
  "hudDropdown",
  "btnHudToggle",
  "hudLevel",
  "hudScore",
  "hudLives",
  "hudEmeralds",
  "fuelBarFill",
  "fuelText",
  "hudPowerup",
  "hudPowerupText",
  "userAccountBadge",
  "btnUserAuth",
  "btnPause",
  "btnSound",
  "btnMusic",
  "btnCRT",
  "gameVersionBadge",
  "versionCommit",
  "versionDate",
  "errorMonitorBadge",
  "errorMonitorCount",
  "errorMonitorTooltip",
  "touchGamepad",
  "touchUp",
  "touchLeft",
  "touchRight",
  "touchDown",
  "touchJetpack",
  "touchPhase",
  "gameCanvas",
  "crtOverlay",
  "bannerNotification",
  "bannerText",
  "dlgMainMenu",
  "dlgPause"
].forEach((id) => {
  const el = createMockElement(id);
  elementMap.set(id, el);
});

// Setup child for btnHudToggle
const toggleTextEl = createMockElement("toggleText", "span");
toggleTextEl.className = "hud-toggle-text";
toggleTextEl.textContent = "HUD ▾";
elementMap.get("btnHudToggle")?.appendChild(toggleTextEl);

const windowListeners: Record<string, ((e?: any) => void)[]> = {};
(globalThis as any).window = {
  addEventListener(event: string, handler: (e?: any) => void) {
    if (!windowListeners[event]) windowListeners[event] = [];
    windowListeners[event].push(handler);
  },
  removeEventListener(event: string, handler: (e?: any) => void) {
    if (windowListeners[event]) {
      windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
    }
  },
  matchMedia: (query: string) => ({ matches: false }),
};

(globalThis as any).document = {
  getElementById: (id: string) => elementMap.get(id) || null,
  querySelector: (sel: string) => null,
  querySelectorAll: (sel: string) => [],
  addEventListener: () => {},
};

(globalThis as any).fetch = async () => ({
  ok: true,
  json: async () => ({ commitHash: "test1234", deployedAt: "2026-08-16" }),
});

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
const windowClickHandlers = windowListeners["click"] || [];
windowClickHandlers.forEach((h) => h({ target: outsideTarget }));
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
