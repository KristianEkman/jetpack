import assert from "node:assert/strict";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { httpServer, gameLoop, roomManager } from "../server/index.js";
import { GAME_EVENTS, ROOM_EVENTS, MULTIPLAYER_MODES, TILES, TILE_SIZE } from "../js/shared/constants.js";
import { GameStartedPayload, LevelCompletePayload, RoomActionResponse } from "../js/shared/payloads.js";

console.log("🧪 Starting Compete Match Exit Portal Test Suite...\n");

const TEST_PORT = 3095;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

await new Promise<void>((resolve) => {
  httpServer.listen(TEST_PORT, () => resolve());
});
gameLoop.start();

let client1: ClientSocket | null = null;
let client2: ClientSocket | null = null;

try {
  client1 = ioClient(SERVER_URL, { forceNew: true });
  await new Promise<void>((resolve) => {
    client1?.on("connect", () => resolve());
  });

  const createResult = await new Promise<RoomActionResponse>((resolve) => {
    client1?.emit(
      "create_room",
      { playerName: "Host Pilot", playerColor: "#ff0000", gameMode: MULTIPLAYER_MODES.COMPETE },
      resolve,
    );
  });
  assert.equal(createResult.success, true);
  const roomId = createResult.roomId!;

  client2 = ioClient(SERVER_URL, { forceNew: true });
  await new Promise<void>((resolve) => {
    client2?.on("connect", () => resolve());
  });

  await new Promise<void>((resolve) => {
    client2?.emit(
      ROOM_EVENTS.JOIN_ROOM,
      { roomId: roomId, playerName: "Rival Pilot", playerColor: "#00ff00" },
      () => resolve(),
    );
  });

  const room = roomManager.getRoom(roomId)!;
  room.status = "playing";

  let client1LevelComplete: LevelCompletePayload | null = null;
  let client2LevelComplete: LevelCompletePayload | null = null;

  client1.on(GAME_EVENTS.LEVEL_COMPLETE, (data: LevelCompletePayload) => {
    client1LevelComplete = data;
  });
  client2.on(GAME_EVENTS.LEVEL_COMPLETE, (data: LevelCompletePayload) => {
    client2LevelComplete = data;
  });

  // Test 1: Explicit COMPLETE_LEVEL socket request in Compete Mode
  const completeResult = await new Promise<LevelCompletePayload>((resolve) => {
    client1?.emit(GAME_EVENTS.COMPLETE_LEVEL, {}, resolve);
  });
  assert.equal(completeResult.success, true, "COMPLETE_LEVEL socket request should succeed in Compete mode");

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.ok(client1LevelComplete, "Client 1 should receive level_complete event in Compete mode");
  assert.ok(client2LevelComplete, "Client 2 should receive level_complete event in Compete mode");
  assert.equal(room.status, "finished", "Room status should be 'finished'");

  // Test 2: NEXT_LEVEL advancement in Compete Mode
  let client1GameStarted: GameStartedPayload | null = null;
  let client2GameStarted: GameStartedPayload | null = null;

  client1.on(GAME_EVENTS.GAME_STARTED, (data: GameStartedPayload) => {
    client1GameStarted = data;
  });
  client2.on(GAME_EVENTS.GAME_STARTED, (data: GameStartedPayload) => {
    client2GameStarted = data;
  });

  const nextResult = await new Promise<GameStartedPayload>((resolve) => {
    client1?.emit(GAME_EVENTS.NEXT_LEVEL, {}, resolve);
  });
  assert.equal(nextResult.success, true, "Host should be able to advance to next level in Compete mode");
  assert.equal(nextResult.levelIndex, 1);

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.ok(client1GameStarted, "Client 1 should receive game_started event for next level");
  assert.ok(client2GameStarted, "Client 2 should receive game_started event for next level");
  assert.equal(room.status, "playing", "Room status should return to 'playing'");

  // Test 3: Server Game Loop Exit Portal detection in Compete Mode
  let exitPortalTileRow = -1;
  let exitPortalTileCol = -1;
  for (let r = 0; r < room.tileMap.rows; r++) {
    for (let c = 0; c < room.tileMap.cols; c++) {
      if (room.tileMap.getTile(c, r) === TILES.EXIT_PORTAL) {
        exitPortalTileRow = r;
        exitPortalTileCol = c;
        break;
      }
    }
  }

  assert.ok(exitPortalTileRow >= 0 && exitPortalTileCol >= 0, "Level 1 should have an Exit Portal tile");

  room.tileMap.collectedEmeralds = room.tileMap.totalEmeralds;

  const hostPlayerEntity = room.players.get(client1!.id!)!;
  hostPlayerEntity.isDead = false;
  hostPlayerEntity.x = exitPortalTileCol * TILE_SIZE;
  hostPlayerEntity.y = exitPortalTileRow * TILE_SIZE;

  client1LevelComplete = null;
  client2LevelComplete = null;

  // Run game loop tick to trigger authoritative exit portal check
  gameLoop.tick();

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.ok(client1LevelComplete, "Game loop should emit level_complete when player touches exit portal in Compete mode");
  assert.ok(client2LevelComplete, "Game loop should broadcast level_complete to room in Compete mode");
  assert.equal(room.status, "finished", "Room status should be 'finished' after reaching exit portal");

  console.log("   ✅ Compete mode exit portal completion & next level flow verified successfully!\n");

  client1.disconnect();
  client2.disconnect();
  gameLoop.stop();
  httpServer.close();
  console.log("🎉 COMPETE EXIT PORTAL TEST PASSED!");
  process.exit(0);
} catch (err) {
  console.error("❌ Test failed:", err);
  client1?.disconnect();
  client2?.disconnect();
  gameLoop.stop();
  httpServer.close();
  process.exit(1);
}
