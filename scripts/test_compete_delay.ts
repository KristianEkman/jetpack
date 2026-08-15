import assert from "node:assert/strict";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { httpServer, gameLoop, roomManager } from "../server/index.js";
import { GAME_EVENTS, ROOM_EVENTS, MULTIPLAYER_MODES } from "../js/shared/constants.js";
import { GameOverPayload, RoomActionResponse } from "../js/shared/payloads.js";

console.log("🧪 Starting Compete Match Delay Test Suite...\n");

const TEST_PORT = 3098;
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

  let gameOverReceived = false;
  let gameOverPayload: GameOverPayload | null = null;
  client1.on(GAME_EVENTS.GAME_OVER, (data: GameOverPayload) => {
    gameOverReceived = true;
    gameOverPayload = data;
  });

  const playersArray = Array.from(room.players.values());
  const rivalPlayer = playersArray.find((p) => p.name === "Rival Pilot")!;
  rivalPlayer.lives = 0;
  rivalPlayer.isDead = true;

  // Trigger one tick. Match should enter delay state (room.competeEndTimer set to 2.5).
  gameLoop.tick();

  assert.equal(gameOverReceived, false, "Game over should NOT be emitted immediately on tick 1 due to delay");
  assert.equal(room.status, "playing", "Room status should remain 'playing' during the match end delay");
  assert.ok(typeof room.competeEndTimer === "number" && room.competeEndTimer > 0, "competeEndTimer should be set");

  // Tick for 2.6 seconds worth of frames (2.6 / (1/60) ~= 156 ticks)
  for (let i = 0; i < 160; i++) {
    gameLoop.tick();
  }

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(gameOverReceived, true, "Game over SHOULD be emitted after delay expires");
  const payload = gameOverPayload as GameOverPayload | null;
  assert.equal(payload?.reason, "compete_match_complete");
  assert.equal(payload?.winnerName, "Host Pilot");
  assert.equal(room.status, "finished");

  console.log("   ✅ Compete match end delay verified successfully!\n");

  client1.disconnect();
  client2.disconnect();
  gameLoop.stop();
  httpServer.close();
  console.log("🎉 COMPETE DELAY TEST PASSED!");
  process.exit(0);
} catch (err) {
  console.error("❌ Test failed:", err);
  client1?.disconnect();
  client2?.disconnect();
  gameLoop.stop();
  httpServer.close();
  process.exit(1);
}
