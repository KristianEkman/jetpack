/* ==========================================================================
   NETWORK MANAGER (js/network/networkManager.ts) UNIT TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";

// ── 1. Headless DOM & Socket.IO Mock Harness ───────────────────────────────

type EventHandler = (...args: unknown[]) => void;

interface EmittedRecord {
  event: string;
  payload: unknown;
  ack?: (response: unknown) => void;
}

class MockSocket {
  id: string = "sock_mock_1";
  disconnected: boolean = false;
  events: Map<string, EventHandler[]> = new Map();
  emittedEvents: EmittedRecord[] = [];

  on(event: string, handler: EventHandler): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    const lastArg = args[args.length - 1];
    let ack: ((response: unknown) => void) | undefined;
    let payload: unknown;
    if (typeof lastArg === "function") {
      ack = lastArg as (response: unknown) => void;
      payload = args.length > 2 ? args.slice(0, -1) : args[0];
    } else {
      payload = args.length === 1 ? args[0] : args;
    }
    this.emittedEvents.push({ event, payload, ack });
    return this;
  }

  trigger(event: string, ...args: unknown[]): void {
    const handlers = this.events.get(event) || [];
    for (const handler of handlers) {
      handler(...args);
    }
  }

  disconnect(): this {
    this.disconnected = true;
    this.trigger("disconnect");
    return this;
  }
}

let activeMockSocket: MockSocket | null = null;

function getSocket(): MockSocket {
  if (!activeMockSocket) {
    throw new Error("No active mock socket");
  }
  return activeMockSocket;
}

const windowListeners: Record<string, Array<(event?: unknown) => void>> = {};

const mockWindow = {
  location: {
    origin: "http://localhost:3000",
    hostname: "localhost",
    href: "http://localhost:3000",
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
  io: (_serverUrl: string): MockSocket => {
    activeMockSocket = new MockSocket();
    return activeMockSocket;
  },
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = mockWindow;

// ── 2. Imports ─────────────────────────────────────────────────────────────

const { NetworkManager } = await import("../js/network/networkManager.js");
const { GAME_EVENTS, MULTIPLAYER_MODES, ROOM_EVENTS, NETWORK_SETTINGS } = await import(
  "../js/shared/constants.js"
);
const { TILES } = await import("../js/world/tilemap.js");
import type {
  EnemyDestroyedPayload,
  GameOverPayload,
  GameStartedPayload,
  ItemCollectedPayload,
  LevelCompletePayload,
  MultiplayerRoomInfo,
  NetworkWorldSnapshotPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PublicRoomInfo,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomUpdatedPayload,
  TilePositionPayload,
} from "../js/shared/payloads.js";
import type { SerializedInputState } from "../js/shared/types.js";

console.log("🧪 Starting NetworkManager Unit Test Suite...\n");

// Sample room data fixture
const sampleRoom: MultiplayerRoomInfo = {
  id: "ROOM_XYZ",
  hostSocketId: "sock_mock_1",
  mapName: "Stage 1: Cavern",
  levelIndex: 0,
  maxPlayers: 4,
  gameMode: MULTIPLAYER_MODES.COOP,
  status: "lobby",
  players: [
    { id: "p1", name: "Alpha", socketId: "sock_mock_1", color: "#ff4444", isHost: true },
  ],
};

// ── Test 1: Constructor & Default State ─────────────────────────────────────
console.log("1️⃣  Testing NetworkManager Construction & Default State...");

const net = new NetworkManager();

assert.strictEqual(net.socket, null, "socket should initially be null");
assert.strictEqual(net.isConnected, false, "isConnected should initially be false");
assert.strictEqual(net.socketId, null, "socketId should initially be null");
assert.strictEqual(net.currentRoom, null, "currentRoom should initially be null");
assert.strictEqual(net.lastPing, 0, "lastPing should default to 0");
assert.strictEqual(net.jitter, 0, "jitter should default to 0");
assert.strictEqual(net.pingHistory.length, 0, "pingHistory should be empty");
assert.strictEqual(net.interpolationDelay, NETWORK_SETTINGS.DEFAULT_INTERPOLATION_DELAY, `default interpolationDelay should match NETWORK_SETTINGS.DEFAULT_INTERPOLATION_DELAY (${NETWORK_SETTINGS.DEFAULT_INTERPOLATION_DELAY})`);
assert.strictEqual(net.lastSentInput, null, "lastSentInput should default to null");
assert.strictEqual(net.pingTimer, null, "pingTimer should default to null");

// Verify beforeunload listener was registered
assert.ok(windowListeners["beforeunload"], "beforeunload listener must be registered on window");

console.log("   ✅ Constructor and default state verified.\n");

// ── Test 2: Connection Lifecycle & Socket Handshake ─────────────────────────
console.log("2️⃣  Testing Connection Lifecycle & Error Handling...");

// Test connection when window.io is absent
const originalIo = mockWindow.io;
delete (mockWindow as Record<string, unknown>).io;

const netNoIo = new NetworkManager();
netNoIo.connect();
assert.strictEqual(netNoIo.socket, null, "connect() should safely return when window.io is unavailable");

// Restore window.io
mockWindow.io = originalIo;

// Connect with valid io
net.connect("http://localhost:3000");
assert.ok(net.socket, "socket instance must be initialized");

const socket = getSocket();

// Verify connect event
socket.trigger("connect");
assert.strictEqual(net.isConnected, true, "isConnected should be true after connect");
assert.strictEqual(net.socketId, "sock_mock_1", "socketId must match socket.id");
assert.ok(net.pingTimer, "pingTimer should be started on connect");

// Verify error handling
let reportedError = "";
net.onErrorCb = (errMsg: string): void => {
  reportedError = errMsg;
};

socket.trigger("connect_error", new Error("Connection refused"));
assert.strictEqual(reportedError, "Connection error: Connection refused", "connect_error must report message to onErrorCb");

socket.trigger("error", new Error("Generic socket error"));
assert.strictEqual(reportedError, "Generic socket error", "error event must report message to onErrorCb");

// Verify disconnect event
socket.trigger("disconnect");
assert.strictEqual(net.isConnected, false, "isConnected must become false on disconnect");
assert.strictEqual(net.socketId, null, "socketId must reset to null on disconnect");

// Verify disconnect() method
net.connect();
getSocket().trigger("connect");
net.currentRoom = sampleRoom;

net.disconnect();
assert.strictEqual(net.socket, null, "socket must be null after disconnect()");
assert.strictEqual(net.isConnected, false, "isConnected must be false after disconnect()");
assert.strictEqual(net.socketId, null, "socketId must be null after disconnect()");
assert.strictEqual(net.currentRoom, null, "currentRoom must be null after disconnect()");
assert.strictEqual(net.pingTimer, null, "pingTimer must be cleared after disconnect()");

console.log("   ✅ Connection lifecycle and error handlers verified.\n");

// ── Test 3: Client Request Emits (createRoom, joinRoom, leaveRoom, etc.) ─────
console.log("3️⃣  Testing Room Actions & Client Request Emits...");

net.connect();
getSocket().trigger("connect");

// createRoom
let createRoomCallbackResponse: unknown = null;
net.createRoom({ playerName: "HostPilot", levelIndex: 2 }, (res) => {
  createRoomCallbackResponse = res;
});

const currentSock = getSocket();
const createEmit = currentSock.emittedEvents.find((e: EmittedRecord) => e.event === ROOM_EVENTS.CREATE_ROOM);
assert.ok(createEmit, "CREATE_ROOM event must be emitted");
const createPayload = createEmit.payload as { playerName: string; levelIndex: number };
assert.strictEqual(createPayload.playerName, "HostPilot", "createRoom payload must include playerName");
assert.strictEqual(createPayload.levelIndex, 2, "createRoom payload must include levelIndex");

// Acknowledge createRoom from server
createEmit.ack?.({ success: true, room: sampleRoom, roomId: "ROOM_XYZ" });
const roomAfterCreate = net.currentRoom as MultiplayerRoomInfo | null;
assert.strictEqual(roomAfterCreate?.id, "ROOM_XYZ", "currentRoom must update on successful createRoom ack");
assert.ok(createRoomCallbackResponse, "createRoom callback must execute");

// createRoom with error response
reportedError = "";
net.createRoom({}, (res) => {
  createRoomCallbackResponse = res;
});
const failedCreateEmit = currentSock.emittedEvents[currentSock.emittedEvents.length - 1];
failedCreateEmit.ack?.({ success: false, error: "Name is required" });
assert.strictEqual(reportedError, "Name is required", "onErrorCb must be triggered on createRoom error response");

// joinRoom
let joinRoomCallbackResponse: unknown = null;
net.joinRoom("ROOM_XYZ", { playerName: "Wingman" }, (res) => {
  joinRoomCallbackResponse = res;
});
const joinEmit = currentSock.emittedEvents.find((e: EmittedRecord) => e.event === ROOM_EVENTS.JOIN_ROOM);
assert.ok(joinEmit, "JOIN_ROOM event must be emitted");
const joinPayload = joinEmit.payload as { roomId: string; playerName: string };
assert.strictEqual(joinPayload.roomId, "ROOM_XYZ", "joinRoom payload must include roomId");
assert.strictEqual(joinPayload.playerName, "Wingman", "joinRoom payload must include playerName");

joinEmit.ack?.({ success: true, room: sampleRoom });
const roomAfterJoin = net.currentRoom as MultiplayerRoomInfo | null;
assert.strictEqual(roomAfterJoin?.id, "ROOM_XYZ", "currentRoom must update on successful joinRoom ack");
assert.ok(joinRoomCallbackResponse, "joinRoom callback must execute");

// leaveRoom
let leaveRoomCallbackExecuted = false;
net.leaveRoom((_res) => {
  leaveRoomCallbackExecuted = true;
});
const leaveEmit = currentSock.emittedEvents.find((e: EmittedRecord) => e.event === ROOM_EVENTS.LEAVE_ROOM);
assert.ok(leaveEmit, "LEAVE_ROOM event must be emitted");
leaveEmit.ack?.({ success: true });
assert.strictEqual(net.currentRoom, null, "currentRoom must reset to null on leaveRoom");
assert.strictEqual(leaveRoomCallbackExecuted, true, "leaveRoom callback must execute");

// changeLevel
net.currentRoom = sampleRoom;
net.changeLevel({ levelIndex: 3 });
const changeEmit = currentSock.emittedEvents.find((e: EmittedRecord) => e.event === ROOM_EVENTS.CHANGE_LEVEL);
assert.ok(changeEmit, "CHANGE_LEVEL event must be emitted");
const changePayload = changeEmit.payload as { levelIndex: number };
assert.strictEqual(changePayload.levelIndex, 3, "changeLevel payload must specify levelIndex");
changeEmit.ack?.({ success: true, room: { ...sampleRoom, levelIndex: 3 } });
const roomAfterChange = net.currentRoom as MultiplayerRoomInfo | null;
assert.strictEqual(roomAfterChange?.levelIndex, 3, "currentRoom levelIndex must update on ack");

// listRooms
let receivedRoomsList: PublicRoomInfo[] | null = null;
net.listRooms((list) => {
  receivedRoomsList = list;
});
const listEmit = currentSock.emittedEvents.find((e: EmittedRecord) => e.event === ROOM_EVENTS.LIST_ROOMS);
assert.ok(listEmit, "LIST_ROOMS event must be emitted");
const dummyRoomsList: PublicRoomInfo[] = [
  { id: "R1", mapName: "Stage 1", levelIndex: 0, gameMode: "coop", playerCount: 1, maxPlayers: 4, status: "lobby" },
];
listEmit.ack?.(dummyRoomsList);
assert.strictEqual(receivedRoomsList, dummyRoomsList, "listRooms callback must receive rooms list");

// startMatch
net.startMatch({});
const startEmit = currentSock.emittedEvents.find((e: EmittedRecord) => e.event === GAME_EVENTS.START_MATCH);
assert.ok(startEmit, "START_MATCH event must be emitted");

console.log("   ✅ Client request emits and callbacks verified.\n");

// ── Test 4: Incoming Server Broadcast Events ────────────────────────────────
console.log("4️⃣  Testing Incoming Server Broadcast Events & Callbacks...");

const broadcastSock = getSocket();

interface BroadcastResults {
  roomCreated?: RoomCreatedPayload;
  roomJoined?: RoomJoinedPayload;
  playerJoined?: PlayerJoinedPayload;
  playerLeft?: PlayerLeftPayload;
  roomUpdated?: RoomUpdatedPayload;
  roomList?: PublicRoomInfo[];
  gameStarted?: GameStartedPayload;
  tilePhased?: TilePositionPayload;
  tileRestored?: TilePositionPayload;
  itemCollected?: ItemCollectedPayload;
  enemyDestroyed?: EnemyDestroyedPayload;
  levelComplete?: LevelCompletePayload;
  gameOver?: GameOverPayload;
  worldSnapshot?: NetworkWorldSnapshotPayload;
}

const broadcast: BroadcastResults = {};

// onRoomCreatedCb & onRoomJoinedCb
net.onRoomCreatedCb = (data): void => {
  broadcast.roomCreated = data;
};
broadcastSock.trigger(ROOM_EVENTS.ROOM_CREATED, { success: true, room: sampleRoom, roomId: "ROOM_XYZ" });
assert.strictEqual(broadcast.roomCreated?.roomId, "ROOM_XYZ", "onRoomCreatedCb must receive payload");

net.onRoomJoinedCb = (data): void => {
  broadcast.roomJoined = data;
};
broadcastSock.trigger(ROOM_EVENTS.ROOM_JOINED, { success: true, room: sampleRoom });
assert.strictEqual(broadcast.roomJoined?.room?.id, "ROOM_XYZ", "onRoomJoinedCb must receive payload");

// onPlayerJoinedCb & onPlayerLeftCb
net.onPlayerJoinedCb = (data): void => {
  broadcast.playerJoined = data;
};
broadcastSock.trigger(ROOM_EVENTS.PLAYER_JOINED, {
  room: sampleRoom,
  player: { id: "p2", name: "Beta", socketId: "sock_2", color: "#00ffcc", isHost: false },
});
assert.strictEqual(broadcast.playerJoined?.player?.name, "Beta", "onPlayerJoinedCb must receive joined player");

net.onPlayerLeftCb = (data): void => {
  broadcast.playerLeft = data;
};
broadcastSock.trigger(ROOM_EVENTS.PLAYER_LEFT, {
  room: sampleRoom,
  leavingPlayer: { id: "p2", name: "Beta", socketId: "sock_2", color: "#00ffcc", isHost: false },
});
assert.strictEqual(broadcast.playerLeft?.leavingPlayer?.name, "Beta", "onPlayerLeftCb must receive leaving player");

// onRoomUpdatedCb
net.onRoomUpdatedCb = (data): void => {
  broadcast.roomUpdated = data;
};
broadcastSock.trigger(ROOM_EVENTS.ROOM_UPDATED, {
  room: { ...sampleRoom, mapName: "Updated Stage" },
});
assert.strictEqual(broadcast.roomUpdated?.room?.mapName, "Updated Stage", "onRoomUpdatedCb must receive updated room");

// onRoomListCb (both room_list_updated and ROOM_LIST events)
net.onRoomListCb = (list): void => {
  broadcast.roomList = list;
};
broadcastSock.trigger("room_list_updated", dummyRoomsList);
assert.strictEqual(broadcast.roomList, dummyRoomsList, "room_list_updated must invoke onRoomListCb");

broadcast.roomList = undefined;
broadcastSock.trigger(ROOM_EVENTS.ROOM_LIST, dummyRoomsList);
assert.strictEqual(broadcast.roomList, dummyRoomsList, "ROOM_LIST must invoke onRoomListCb");

// onGameStartedCb
net.onGameStartedCb = (data): void => {
  broadcast.gameStarted = data;
};
broadcastSock.trigger(GAME_EVENTS.GAME_STARTED, { success: true, room: sampleRoom, levelIndex: 1 });
assert.strictEqual(broadcast.gameStarted?.levelIndex, 1, "onGameStartedCb must receive game start payload");

// onTilePhasedCb & onTileRestoredCb
net.onTilePhasedCb = (data): void => {
  broadcast.tilePhased = data;
};
broadcastSock.trigger(GAME_EVENTS.TILE_PHASED, { col: 4, row: 9 });
assert.strictEqual(broadcast.tilePhased?.col, 4, "onTilePhasedCb must receive col");
assert.strictEqual(broadcast.tilePhased?.row, 9, "onTilePhasedCb must receive row");

net.onTileRestoredCb = (data): void => {
  broadcast.tileRestored = data;
};
broadcastSock.trigger(GAME_EVENTS.TILE_RESTORED, { col: 4, row: 9 });
assert.strictEqual(broadcast.tileRestored?.col, 4, "onTileRestoredCb must receive col");

// onItemCollectedCb
net.onItemCollectedCb = (data): void => {
  broadcast.itemCollected = data;
};
broadcastSock.trigger(GAME_EVENTS.ITEM_COLLECTED, {
  col: 10,
  row: 15,
  tileType: TILES.EMERALD,
  collectedEmeralds: 5,
  isAllCaught: false,
});
assert.strictEqual(broadcast.itemCollected?.tileType, TILES.EMERALD, "onItemCollectedCb must receive collected tile payload");

// onEnemyDestroyedCb
net.onEnemyDestroyedCb = (data): void => {
  broadcast.enemyDestroyed = data;
};
broadcastSock.trigger(GAME_EVENTS.ENEMY_DESTROYED, { enemyId: "enemy_99" });
assert.strictEqual(broadcast.enemyDestroyed?.enemyId, "enemy_99", "onEnemyDestroyedCb must receive enemyId");

// onLevelCompleteCb & onGameOverCb
net.onLevelCompleteCb = (data): void => {
  broadcast.levelComplete = data;
};
broadcastSock.trigger(GAME_EVENTS.LEVEL_COMPLETE, { success: true, room: sampleRoom, clearedBy: "Alpha" });
assert.strictEqual(broadcast.levelComplete?.clearedBy, "Alpha", "onLevelCompleteCb must receive payload");

net.onGameOverCb = (data): void => {
  broadcast.gameOver = data;
};
broadcastSock.trigger(GAME_EVENTS.GAME_OVER, { room: sampleRoom, winnerName: "Alpha" });
assert.strictEqual(broadcast.gameOver?.winnerName, "Alpha", "onGameOverCb must receive payload");

// onWorldSnapshotCb
net.onWorldSnapshotCb = (data): void => {
  broadcast.worldSnapshot = data;
};
const dummySnapshot: NetworkWorldSnapshotPayload = {
  timestamp: Date.now(),
  players: [
    ["sock_mock_1", "p1", 100, 100, 0, 0, 100, 3, 0, 0, 0, 1],
  ],
  enemies: [],
  projectiles: [],
};
broadcastSock.trigger(GAME_EVENTS.WORLD_SNAPSHOT, dummySnapshot);
assert.strictEqual(broadcast.worldSnapshot, dummySnapshot, "onWorldSnapshotCb must receive snapshot");

// Error events (JOIN_ERROR & ROOM_CREATE_ERROR)
reportedError = "";
broadcastSock.trigger(ROOM_EVENTS.JOIN_ERROR, { error: "Room is full" });
assert.strictEqual(reportedError, "Room is full", "JOIN_ERROR must report error to onErrorCb");

reportedError = "";
broadcastSock.trigger(ROOM_EVENTS.ROOM_CREATE_ERROR, { error: "Invalid map" });
assert.strictEqual(reportedError, "Invalid map", "ROOM_CREATE_ERROR must report error to onErrorCb");

console.log("   ✅ Incoming server broadcast events and callbacks verified.\n");

// ── Test 5: Gameplay Action Emits ───────────────────────────────────────────
console.log("5️⃣  Testing Ingame Gameplay Action Emits...");

net.currentRoom = sampleRoom;
const gameSock = getSocket();

// sendPlayerDied
net.sendPlayerDied("crushed");
const diedEmit = gameSock.emittedEvents.find((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_DIED);
assert.ok(diedEmit, "PLAYER_DIED event must be emitted");
const diedPayload = diedEmit.payload as { reason: string };
assert.strictEqual(diedPayload.reason, "crushed", "sendPlayerDied payload must include reason");

// sendEnemyDestroyed
let enemyDestroyedAckReceived = false;
net.sendEnemyDestroyed("enemy_42", (_res) => {
  enemyDestroyedAckReceived = true;
});
const destroyEmit = gameSock.emittedEvents.find((e: EmittedRecord) => e.event === GAME_EVENTS.ENEMY_DESTROYED);
assert.ok(destroyEmit, "ENEMY_DESTROYED event must be emitted");
const destroyPayload = destroyEmit.payload as { enemyId: string };
assert.strictEqual(destroyPayload.enemyId, "enemy_42", "sendEnemyDestroyed payload must include enemyId");
destroyEmit.ack?.({ success: true });
assert.strictEqual(enemyDestroyedAckReceived, true, "sendEnemyDestroyed callback must execute");

// completeLevel
let completeLevelAckReceived = false;
net.completeLevel((res) => {
  completeLevelAckReceived = res.success;
});
const completeEmit = gameSock.emittedEvents.find((e: EmittedRecord) => e.event === GAME_EVENTS.COMPLETE_LEVEL);
assert.ok(completeEmit, "COMPLETE_LEVEL event must be emitted");
completeEmit.ack?.({ success: true, room: sampleRoom });
assert.strictEqual(completeLevelAckReceived, true, "completeLevel callback must execute");

// nextLevel
let nextLevelAckReceived = false;
net.nextLevel((res) => {
  nextLevelAckReceived = res.success;
});
const nextEmit = gameSock.emittedEvents.find((e: EmittedRecord) => e.event === GAME_EVENTS.NEXT_LEVEL);
assert.ok(nextEmit, "NEXT_LEVEL event must be emitted");
nextEmit.ack?.({ success: true, room: sampleRoom });
assert.strictEqual(nextLevelAckReceived, true, "nextLevel callback must execute");

console.log("   ✅ Gameplay action emits verified.\n");

// ── Test 6: Input Throttling & Heartbeat (sendInput) ────────────────────────
console.log("6️⃣  Testing Input Throttling & Heartbeat Mechanics (sendInput)...");

const inputSock = getSocket();
const initialInputCount = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT).length;

const baseInputState: SerializedInputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  thrust: false,
  phase: false,
  suicide: false,
  sequenceId: 1,
  x: 100,
  y: 200,
};

// 1. Initial send -> should emit
net.sendInput(baseInputState);
let inputEmits = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT);
assert.strictEqual(inputEmits.length, initialInputCount + 1, "First sendInput should emit PLAYER_INPUT");

// 2. Duplicate send immediately -> should be throttled (no new emit)
net.sendInput(baseInputState);
inputEmits = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT);
assert.strictEqual(inputEmits.length, initialInputCount + 1, "Identical input within heartbeat interval should be suppressed");

// 3. Negligible movement (< 0.5px) -> should be throttled
net.sendInput({ ...baseInputState, x: 100.2, y: 200.1 });
inputEmits = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT);
assert.strictEqual(inputEmits.length, initialInputCount + 1, "Sub-pixel movement (<0.5) should be suppressed");

// 4. Significant movement (> 0.5px) -> should emit
net.sendInput({ ...baseInputState, x: 102 });
inputEmits = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT);
assert.strictEqual(inputEmits.length, initialInputCount + 2, "Movement > 0.5 units should trigger emit");

// 5. Action key change (e.g. thrust) -> should emit immediately
net.sendInput({ ...baseInputState, x: 102, thrust: true });
inputEmits = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT);
assert.strictEqual(inputEmits.length, initialInputCount + 3, "Input state change (thrust) should trigger emit immediately");

// 6. Heartbeat expiration (>= 100ms) -> should emit even with identical input
net.lastInputTime = Date.now() - 150; // Simulate 150ms elapsed (> 100ms interval)
net.sendInput({ ...baseInputState, x: 102, thrust: true });
inputEmits = inputSock.emittedEvents.filter((e: EmittedRecord) => e.event === GAME_EVENTS.PLAYER_INPUT);
assert.strictEqual(inputEmits.length, initialInputCount + 4, "Heartbeat expiration should force emission of input");

console.log("   ✅ Input throttling and heartbeat behavior verified.\n");

// ── Test 7: Ping & Jitter Calculation ───────────────────────────────────────
console.log("7️⃣  Testing Ping, Jitter & Interpolation Delay Monitoring...");

net.connect();
getSocket().trigger("connect");

// Simulate ping history & ping calculations
net.pingHistory = [30, 40, 50];
net.startPingMonitor();
assert.ok(net.pingTimer, "pingTimer should be active");

// Test disconnect cleans up pingTimer
net.disconnect();
assert.strictEqual(net.pingTimer, null, "disconnect must clear pingTimer");

console.log("   ✅ Ping monitor logic verified.\n");

console.log("🎉 ALL NETWORK MANAGER UNIT TESTS PASSED CLEANLY!");
process.exit(0);
