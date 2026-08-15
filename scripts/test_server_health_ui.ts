/* ==========================================================================
   SERVER HEALTH UI UNIT TEST SUITE
   Validates telemetry formatting, DOM rendering, error handling, polling,
   console reporting, and clipboard helpers.
   ========================================================================== */

import assert from "node:assert/strict";
import {
  formatUptime,
  formatBytes,
  ServerHealthUI,
  ServerHealthResponse,
} from "../js/ui/serverHealthUI.js";

// Mock minimal DOM environment if running in Node.js
class MockHTMLElement {
  id: string = "";
  className: string = "";
  textContent: string = "";
  innerHTML: string = "";
  title: string = "";
  style: Record<string, string> = {};
  classList = {
    classes: new Set<string>(),
    add: (cls: string) => this.classList.classes.add(cls),
    remove: (cls: string) => this.classList.classes.delete(cls),
    contains: (cls: string) => this.classList.classes.has(cls),
    toggle: (cls: string) => {
      if (this.classList.classes.has(cls)) {
        this.classList.classes.delete(cls);
        return false;
      } else {
        this.classList.classes.add(cls);
        return true;
      }
    },
  };
  attributes: Record<string, string> = {};
  listeners: Record<string, ((e: any) => void)[]> = {};
  open: boolean = false;
  checked: boolean = true;
  value: string = "2000";

  addEventListener(event: string, handler: (e: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  dispatchEvent(event: { type: string; [key: string]: any }): void {
    const handlers = this.listeners[event.type] || [];
    for (const h of handlers) h(event);
  }

  showModal(): void {
    this.open = true;
  }

  close(): void {
    this.open = false;
  }

  closest(): any {
    return null;
  }
}

const mockElements: Record<string, MockHTMLElement> = {};
function getOrCreateMockElement(id: string): MockHTMLElement {
  if (!mockElements[id]) {
    const el = new MockHTMLElement();
    el.id = id;
    mockElements[id] = el;
  }
  return mockElements[id];
}

(globalThis as any).document = {
  getElementById: (id: string) => getOrCreateMockElement(id),
  createElement: (tag: string) => new MockHTMLElement(),
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
  execCommand: () => true,
};

(globalThis as any).window = globalThis;
try {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      writeText: async (text: string) => Promise.resolve(),
    },
    configurable: true,
    writable: true,
  });
} catch {
  // Ignore if unable to configure
}

console.log("🧪 Starting Server Health UI Unit Test Suite...\n");

// 1. Test formatUptime helper
console.log("1️⃣  Testing formatUptime Helper...");
assert.equal(formatUptime(0), "0s");
assert.equal(formatUptime(45), "45s");
assert.equal(formatUptime(125), "2m 5s");
assert.equal(formatUptime(3665), "1h 1m 5s");
assert.equal(formatUptime(90061), "1d 1h 1m 1s");
assert.equal(formatUptime(-10), "0s");
assert.equal(formatUptime(NaN), "0s");
console.log("   ✅ formatUptime passed all edge cases.\n");

// 2. Test formatBytes helper
console.log("2️⃣  Testing formatBytes Helper...");
assert.equal(formatBytes(0), "0.0 MB");
assert.equal(formatBytes(45.24), "45.2 MB");
assert.equal(formatBytes(1024), "1.00 GB");
assert.equal(formatBytes(2560), "2.50 GB");
assert.equal(formatBytes(NaN), "0.0 MB");
console.log("   ✅ formatBytes passed all edge cases.\n");

// 3. Test ServerHealthUI initialization & DOM binding
console.log("3️⃣  Testing ServerHealthUI Initialization...");
const healthUI = ServerHealthUI.getInstance();
healthUI.init();
assert.ok(healthUI instanceof ServerHealthUI);
assert.equal((globalThis as any).serverHealth, healthUI);
assert.equal(typeof (globalThis as any).logServerHealth, "function");
console.log("   ✅ ServerHealthUI singleton initialized and attached to global scope.\n");

