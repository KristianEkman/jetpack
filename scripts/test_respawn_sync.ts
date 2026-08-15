/* ==========================================================================
   MULTIPLAYER RESPAWN SYNCHRONIZATION & DISCONTINUITY TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";
import { PlayerManager } from "../js/entities/playerManager.js";
import { Player } from "../js/entities/player/playerClass.js";
import { TileMap } from "../js/world/tilemap/tileMapClass.js";
import { AudioManager } from "../js/audio/audioManager.js";
import { SoundEffects } from "../js/audio/sfx.js";
import { RoomManager } from "../server/roomManager.js";
import { GameLoop } from "../server/gameLoop.js";
import { PLAYER_FLAGS, GAME_EVENTS } from "../js/shared/constants.js";
import { SerializedInputState } from "../js/shared/types.js";

console.log("🧪 Starting Multiplayer Respawn Synchronization & Discontinuity Test Suite...\n");

// 1. Test Audio playRespawn support
console.log("1️⃣  Testing playRespawn Audio Synthesizer Support...");
const audioManager = new AudioManager();
const sfx = new SoundEffects(audioManager);
assert.equal(typeof sfx.playRespawn, "function", "SoundEffects must implement playRespawn");
assert.equal(typeof audioManager.playRespawn, "function", "AudioManager must implement playRespawn");
// Call safely (mock/muted context)
audioManager.playRespawn();
console.log("   ✅ Audio playRespawn synthesizer method verified.");

// 2. Test Remote Player Snapshot Interpolation across Respawn (No Flying Glitch)
console.log("2️⃣  Testing Remote Player Discontinuity Snapping on Respawn...");
const mockAudio = {
  playThrust: () => {},
  stopThrust: () => {},
  playExplosion: () => {},
  playPhaseImpact: () => {},
  playRespawn: () => {},
};
const tileMap = new TileMap({ effectsEnabled: false });
const playerManager = new PlayerManager(mockAudio as unknown as AudioManager, tileMap);
playerManager.setLocalSocketId("local_socket_id");

// Create remote player
const remotePlayer = playerManager.addPlayer("remote_socket_id", {
  id: "player_remote",
  name: "Wingman",
  color: "#ff0055",
  isLocal: false,
  x: 800,
  y: 500,
});
remotePlayer.isDead = true;

// Snapshot 1: Remote player is dead at (800, 500)
const now = Date.now();
playerManager.updateFromSnapshot({
  tick: 100,
  players: [
    [
      "remote_socket_id",
      "player_remote",
      800, // x
      500, // y
      0, // vx
      0, // vy
      100, // fuel
      2, // lives
      0, // score
      PLAYER_FLAGS.IS_DEAD, // flags
      0, // respawnInvulnerability
      50, // lastSequenceId
    ],
  ],
});

// Snapshot 2: Remote player respawned at (128, 100) with respawnInvulnerability: 2.5
playerManager.updateFromSnapshot({
  tick: 103,
  players: [
    [
      "remote_socket_id",
      "player_remote",
      128, // x
      100, // y
      0, // vx
      0, // vy
      100, // fuel
      2, // lives
      0, // score
      PLAYER_FLAGS.FACING_RIGHT, // flags (alive!)
      2.5, // respawnInvulnerability
      50, // lastSequenceId
    ],
  ],
});

// Fast-forward timeline to midway between the two snapshots
playerManager.renderTimeline = (playerManager.snapshotBuffer[0].timestamp + playerManager.snapshotBuffer[1].timestamp) / 2;

// Run update
playerManager.update(0.016);

// The remote player MUST NOT be interpolated across the map (e.g. x around 464, y around 300)
assert.equal(
  remotePlayer.x,
  128,
  `Remote player x must snap directly to spawn x (128), got ${remotePlayer.x}`,
);
assert.equal(
  remotePlayer.y,
  100,
  `Remote player y must snap directly to spawn y (100), got ${remotePlayer.y}`,
);
assert.equal(remotePlayer.isDead, false, "Remote player isDead must be false after respawn");
assert.equal(
  remotePlayer.respawnInvulnerability,
  2.5,
  "Remote player respawnInvulnerability must be 2.5",
);
console.log("   ✅ Remote player respawn snapped directly to spawn coordinates without flying glitch.");

// 3. Test Remote Player Teleport & Screen-Wrap Discontinuity
console.log("3️⃣  Testing Discontinuity Snapping on Screen Wrap / Teleport (>120px)...");
// Add a snapshot moving player from (128, 100) to (850, 100)
playerManager.updateFromSnapshot({
  tick: 106,
  players: [
    [
      "remote_socket_id",
      "player_remote",
      850, // x (wrapped across screen)
      100, // y
      -50, // vx
      0, // vy
      100,
      2,
      0,
      0,
      0,
      51,
    ],
  ],
});

playerManager.renderTimeline = (playerManager.snapshotBuffer[1].timestamp + playerManager.snapshotBuffer[2].timestamp) / 2;
playerManager.update(0.016);

// Due to large distance (>120px), Hermite interpolation must be bypassed
assert.equal(
  remotePlayer.x,
  850,
  `Remote player must snap on wrap/teleport to 850, got ${remotePlayer.x}`,
);
console.log("   ✅ Teleport / Screen-wrap discontinuity snapping verified.");

// 4. Test Local Player Respawn & Input Replay Queue Reset
console.log("4️⃣  Testing Local Player Respawn Snapshot & Input Replay Reset...");
const localPlayer = playerManager.addPlayer("local_socket_id", {
  id: "player_local",
  name: "Host",
  isLocal: true,
  x: 750,
  y: 400,
});
localPlayer.isDead = true;
localPlayer.serverAcknowledgedDeath = true;

// Populate pendingInputs with pre-death movement
localPlayer.pendingInputs = [
  {
    sequenceId: 10,
    left: true,
    right: false,
    up: false,
    down: false,
    thrust: false,
    phase: false,
    suicide: false,
    x: 740,
    y: 400,
  },
  {
    sequenceId: 11,
    left: true,
    right: false,
    up: false,
    down: false,
    thrust: false,
    phase: false,
    suicide: false,
    x: 730,
    y: 400,
  },
];

// Snapshot arrives respawning local player at (128, 100)
playerManager.updateFromSnapshot({
  tick: 110,
  players: [
    [
      "local_socket_id",
      "player_local",
      128,
      100,
      0,
      0,
      100,
      2,
      0,
      PLAYER_FLAGS.FACING_RIGHT,
      2.5,
      11,
    ],
  ],
});

assert.equal(localPlayer.isDead, false, "Local player isDead must be reset to false");
assert.equal(localPlayer.x, 128, "Local player x must be spawn position 128");
assert.equal(localPlayer.y, 100, "Local player y must be spawn position 100");
assert.equal(localPlayer.pendingInputs.length, 0, "Local player pendingInputs must be cleared on spawn");
console.log("   ✅ Local player respawn snapshot and input queue reset verified.");

// 5. Test Server-Side Stale Input Clearing on Death & Respawn
console.log("5️⃣  Testing Server-Side Stale Input Clearing on Death & Respawn...");
const roomManager = new RoomManager();
const room = roomManager.createRoom("sock_p1", {
  maxPlayers: 4,
  levelIndex: 0,
  playerName: "Player 1",
});

const config1 = room.playerConfigs.get("sock_p1")!;
const config2 = roomManager.addPlayerToRoom(room, "sock_p2", {
  name: "Player 2",
  isHost: false,
});

roomManager.setRoomStatus(room.id, "playing");

const p1Entity = room.players.get("sock_p1")!;
const p2Entity = room.players.get("sock_p2")!;

// Simulate P2 dying with stale input
config2.lastInput = {
  sequenceId: 15,
  left: true,
  right: false,
  up: false,
  down: false,
  thrust: false,
  phase: false,
  suicide: false,
  x: 820,
  y: 480,
  vx: -100,
  vy: 0,
};
config2.pendingInputs = [
  {
    sequenceId: 16,
    left: true,
    right: false,
    up: false,
    down: false,
    thrust: false,
    phase: false,
    suicide: false,
    x: 810,
    y: 480,
    vx: -100,
    vy: 0,
  },
];

p2Entity.isDead = true;
p2Entity.lives = 2;
p2Entity.deathTimer = 1.99;

const gameLoop = new GameLoop(roomManager, null as unknown as any);

// Advance tick past 2.0s respawn timer
gameLoop.tick();

// P2 should have respawned
assert.equal(p2Entity.isDead, false, "Server player entity isDead must be false after 2.0s");
assert.ok(p2Entity.respawnInvulnerability > 0, "Server player entity must have respawnInvulnerability > 0");

// Check that config2.pendingInputs and config2.lastInput were cleared!
assert.equal(config2.pendingInputs.length, 0, "Server player config pendingInputs must be emptied on respawn");
assert.equal(config2.lastInput, null, "Server player config lastInput must be null on respawn");

// Run another server tick — since config2.lastInput is null, playerEntity MUST NOT be overwritten back to (820, 480)!
const spawnedX = p2Entity.x;
const spawnedY = p2Entity.y;
gameLoop.tick();

assert.equal(p2Entity.x, spawnedX, "Player position must NOT be overwritten by stale death inputs on subsequent tick");
assert.equal(p2Entity.y, spawnedY, "Player position must NOT be overwritten by stale death inputs on subsequent tick");
console.log("   ✅ Server-side stale input clearing and position preservation on respawn verified.");

// 6. Test 4-Player Distributed Spawn Point Allocation
console.log("6️⃣  Testing 4-Player Distributed Spawn Point Allocation...");
const config3 = roomManager.addPlayerToRoom(room, "sock_p3", { name: "Player 3" });
const config4 = roomManager.addPlayerToRoom(room, "sock_p4", { name: "Player 4" });

// Set multiple spawn points on room tileMap
room.tileMap.spawnPoints = [
  { x: 50, y: 100 },
  { x: 200, y: 100 },
  { x: 350, y: 100 },
  { x: 500, y: 100 },
];

const p3Entity = room.players.get("sock_p3")!;
const p4Entity = room.players.get("sock_p4")!;

// Kill all 4 players
for (const p of room.players.values()) {
  p.isDead = true;
  p.deathTimer = 1.99;
  p.lives = 3;
}

gameLoop.tick();

// All 4 players should have respawned at distinct distributed spawn points
const p1Spawn = { x: p1Entity.x, y: p1Entity.y };
const p2Spawn = { x: p2Entity.x, y: p2Entity.y };
const p3Spawn = { x: p3Entity.x, y: p3Entity.y };
const p4Spawn = { x: p4Entity.x, y: p4Entity.y };

assert.deepEqual(p1Spawn, { x: 50, y: 100 }, "Player 1 should respawn at spawn point 0");
assert.deepEqual(p2Spawn, { x: 200, y: 100 }, "Player 2 should respawn at spawn point 1");
assert.deepEqual(p3Spawn, { x: 350, y: 100 }, "Player 3 should respawn at spawn point 2");
assert.deepEqual(p4Spawn, { x: 500, y: 100 }, "Player 4 should respawn at spawn point 3");

console.log("   ✅ 4 players correctly assigned distributed spawn points without stacking collisions.");

console.log("\n🎉 ALL MULTIPLAYER RESPAWN SYNCHRONIZATION TESTS PASSED PERFECTLY!\n");
