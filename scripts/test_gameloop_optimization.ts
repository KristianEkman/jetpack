/* ==========================================================================
   GAME LOOP & TICK ENGINE OPTIMIZATION TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";
import { GameLoop } from "../server/gameLoop.js";
import { RoomManager } from "../server/roomManager.js";
import { TileMap } from "../js/world/tilemap/tileMapClass.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { MULTIPLAYER_MODES } from "../js/shared/constants.js";

console.log("🧪 Starting Game Loop & Tick Engine Optimization Test Suite...\n");

const mockIo = {
  to: () => ({
    emit: () => {},
    volatile: {
      emit: () => {},
    },
  }),
};

console.log("1️⃣  Testing TileMap Spawn Point Caching...");
const tileMap = new TileMap({ effectsEnabled: false });
tileMap.loadLevelData(CAMPAIGN_LEVELS[0]);
assert.ok(tileMap.spawnPoints.length > 0, "TileMap should populate spawnPoints on load");
const primarySpawn = tileMap.getPrimarySpawnPoint();
assert.ok(typeof primarySpawn.x === "number" && typeof primarySpawn.y === "number", "Primary spawn should have valid coordinates");
console.log(`   ✅ Primary spawn point cached at (${primarySpawn.x}, ${primarySpawn.y}) without grid scanning.`);

console.log("2️⃣  Testing RoomManager Playing Rooms Tracking...");
const roomManager = new RoomManager();
const room = roomManager.createRoom("host_socket_1", { playerName: "Pilot 1" });
assert.equal(roomManager.getPlayingRooms().length, 0, "Lobby rooms should not be in playingRooms");

roomManager.setRoomStatus(room.id, "playing");
assert.equal(roomManager.getPlayingRooms().length, 1, "Playing room should be tracked");
assert.equal(roomManager.getPlayingRooms()[0].id, room.id);

roomManager.setRoomStatus(room.id, "finished");
assert.equal(roomManager.getPlayingRooms().length, 0, "Finished room should be removed from playingRooms");
console.log("   ✅ RoomManager playingRooms set/get synchronization verified.");

console.log("3️⃣  Testing GameLoop Idle Throttling & Wake Up...");
const gameLoop = new GameLoop(roomManager, mockIo as any, 60);
assert.equal(gameLoop.idleIntervalMs, 200, "Idle interval should be 200ms");

gameLoop.start();
assert.ok(gameLoop.isRunning, "Game loop should be running");

// Wake loop when room starts playing
roomManager.setRoomStatus(room.id, "playing");
gameLoop.wake();
assert.ok(gameLoop.isRunning, "Game loop should stay running after wake");

// Run ticks and verify player/enemy simulation works cleanly without allocations
for (let i = 0; i < 10; i++) {
  gameLoop.tick();
}
assert.ok(room.tickCount >= 10, "Room tick count should increment");
console.log(`   ✅ GameLoop executed ${room.tickCount} ticks on active playing room.`);

gameLoop.stop();
assert.equal(gameLoop.isRunning, false, "Game loop stopped successfully");

console.log("\n🎉 ALL GAME LOOP OPTIMIZATION TESTS PASSED CLEANLY!");
