import assert from "node:assert/strict";

import { GameLoop } from "../server/gameLoop.js";
import { RoomManager } from "../server/roomManager.js";

console.log("🧪 Starting server regression tests...\n");

const roomManager = new RoomManager();
const room = roomManager.createRoom("host_socket", {});

assert.throws(
  () => roomManager.createRoom("host_socket", {}),
  /leave your current room/i,
  "A socket must not be able to orphan rooms by creating repeatedly",
);

const customRoomManager = new RoomManager();
customRoomManager.createRoom("host_a", { customCode: "ABCD" });
assert.throws(
  () => customRoomManager.createRoom("host_b", { customCode: "ABCD" }),
  /already exists/i,
  "Custom room codes must not overwrite existing rooms",
);

assert.equal(room.tileMap.effectsEnabled, false);
room.tileMap.addSparkles(10, 10, "#fff", 10);
room.tileMap.addDeathExplosion(10, 10);
assert.equal(room.tileMap.particles.length, 0);
assert.equal(room.tileMap.debris.length, 0);

let snapshotEmits = 0;
const mockIo = {
  to: () => ({
    volatile: {
      emit: () => {
        snapshotEmits++;
      },
    },
    emit: () => undefined,
  }),
};
const gameLoop = new GameLoop(roomManager, mockIo, 60);

for (let i = 0; i < 60; i++) gameLoop.tick();
assert.equal(room.tickCount, 0, "Lobby rooms must not consume simulation ticks");
assert.equal(snapshotEmits, 0, "Lobby rooms must not emit world snapshots");

room.status = "playing";
const player = room.players.get("host_socket")!;
const config = room.playerConfigs.get("host_socket")!;
config.lastInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  thrust: false,
  phase: true,
  suicide: false,
  sequenceId: 1,
};

let phaseBeams = 0;
const originalFireWeapon = player.fireWeapon.bind(player);
player.fireWeapon = (...args) => {
  phaseBeams++;
  return originalFireWeapon(...args);
};

for (let i = 0; i < 60; i++) gameLoop.tick();
assert.equal(room.tickCount, 60);
assert.equal(snapshotEmits, 20, "Playing rooms should emit snapshots at 20 Hz");
assert.equal(
  phaseBeams,
  4,
  "A held phase input should respect the configured 0.3 second cooldown",
);

console.log("✅ Server regression tests passed.");
