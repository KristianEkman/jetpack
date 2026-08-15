import assert from "node:assert";
import { io, type Socket } from "socket.io-client";
import { httpServer, gameLoop } from "../server/index.js";
import { ROOM_EVENTS } from "../js/shared/constants.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import {
  RoomActionResponse,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomUpdatedPayload,
} from "../js/shared/payloads.js";

const PORT = 3097;

await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
gameLoop.start();

console.log("🧪 Starting Lobby Level Selection Test Suite...");

const hostSocket: Socket = io(`http://localhost:${PORT}`);
const clientSocket: Socket = io(`http://localhost:${PORT}`);

await new Promise<void>((resolve) => hostSocket.on("connect", resolve));
await new Promise<void>((resolve) => clientSocket.on("connect", resolve));

console.log("🔌 Host and Wingman connected to test server.");

// 1. Verify CAMPAIGN_LEVELS count
assert.strictEqual(CAMPAIGN_LEVELS.length, 8, "CAMPAIGN_LEVELS must contain 8 levels");
console.log("1️⃣  Verified CAMPAIGN_LEVELS has 8 levels.");

// 2. Host creates room with Stage 8 (levelIndex 7)
const createRes = await new Promise<RoomCreatedPayload>((resolve) => {
  hostSocket.emit(
    ROOM_EVENTS.CREATE_ROOM,
    { playerName: "HostPilot", levelIndex: 7 },
    resolve,
  );
});

assert.strictEqual(createRes.success, true);
assert.strictEqual(createRes.room.levelIndex, 7);
assert.strictEqual(createRes.room.mapName, CAMPAIGN_LEVELS[7].name);
const roomId = createRes.roomId;
console.log(`2️⃣  Host created room ${roomId} with Stage 8 (${createRes.room.mapName}).`);

// 3. Wingman joins room
const joinRes = await new Promise<RoomJoinedPayload>((resolve) => {
  clientSocket.emit(
    ROOM_EVENTS.JOIN_ROOM,
    { roomId, playerName: "WingmanPilot" },
    resolve,
  );
});

assert.strictEqual(joinRes.success, true);
assert.strictEqual(joinRes.room.levelIndex, 7);
console.log(`3️⃣  Wingman joined room ${roomId}.`);

// 4. Host changes level to Stage 3 (levelIndex 2)
let wingmanRoomUpdatedReceived = false;
clientSocket.on(ROOM_EVENTS.ROOM_UPDATED, (payload: RoomUpdatedPayload) => {
  if (payload.room && payload.room.levelIndex === 2) {
    wingmanRoomUpdatedReceived = true;
  }
});

const changeLevelRes = await new Promise<RoomActionResponse & { room: { levelIndex: number; mapName?: string } }>((resolve) => {
  hostSocket.emit(
    ROOM_EVENTS.CHANGE_LEVEL,
    { levelIndex: 2 },
    resolve,
  );
});

assert.strictEqual(changeLevelRes.success, true);
assert.strictEqual(changeLevelRes.room.levelIndex, 2);
assert.strictEqual(changeLevelRes.room.mapName, CAMPAIGN_LEVELS[2].name);

// Wait for socket broadcast
await new Promise((r) => setTimeout(r, 100));
assert.strictEqual(wingmanRoomUpdatedReceived, true, "Wingman should receive room_updated event with levelIndex 2");
console.log(`4️⃣  Host changed room level to Stage 3 (${changeLevelRes.room.mapName}) and Wingman synced.`);

// 5. Host changes level to a Custom Map payload
const customGrid = new Array(540).fill(0);
customGrid[0] = 13; // SPAWN tile
customGrid[29] = 14; // EXIT tile

let wingmanCustomUpdateReceived = false;
clientSocket.on(ROOM_EVENTS.ROOM_UPDATED, (payload: RoomUpdatedPayload) => {
  if (payload.room && payload.room.mapName === "Test Custom Arena") {
    wingmanCustomUpdateReceived = true;
  }
});

const changeCustomRes = await new Promise<RoomActionResponse & { room: { mapName?: string; customMapData?: unknown } }>((resolve) => {
  hostSocket.emit(
    ROOM_EVENTS.CHANGE_LEVEL,
    {
      customMapData: {
        name: "Test Custom Arena",
        grid: customGrid,
        authorName: "Tester",
      },
    },
    resolve,
  );
});

assert.strictEqual(changeCustomRes.success, true);
assert.strictEqual(changeCustomRes.room.mapName, "Test Custom Arena");
assert.ok(changeCustomRes.room.customMapData);

await new Promise((r) => setTimeout(r, 100));
assert.strictEqual(wingmanCustomUpdateReceived, true, "Wingman should receive room_updated for Custom Map");
console.log("5️⃣  Host changed room map to Custom Level and Wingman synced.");

// 6. Non-host Wingman attempts to change level -> expect rejection
const wingmanDeniedRes = await new Promise<RoomActionResponse>((resolve) => {
  clientSocket.emit(
    ROOM_EVENTS.CHANGE_LEVEL,
    { levelIndex: 0 },
    resolve,
  );
});

assert.strictEqual(wingmanDeniedRes.success, false);
assert.strictEqual(wingmanDeniedRes.error, "Only the host can change the level");
console.log("6️⃣  Non-host level change attempt properly denied with error.");

// Cleanup
hostSocket.disconnect();
clientSocket.disconnect();
gameLoop.stop();
await new Promise<void>((resolve) => httpServer.close(() => resolve()));

console.log("🎉 ALL LOBBY LEVEL SELECTION TESTS PASSED PERFECTLY!");
process.exit(0);
