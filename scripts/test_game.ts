/* ==========================================================================
   GAME MODULE (js/game.ts) UNIT TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";

// ── 1. Headless DOM & Web API Mock Harness ─────────────────────────────────

interface MockElement {
  id: string;
  tagName: string;
  className: string;
  classList: {
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
  checked: boolean;
  disabled: boolean;
  width: number;
  height: number;
  children: MockElement[];
  parentElement: MockElement | null;
  addEventListener: (event: string, handler: (event?: unknown) => void) => void;
  removeEventListener: (event: string, handler: (event?: unknown) => void) => void;
  dispatchEvent: (event: unknown) => boolean;
  appendChild: <T extends MockElement>(child: T) => T;
  removeChild: <T extends MockElement>(child: T) => T;
  querySelector: (selector: string) => MockElement | null;
  querySelectorAll: (selector: string) => MockElement[];
  getBoundingClientRect: () => {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  focus: () => void;
  blur: () => void;
  click: () => void;
  showModal: () => void;
  close: () => void;
  getContext?: (type: string) => MockCanvasRenderingContext2D;
}

interface MockCanvasRenderingContext2D {
  canvas: MockElement;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (x: number, y: number, r: number, sa: number, ea: number) => void;
  fill: () => void;
  stroke: () => void;
  save: () => void;
  restore: () => void;
  fillText: (text: string, x: number, y: number) => void;
  strokeText: (text: string, x: number, y: number) => void;
  measureText: (text: string) => { width: number };
  drawImage: (...args: unknown[]) => void;
  createLinearGradient: (...args: unknown[]) => unknown;
  createRadialGradient: (...args: unknown[]) => unknown;
  setLineDash: (...args: unknown[]) => void;
  translate: (...args: unknown[]) => void;
  scale: (...args: unknown[]) => void;
  rotate: (...args: unknown[]) => void;
  filledRects: Array<{ x: number; y: number; w: number; h: number; style: string }>;
  filledTexts: Array<{ text: string; x: number; y: number; style: string }>;
}

const elementCache = new Map<string, MockElement>();

function createMockContext2D(canvas: MockElement): MockCanvasRenderingContext2D {
  const filledRects: Array<{ x: number; y: number; w: number; h: number; style: string }> = [];
  const filledTexts: Array<{ text: string; x: number; y: number; style: string }> = [];

  const ctx: MockCanvasRenderingContext2D = {
    canvas,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number): void {
      this.filledRects.push({ x, y, w, h, style: this.fillStyle });
    },
    strokeRect(): void {},
    clearRect(): void {},
    beginPath(): void {},
    closePath(): void {},
    moveTo(): void {},
    lineTo(): void {},
    arc(): void {},
    fill(): void {},
    stroke(): void {},
    save(): void {},
    restore(): void {},
    fillText(text: string, x: number, y: number): void {
      this.filledTexts.push({ text, x, y, style: this.fillStyle });
    },
    strokeText(): void {},
    measureText(): { width: number } {
      return { width: 10 };
    },
    drawImage(): void {},
    createLinearGradient(): unknown {
      return { addColorStop(): void {} };
    },
    createRadialGradient(): unknown {
      return { addColorStop(): void {} };
    },
    setLineDash(): void {},
    translate(): void {},
    scale(): void {},
    rotate(): void {},
    filledRects,
    filledTexts,
  };
  return ctx;
}

function createMockElement(id: string = "", tagName: string = "div"): MockElement {
  const classes = new Set<string>();
  const listeners: Record<string, Array<(event?: unknown) => void>> = {};

  const el: MockElement = {
    id,
    tagName: tagName.toUpperCase(),
    className: "",
    classList: {
      add(...tokens: string[]): void {
        tokens.forEach((t) => classes.add(t));
        el.className = Array.from(classes).join(" ");
      },
      remove(...tokens: string[]): void {
        tokens.forEach((t) => classes.delete(t));
        el.className = Array.from(classes).join(" ");
      },
      contains(token: string): boolean {
        return classes.has(token);
      },
      toggle(token: string, force?: boolean): boolean {
        const next = force !== undefined ? force : !classes.has(token);
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
    checked: false,
    disabled: false,
    width: tagName.toLowerCase() === "canvas" ? 960 : 0,
    height: tagName.toLowerCase() === "canvas" ? 576 : 0,
    children: [],
    parentElement: null,
    addEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    dispatchEvent(event: unknown): boolean {
      const type = (event as { type?: string })?.type;
      if (type && listeners[type]) {
        listeners[type].forEach((h) => h(event));
      }
      return true;
    },
    appendChild<T extends MockElement>(child: T): T {
      el.children.push(child);
      child.parentElement = el;
      return child;
    },
    removeChild<T extends MockElement>(child: T): T {
      el.children = el.children.filter((c) => c !== child);
      child.parentElement = null;
      return child;
    },
    querySelector(selector: string): MockElement | null {
      if (selector.startsWith("#")) {
        return getOrRegisterMockElement(selector.slice(1));
      }
      return createMockElement("", selector);
    },
    querySelectorAll(): MockElement[] {
      return [];
    },
    getBoundingClientRect(): {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    } {
      return {
        left: 0,
        top: 0,
        right: el.width || 960,
        bottom: el.height || 576,
        width: el.width || 960,
        height: el.height || 576,
      };
    },
    focus(): void {},
    blur(): void {},
    click(): void {
      if (listeners["click"]) {
        listeners["click"].forEach((h) => h({ target: el, stopPropagation(): void {} }));
      }
    },
    showModal(): void {
      el.classList.remove("hidden");
    },
    close(): void {
      el.classList.add("hidden");
    },
  };

  if (tagName.toLowerCase() === "canvas") {
    const ctx = createMockContext2D(el);
    el.getContext = () => ctx;
  }

  return el;
}

function getOrRegisterMockElement(id: string, tagName: string = "div"): MockElement {
  if (!elementCache.has(id)) {
    elementCache.set(id, createMockElement(id, tagName));
  }
  return elementCache.get(id)!;
}

// Setup global mock environment before importing game module
function setupMockGlobals(): void {
  // Pre-seed canvas
  getOrRegisterMockElement("gameCanvas", "canvas");

  const storage = new Map<string, string>();
  storage.set("jetpack_player_color", "#00ffcc");

  const mockLocalStorage = {
    getItem(key: string): string | null {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, val: string): void {
      storage.set(key, String(val));
    },
    removeItem(key: string): void {
      storage.delete(key);
    },
    clear(): void {
      storage.clear();
    },
  };

  const windowListeners: Record<string, Array<(event?: unknown) => void>> = {};

  const mockWindow = {
    location: {
      hostname: "localhost",
      href: "http://localhost:3000",
    },
    innerWidth: 960,
    innerHeight: 576,
    localStorage: mockLocalStorage,
    requestAnimationFrame(cb: (time: number) => void): number {
      return setTimeout(() => cb(Date.now()), 16) as unknown as number;
    },
    cancelAnimationFrame(id: number): void {
      clearTimeout(id);
    },
    addEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(handler);
    },
    removeEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!windowListeners[event]) return;
      windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
    },
    dispatchEvent(event: unknown): boolean {
      const type = (event as { type?: string })?.type;
      if (type && windowListeners[type]) {
        windowListeners[type].forEach((h) => h(event));
      }
      return true;
    },
    AudioContext: class {
      state = "running";
      sampleRate = 44100;
      currentTime = 0;
      destination = {};
      resume(): Promise<void> {
        return Promise.resolve();
      }
      createGain(): unknown {
        return {
          gain: {
            value: 1,
            setValueAtTime: (): void => {},
            exponentialRampToValueAtTime: (): void => {},
            linearRampToValueAtTime: (): void => {},
          },
          connect: (): void => {},
        };
      }
      createOscillator(): unknown {
        return {
          type: "sine",
          frequency: {
            value: 440,
            setValueAtTime: (): void => {},
            exponentialRampToValueAtTime: (): void => {},
            linearRampToValueAtTime: (): void => {},
          },
          connect: (): void => {},
          start: (): void => {},
          stop: (): void => {},
        };
      }
      createBiquadFilter(): unknown {
        return {
          type: "lowpass",
          frequency: {
            value: 350,
            setValueAtTime: (): void => {},
            exponentialRampToValueAtTime: (): void => {},
            linearRampToValueAtTime: (): void => {},
          },
          Q: {
            value: 1,
            setValueAtTime: (): void => {},
          },
          connect: (): void => {},
        };
      }
      createBufferSource(): unknown {
        return {
          buffer: null,
          loop: false,
          connect: (): void => {},
          start: (): void => {},
          stop: (): void => {},
        };
      }
      createBuffer(): unknown {
        return {
          getChannelData(): Float32Array {
            return new Float32Array(4410);
          },
        };
      }
    },
    webkitAudioContext: class {
      state = "running";
      sampleRate = 44100;
      currentTime = 0;
      destination = {};
      resume(): Promise<void> {
        return Promise.resolve();
      }
      createGain(): unknown {
        return {
          gain: {
            value: 1,
            setValueAtTime: (): void => {},
            exponentialRampToValueAtTime: (): void => {},
            linearRampToValueAtTime: (): void => {},
          },
          connect: (): void => {},
        };
      }
      createOscillator(): unknown {
        return {
          type: "sine",
          frequency: {
            value: 440,
            setValueAtTime: (): void => {},
            exponentialRampToValueAtTime: (): void => {},
            linearRampToValueAtTime: (): void => {},
          },
          connect: (): void => {},
          start: (): void => {},
          stop: (): void => {},
        };
      }
      createBiquadFilter(): unknown {
        return {
          type: "lowpass",
          frequency: {
            value: 350,
            setValueAtTime: (): void => {},
            exponentialRampToValueAtTime: (): void => {},
            linearRampToValueAtTime: (): void => {},
          },
          Q: {
            value: 1,
            setValueAtTime: (): void => {},
          },
          connect: (): void => {},
        };
      }
    },
    gameInstance: null,
  };

  const mockDocument = {
    getElementById(id: string): MockElement | null {
      if (id === "gameCanvas") {
        return getOrRegisterMockElement("gameCanvas", "canvas");
      }
      return getOrRegisterMockElement(id, "div");
    },
    querySelector(selector: string): MockElement | null {
      if (selector.startsWith("#")) {
        return this.getElementById(selector.slice(1));
      }
      return createMockElement("", selector);
    },
    querySelectorAll(): MockElement[] {
      return [];
    },
    createElement(tagName: string): MockElement {
      return createMockElement("", tagName);
    },
    addEventListener(event: string, handler: (event?: unknown) => void): void {
      mockWindow.addEventListener(event, handler);
    },
    removeEventListener(event: string, handler: (event?: unknown) => void): void {
      mockWindow.removeEventListener(event, handler);
    },
    body: createMockElement("body", "body"),
  };

  const g = globalThis as unknown as Record<string, unknown>;
  g.window = mockWindow;
  g.document = mockDocument;
  g.localStorage = mockLocalStorage;
  g.requestAnimationFrame = mockWindow.requestAnimationFrame;
  g.cancelAnimationFrame = mockWindow.cancelAnimationFrame;
  g.HTMLCanvasElement = class HTMLCanvasElement {};
  g.HTMLElement = class HTMLElement {};
  g.HTMLButtonElement = class HTMLButtonElement {};
  g.HTMLInputElement = class HTMLInputElement {};
  g.HTMLDialogElement = class HTMLDialogElement {};
  g.fetch = async (): Promise<{ ok: boolean; json: () => Promise<unknown> }> => {
    return {
      ok: true,
      json: async (): Promise<unknown> => ({ success: true }),
    };
  };
}

setupMockGlobals();

// ── 2. Dynamic Import of Game Controller & Dependencies ────────────────────

const { Game, GAME_STATES } = await import("../js/game.js");
const { TILES, TILE_SIZE } = await import("../js/world/tilemap.js");

console.log("🧪 Starting Master Game Controller (js/game.ts) Test Suite...\n");

// ── Test 1: Initialization and Initial State ───────────────────────────────
console.log("1️⃣  Testing Game Initialization & Default Properties...");
const game = new Game();

assert.equal(game.gameState, GAME_STATES.MENU, "Initial gameState should be MENU");
assert.equal(game.isMultiplayer, false, "Initial isMultiplayer should be false");
assert.equal(game.currentLevelIndex, 0, "Initial currentLevelIndex should be 0");
assert.equal(game.isCustomLevel, false, "Initial isCustomLevel should be false");
assert.equal(game.deathSequenceTimer, 0, "Initial deathSequenceTimer should be 0");
assert.equal(game.isDeathHandled, false, "Initial isDeathHandled should be false");
assert.equal(game.selectedColor, "#00ffcc", "selectedColor should load from localStorage");

assert.ok(game.canvas, "Canvas element should be initialized");
assert.ok(game.ctx, "Canvas 2D context should be initialized");
assert.ok(game.audio, "AudioManager should be initialized");
assert.ok(game.input, "InputHandler should be initialized");
assert.ok(game.tileMap, "TileMap should be initialized");
assert.ok(game.player, "Player should be initialized");
assert.ok(game.enemyManager, "EnemyManager should be initialized");
assert.ok(game.playerManager, "PlayerManager should be initialized");
assert.ok(game.network, "NetworkManager should be initialized");
assert.ok(game.uiManager, "UIManager should be initialized");
assert.ok(game.levelManager, "LevelManager should be initialized");
assert.ok(game.multiplayerController, "MultiplayerController should be initialized");
assert.ok(game.editor, "LevelEditor should be initialized");
assert.ok(game.loop, "GameLoop should be initialized");
assert.equal(game.loop.isRunning, true, "GameLoop should be started on initialization");
console.log("   ✅ Game initialization and sub-manager bindings verified.\n");

// ── Test 2: Pause and Resume Mechanics ────────────────────────────────────
console.log("2️⃣  Testing Pause & Resume Mechanics...");
// Cannot pause from MENU
game.gameState = GAME_STATES.MENU;
game.togglePause();
assert.equal(game.gameState, GAME_STATES.MENU, "togglePause should do nothing when in MENU state");

// Pause from PLAYING state
game.gameState = GAME_STATES.PLAYING;
game.togglePause();
assert.equal(game.gameState, GAME_STATES.PAUSED, "togglePause should transition PLAYING -> PAUSED");

// Calling togglePause while already PAUSED should not unpause
game.togglePause();
assert.equal(game.gameState, GAME_STATES.PAUSED, "togglePause should do nothing when already PAUSED");

// Resume game from PAUSED state
let musicStartedLevel: number | null = null;
const origStartGameMusic = game.audio.startGameMusic.bind(game.audio);
game.audio.startGameMusic = (lvlIndex: number): void => {
  musicStartedLevel = lvlIndex;
  origStartGameMusic(lvlIndex);
};

game.currentLevelIndex = 2;
game.resumeGame();
assert.equal(game.gameState, GAME_STATES.PLAYING, "resumeGame should transition PAUSED -> PLAYING");
assert.equal(musicStartedLevel, 2, "resumeGame should restart music for currentLevelIndex");

// Calling resumeGame when already PLAYING should do nothing
musicStartedLevel = null;
game.resumeGame();
assert.equal(game.gameState, GAME_STATES.PLAYING);
assert.equal(musicStartedLevel, null, "resumeGame should do nothing when not in PAUSED state");
console.log("   ✅ Pause and resume state transitions verified.\n");

// ── Test 3: Update Loop State Filtering ────────────────────────────────────
console.log("3️⃣  Testing Update Loop State Filtering & Spectating Mode...");
let tileMapUpdated = false;
const origTileMapUpdate = game.tileMap.update.bind(game.tileMap);
game.tileMap.update = (...args: unknown[]): void => {
  tileMapUpdated = true;
};

// State: MENU -> update should early return
game.gameState = GAME_STATES.MENU;
tileMapUpdated = false;
game.update(0.016);
assert.equal(tileMapUpdated, false, "update(dt) should return early when gameState is MENU");

// State: PAUSED -> update should early return
game.gameState = GAME_STATES.PAUSED;
tileMapUpdated = false;
game.update(0.016);
assert.equal(tileMapUpdated, false, "update(dt) should return early when gameState is PAUSED");

// State: SPECTATING -> update runs tileMap and HUD, then returns before player input
game.gameState = GAME_STATES.SPECTATING;
tileMapUpdated = false;
let playerUpdated = false;
const origPlayerUpdate = game.player.update.bind(game.player);
game.player.update = (): void => {
  playerUpdated = true;
};

game.update(0.016);
assert.equal(tileMapUpdated, true, "update(dt) should update tileMap in SPECTATING mode");
assert.equal(playerUpdated, false, "update(dt) should NOT update local player input in SPECTATING mode");

// Restore methods
game.tileMap.update = origTileMapUpdate;
game.player.update = origPlayerUpdate;
console.log("   ✅ State filtering in update loop verified.\n");

// ── Test 4: Single-Player Death Sequence & Game Over ───────────────────────
console.log("4️⃣  Testing Single-Player Death Sequence, Time Dilation & Game Over...");
game.gameState = GAME_STATES.PLAYING;
game.isMultiplayer = false;
game.player.isDead = true;
game.player.lives = 2;
game.deathSequenceTimer = 0;
game.isDeathHandled = false;

let restartedLevel = false;
const origRestart = game.levelManager.restartCurrentLevel.bind(game.levelManager);
game.levelManager.restartCurrentLevel = (isRestart?: boolean): void => {
  restartedLevel = true;
};

// Advance small time step (<0.25s) -> effectiveDt time dilation
game.update(0.1);
assert.equal(game.deathSequenceTimer, 0.1, "deathSequenceTimer should accumulate dt");
assert.equal(game.isDeathHandled, false, "Death should not be handled before 1.8s");
assert.equal(restartedLevel, false);

// Advance past 1.8s with lives > 0 -> should trigger level restart
game.update(1.8);
assert.equal(game.isDeathHandled, true, "isDeathHandled should be true when timer reaches 1.8s");
assert.equal(restartedLevel, true, "restartCurrentLevel should be called when lives > 0");

// Test Game Over when lives <= 0
game.player.isDead = true;
game.player.lives = 0;
game.deathSequenceTimer = 0;
game.isDeathHandled = false;
game.player.score = 5400;

game.update(1.9);
assert.equal(game.gameState, GAME_STATES.GAME_OVER, "gameState should transition to GAME_OVER when lives <= 0");
assert.equal(game.isDeathHandled, true);

const gameOverStats = document.getElementById("gameOverStats");
assert.ok(gameOverStats?.textContent.includes("005400"), "Game over stats should display formatted score");

// Test resetting death handled state once player is alive again
game.gameState = GAME_STATES.PLAYING;
game.player.isDead = false;
game.update(0.016);
assert.equal(game.deathSequenceTimer, 0, "deathSequenceTimer should reset when player is alive");
assert.equal(game.isDeathHandled, false, "isDeathHandled should reset when player is alive");

game.levelManager.restartCurrentLevel = origRestart;
console.log("   ✅ Death sequence and Game Over mechanics verified.\n");

// ── Test 5: Exit Portal & Level Complete Triggers ──────────────────────────
console.log("5️⃣  Testing Exit Portal & Level Complete Logic...");
game.gameState = GAME_STATES.PLAYING;
game.player.isDead = false;
game.isMultiplayer = false;

// Setup tilemap with exit portal at (1, 1)
game.tileMap.cols = 30;
game.tileMap.rows = 18;
game.tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
game.tileMap.setTile(1, 1, TILES.EXIT_PORTAL);
game.tileMap.collectedEmeralds = 0;
game.tileMap.totalEmeralds = 0;

// Position player on tile (1, 1)
game.player.x = 1 * TILE_SIZE;
game.player.y = 1 * TILE_SIZE;

let singlePlayerCompleted = false;
const origTriggerLevelComplete = game.levelManager.triggerLevelComplete.bind(game.levelManager);
game.levelManager.triggerLevelComplete = (): void => {
  singlePlayerCompleted = true;
};

game.update(0.016);
assert.equal(singlePlayerCompleted, true, "Single player should trigger levelManager.triggerLevelComplete on exit portal");

// In multiplayer mode, exit portal should notify network and set LEVEL_COMPLETE
game.isMultiplayer = true;
let multiplayerLevelCompleted = false;
game.network.completeLevel = (): void => {
  multiplayerLevelCompleted = true;
};

game.update(0.016);
assert.equal(game.gameState, GAME_STATES.LEVEL_COMPLETE, "Multiplayer game should transition to LEVEL_COMPLETE on exit portal");
assert.equal(multiplayerLevelCompleted, true, "network.completeLevel() should be dispatched in multiplayer mode");

game.levelManager.triggerLevelComplete = origTriggerLevelComplete;
console.log("   ✅ Exit portal collision and level completion verified.\n");

// ── Test 6: Multiplayer Network Hooks & Spectating on Death ────────────────
console.log("6️⃣  Testing Multiplayer Hooks, Damage Notifications & Spectating...");
game.isMultiplayer = true;
game.gameState = GAME_STATES.PLAYING;

// Test enemy destroyed hook forwarding over network
let destroyedEnemyIdSent: string | null = null;
game.network.sendEnemyDestroyed = (enemyId: string): void => {
  destroyedEnemyIdSent = enemyId;
};

game.enemyManager.onEnemyDestroyed?.({ enemyId: "enemy-alpha", playerId: "player-1" });
assert.equal(destroyedEnemyIdSent, "enemy-alpha", "enemyManager.onEnemyDestroyed should forward to network.sendEnemyDestroyed");

// Test player damage notification over network when transition from alive -> dead
let sendPlayerDiedReason: string | null = null;
game.network.sendPlayerDied = (reason: string): void => {
  sendPlayerDiedReason = reason;
};

game.player.isDead = false;
const origPlayerUpdateMulti = game.player.update.bind(game.player);
game.player.update = (): void => {
  game.player.isDead = true;
};

game.update(0.016);
assert.equal(sendPlayerDiedReason, "local_damage", "sendPlayerDied should be dispatched when player dies in multiplayer");
game.player.update = origPlayerUpdateMulti;

// Test out-of-lives in multiplayer transitions to SPECTATING
game.player.lives = 0;
game.deathSequenceTimer = 0;
game.isDeathHandled = false;

game.update(1.9);
assert.equal(game.gameState, GAME_STATES.SPECTATING, "Out of lives in multiplayer should transition to SPECTATING state");
console.log("   ✅ Multiplayer enemy destruction, death dispatch, and spectating mode verified.\n");

// ── Test 7: Canvas Rendering Pipeline & Optimization ───────────────────────
console.log("7️⃣  Testing Canvas Rendering Pipeline & State Caching...");
const mockCtx = game.ctx as unknown as MockCanvasRenderingContext2D;

// Test standard render pass
game.gameState = GAME_STATES.PLAYING;
mockCtx.filledRects = [];
game.render(0.016);
assert.ok(mockCtx.filledRects.length > 0, "render() should execute canvas draw operations");
assert.equal(mockCtx.filledRects[0].style, "#05070c", "First draw operation should clear canvas with background color");

// Test level editor hover preview rendering
game.gameState = GAME_STATES.LEVEL_EDITOR;
let editorPreviewRendered = false;
const origRenderHoverPreview = game.editor.renderHoverPreview.bind(game.editor);
game.editor.renderHoverPreview = (): void => {
  editorPreviewRendered = true;
};

game.render(0.016);
assert.equal(editorPreviewRendered, true, "render() should call editor.renderHoverPreview in LEVEL_EDITOR state");
game.editor.renderHoverPreview = origRenderHoverPreview;

// Test spectating banner rendering
game.gameState = GAME_STATES.SPECTATING;
mockCtx.filledTexts = [];
game.render(0.016);
const spectatingBanner = mockCtx.filledTexts.find((t) => t.text.includes("OUT OF LIVES - SPECTATING"));
assert.ok(spectatingBanner, "render() should draw spectating banner in SPECTATING state");

// Test state caching optimization (skipping redundant re-renders for paused/menu/game_over)
game.gameState = GAME_STATES.PAUSED;
game.isCanvasRenderedForState = false;
mockCtx.filledRects = [];

// First pass renders
game.render(0.016);
assert.equal(game.isCanvasRenderedForState, true, "First render in PAUSED state should set isCanvasRenderedForState to true");
assert.ok(mockCtx.filledRects.length > 0, "First render in PAUSED state should draw to canvas");

// Second pass skips
mockCtx.filledRects = [];
game.render(0.016);
assert.equal(mockCtx.filledRects.length, 0, "Subsequent render in PAUSED state should skip redundant canvas drawing");

// Transitioning back to PLAYING resets flag
game.gameState = GAME_STATES.PLAYING;
game.render(0.016);
assert.equal(game.isCanvasRenderedForState, false, "Rendering in PLAYING state should reset isCanvasRenderedForState");
console.log("   ✅ Rendering pipeline, editor previews, and state caching verified.\n");

// ── Test 8: Sub-Manager Delegation & Passthrough Methods ───────────────────
console.log("8️⃣  Testing Sub-Manager Delegation Methods...");
let uiMethodCalled: string | null = null;
game.uiManager.showDialog = (id: string): void => {
  uiMethodCalled = `showDialog:${id}`;
};
game.uiManager.closeAllDialogs = (): void => {
  uiMethodCalled = "closeAllDialogs";
};
game.uiManager.showBanner = (text: string): void => {
  uiMethodCalled = `showBanner:${text}`;
};
game.uiManager.updateHUD = (): void => {
  uiMethodCalled = "updateHUD";
};

game.showDialog("dlgCustom");
assert.equal(uiMethodCalled, "showDialog:dlgCustom", "game.showDialog should delegate to uiManager");
game.closeAllDialogs();
assert.equal(uiMethodCalled, "closeAllDialogs", "game.closeAllDialogs should delegate to uiManager");
game.showBanner("HELLO");
assert.equal(uiMethodCalled, "showBanner:HELLO", "game.showBanner should delegate to uiManager");
game.updateHUD();
assert.equal(uiMethodCalled, "updateHUD", "game.updateHUD should delegate to uiManager");

let levelMethodCalled: string | null = null;
game.levelManager.startLevel = (idx: number, isRestart?: boolean): void => {
  levelMethodCalled = `startLevel:${idx}:${isRestart}`;
};
game.levelManager.openLevelSelect = (): void => {
  levelMethodCalled = "openLevelSelect";
};
game.levelManager.openLevelEditor = (): void => {
  levelMethodCalled = "openLevelEditor";
};
game.levelManager.playtestCustomLevel = (): void => {
  levelMethodCalled = "playtestCustomLevel";
};

game.startLevel(3, true);
assert.equal(levelMethodCalled, "startLevel:3:true", "game.startLevel should delegate to levelManager");
game.openLevelSelect();
assert.equal(levelMethodCalled, "openLevelSelect", "game.openLevelSelect should delegate to levelManager");
game.openLevelEditor();
assert.equal(levelMethodCalled, "openLevelEditor", "game.openLevelEditor should delegate to levelManager");
game.playtestCustomLevel();
assert.equal(levelMethodCalled, "playtestCustomLevel", "game.playtestCustomLevel should delegate to levelManager");

let mpMethodCalled: string | null = null;
game.multiplayerController.showLobbyView = (): void => {
  mpMethodCalled = "showLobbyView";
};
game.multiplayerController.startMultiplayerMatch = (): void => {
  mpMethodCalled = "startMultiplayerMatch";
};

game.showLobbyView();
assert.equal(mpMethodCalled, "showLobbyView", "game.showLobbyView should delegate to multiplayerController");
game.startMultiplayerMatch();
assert.equal(mpMethodCalled, "startMultiplayerMatch", "game.startMultiplayerMatch should delegate to multiplayerController");
console.log("   ✅ Sub-manager delegation methods verified.\n");

// Clean up audio and game loop at end of test run
game.audio.stopMusic();
game.audio.stopThrust();
if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
game.loop.stop();

console.log("🎉 ALL JS/GAME.TS UNIT TESTS PASSED PERFECTLY!\n");