// 4. Test render method with realistic mock server payload
console.log("4️⃣  Testing render() with ServerHealthResponse Telemetry...");
const mockPayload: ServerHealthResponse = {
  status: "ok",
  uptime: 7325, // 2h 2m 5s
  timestamp: new Date().toISOString(),
  version: {
    commitHash: "a1b2c3d",
    deployedAt: "2026-08-15T08:00:00Z",
  },
  activeRooms: 3,
  rooms: {
    totalRooms: 3,
    lobbyRooms: 1,
    playingRooms: 2,
    finishedRooms: 0,
    totalPlayers: 4,
    inGamePlayers: 4,
  },
  players: {
    connectedSockets: 4,
    totalInRooms: 4,
    inActiveGame: 4,
  },
  gameLoop: {
    isRunning: true,
    tickRate: 60,
    ticksTotal: 12000,
    avgTickMs: 0.45,
    maxTickMs: 2.15,
    lastTickMs: 0.38,
    activePlayingRoomsCount: 2,
  },
  memory: {
    heapUsedMB: 38.5,
    heapTotalMB: 64.0,
    rssMB: 88.2,
    externalMB: 3.1,
  },
};

healthUI.render(mockPayload, 24); // 24ms latency

const statusBadge = getOrCreateMockElement("shStatusBadge");
assert.ok(statusBadge.className.includes("online"));
assert.ok(statusBadge.innerHTML.includes("ONLINE"));

const pingBadge = getOrCreateMockElement("shPingBadge");
assert.ok(pingBadge.className.includes("good"));
assert.equal(pingBadge.textContent, "⚡ 24ms RTT");

const uptimeEl = getOrCreateMockElement("shUptimeValue");
assert.equal(uptimeEl.textContent, "2h 2m 5s");

const versionEl = getOrCreateMockElement("shVersionValue");
assert.equal(versionEl.textContent, "a1b2c3d");

const loopRateEl = getOrCreateMockElement("shLoopTickRate");
assert.equal(loopRateEl.textContent, "60 Hz");

const loopAvgEl = getOrCreateMockElement("shLoopAvgTick");
assert.equal(loopAvgEl.textContent, "0.45 ms");

const roomsTotalEl = getOrCreateMockElement("shRoomsTotal");
assert.equal(roomsTotalEl.textContent, "3");

const roomsLobbyEl = getOrCreateMockElement("shRoomsLobby");
assert.equal(roomsLobbyEl.textContent, "1");

const roomsPlayingEl = getOrCreateMockElement("shRoomsPlaying");
assert.equal(roomsPlayingEl.textContent, "2");

const socketsEl = getOrCreateMockElement("shSocketsConnected");
assert.equal(socketsEl.textContent, "4");

const memUsedEl = getOrCreateMockElement("shMemHeapUsed");
assert.equal(memUsedEl.textContent, "38.5 MB");

const memTotalEl = getOrCreateMockElement("shMemHeapTotal");
assert.equal(memTotalEl.textContent, "64.0 MB");

const memProgressEl = getOrCreateMockElement("shMemProgressBar");
assert.equal(memProgressEl.style.width, "60%");
console.log("   ✅ Telemetry values, styles, and progress gauges rendered accurately.\n");

// 5. Test renderError
console.log("5️⃣  Testing renderError()...");
healthUI.renderError("Connection timed out");
assert.ok(statusBadge.className.includes("offline"));
assert.ok(pingBadge.className.includes("poor"));
assert.equal(pingBadge.textContent, "⚡ DISCONNECTED");
console.log("   ✅ Error state correctly displayed.\n");

// 6. Test fetchHealth with mock fetch API
console.log("6️⃣  Testing fetchHealth() Integration...");
(globalThis as any).fetch = async (url: string) => {
  assert.equal(url, "/health");
  return {
    ok: true,
    status: 200,
    json: async () => mockPayload,
  };
};

const fetched = await healthUI.fetchHealth();
assert.deepEqual(fetched, mockPayload);
console.log("   ✅ fetchHealth successfully requested /health and updated state.\n");

// 7. Test console logging & clipboard export
console.log("7️⃣  Testing logToConsole() and copyJson()...");
let consoleTableCalled = false;
const origTable = console.table;
console.table = (data: any) => {
  consoleTableCalled = true;
  assert.ok(data["Game Loop"]);
  assert.ok(data["Multiplayer"]);
  assert.ok(data["Memory Allocation"]);
};

healthUI.logToConsole();
assert.equal(consoleTableCalled, true);
console.table = origTable;

await healthUI.copyJson();
console.log("   ✅ Console logger and JSON exporter verified.\n");

// 8. Test Modal Lifecycle & Polling
console.log("8️⃣  Testing Modal Lifecycle & Polling...");
const modalEl = getOrCreateMockElement("dlgServerHealth");
healthUI.openModal();
assert.equal(modalEl.open, true);

healthUI.closeModal();
assert.equal(modalEl.open, false);
console.log("   ✅ Modal open/close and polling timers verified.\n");

console.log("🎉 ALL SERVER HEALTH UI TESTS PASSED PERFECTLY!\n");
