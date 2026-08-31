// Repro: does server-side boss hp drop when a client fires at it in multiplayer?
import { io as ioClient } from "socket.io-client";
import { httpServer, gameLoop, roomManager } from "../server/index.js";
import { GAME_EVENTS, ROOM_EVENTS } from "../js/shared/constants.js";

const TEST_PORT = 3098;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve as () => void));
gameLoop.start();

const client = ioClient(SERVER_URL, { forceNew: true });
await new Promise<void>((resolve) => client.on("connect", resolve));

// Create room on stage 7 (index 6, has boss) — need create with levelIndex option
const createResult: any = await new Promise((resolve) => {
  client.emit("create_room", { playerName: "Host", playerColor: "#f00", levelIndex: 6 }, resolve);
});
console.log("create:", createResult.success, createResult.roomId);

const startResult: any = await new Promise((resolve) => {
  client.emit(GAME_EVENTS.START_MATCH, {}, resolve);
});
console.log("start:", JSON.stringify(startResult).slice(0, 200));

// Find the room and boss server-side
const room = roomManager.getRoomBySocketId(client.id!);
console.log("room status:", room?.status, "enemies:", room?.enemyManager?.enemies.map((e: any) => `${e.id}:${e.type}:hp${e.hp}@${e.x},${e.y}`));

const boss = room?.enemyManager?.enemies.find((e: any) => e.type === "boss");
if (!boss) {
  console.log("NO BOSS ON SERVER!");
  process.exit(1);
}
const playerEntity = [...room!.players.values()][0] as any;

// Teleport player next to boss via trusted input positions, hold fire
let seq = 1;
const fireTimer = setInterval(() => {
  client.emit(GAME_EVENTS.PLAYER_INPUT, {
    left: false, right: false, up: false, down: false,
    thrust: true, phase: true, suicide: false,
    sequenceId: seq++,
    x: boss.x - 60, y: boss.y + 20, vx: 0, vy: 0, facingRight: true,
  });
}, 50);

// Watch boss hp for 4 seconds
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const b = room?.enemyManager?.enemies.find((e: any) => e.id === boss.id);
  console.log(`t=${(i + 1) * 0.5}s server boss hp:`, b ? b.hp : "DEAD/REMOVED",
    "| server player pos:", Math.round(playerEntity.x), Math.round(playerEntity.y),
    "| phaseCd:", playerEntity.phaseCooldown?.toFixed(2), "weaponCd:", playerEntity.weaponCooldown?.toFixed(2));
}

clearInterval(fireTimer);
client.close();
gameLoop.stop();
httpServer.close();
process.exit(0);
