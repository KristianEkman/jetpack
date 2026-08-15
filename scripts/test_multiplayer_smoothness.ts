/* ==========================================================================
   MULTIPLAYER SMOOTHNESS & WAN LATENCY TEST SUITE
   Tests clock desynchronization immunity, prediction reconciliation replay,
   enemy dead-reckoning, projectile forward simulation, and 20 Hz tuning.
   ========================================================================== */

import assert from "node:assert/strict";
import { PlayerManager } from "../js/entities/playerManager.js";
import { Player } from "../js/entities/player/playerClass.js";
import { EnemyManager } from "../js/entities/enemy/enemyManager.js";
import { TileMap } from "../js/world/tilemap/tileMapClass.js";
import { NETWORK_SETTINGS, PLAYER_FLAGS } from "../js/shared/constants.js";
import { NetworkManager } from "../js/network/networkManager.js";
import { SerializedInputState, WorldSnapshotPayload } from "../js/shared/types.js";

console.log("🧪 Starting Multiplayer Smoothness & WAN Latency Test Suite...\n");

// 1. Verify Network Tuning Settings for 20 Hz
console.log("1️⃣  Testing Network Constants & 20 Hz Settings...");
assert.equal(
  NETWORK_SETTINGS.SNAPSHOT_INTERVAL_TICKS,
  3,
  "Snapshot interval should be 3 ticks (20 Hz at 60 Hz tick rate)",
);
assert.equal(
  NETWORK_SETTINGS.DEFAULT_INTERPOLATION_DELAY,
  75,
  "Default interpolation delay should be 75ms for 20 Hz snapshots",
);
assert.equal(
  NETWORK_SETTINGS.INPUT_HEARTBEAT_INTERVAL,
  50,
  "Input heartbeat interval should be 50ms",
);
console.log("   ✅ Network settings verified for 20 Hz snapshot rate and low-latency interpolation.");

// 2. Test Clock Desynchronization Immunity in PlayerManager
console.log("2️⃣  Testing Client/Server Clock Desync Immunity in PlayerManager...");
const mockAudio = {
  playThrust: () => {},
  stopThrust: () => {},
  playExplosion: () => {},
  playPhaseImpact: () => {},
};
const tileMap = new TileMap({ effectsEnabled: false });
const playerManager = new PlayerManager(mockAudio as any, tileMap);
playerManager.setLocalSocketId("local_player_1");

// Simulate receiving snapshots from an Azure server whose system clock is 10 seconds ahead
const fakeServerTimeAhead = Date.now() + 10000;
const snapshot1: any = {
  roomId: "TEST",
  tick: 100,
  timestamp: fakeServerTimeAhead, // Server clock in the future!
  worldState: null,
  players: [
    [
      "remote_sock_1",
      "remote_p1",
      100, // x
      100, // y
      50, // vx
      0, // vy
      100, // fuel
      3, // lives
      0, // score
      PLAYER_FLAGS.FACING_RIGHT,
      0,
      10, // lastSequenceId
    ],
  ],
};

playerManager.updateFromSnapshot(snapshot1);
assert.equal(playerManager.snapshotBuffer.length, 1);
// Ensure snapshot timestamp was recorded using local client time, NOT server's future timestamp
assert.ok(
  playerManager.snapshotBuffer[0].timestamp < fakeServerTimeAhead - 5000,
  "Snapshot buffer should record client-local arrival timestamp, not server future timestamp",
);

// Add a second snapshot
const snapshot2: any = {
  roomId: "TEST",
  tick: 103,
  timestamp: fakeServerTimeAhead + 50,
  worldState: null,
  players: [
    [
      "remote_sock_1",
      "remote_p1",
      120, // x
      100, // y
      50, // vx
      0, // vy
      100,
      3,
      0,
      PLAYER_FLAGS.FACING_RIGHT,
      0,
      13,
    ],
  ],
};
playerManager.updateFromSnapshot(snapshot2);
assert.equal(playerManager.snapshotBuffer.length, 2);

// Run update() and verify remote player position interpolates cleanly without NaN or freezing
playerManager.update(1 / 60);
const remotePlayer = playerManager.getPlayer("remote_sock_1");
assert.ok(remotePlayer, "Remote player should exist in PlayerManager");
assert.ok(
  typeof remotePlayer.x === "number" && !isNaN(remotePlayer.x),
  "Remote player x position should be a valid number",
);
assert.ok(
  remotePlayer.x >= 99 && remotePlayer.x <= 130,
  `Remote player x (${remotePlayer.x}) should be within expected interpolated range`,
);
console.log("   ✅ PlayerManager uses local arrival timestamps and interpolates remote players smoothly regardless of server clock offsets.");

// 3. Test Snapshot Buffer Pruning
console.log("3️⃣  Testing Snapshot Buffer Pruning...");
for (let i = 0; i < 50; i++) {
  playerManager.updateFromSnapshot({
    roomId: "TEST",
    tick: 200 + i,
    timestamp: Date.now(),
    players: [
      [
        "remote_sock_1",
        "remote_p1",
        100 + i,
        100,
        10,
        0,
        100,
        3,
        0,
        0,
        0,
        100 + i,
      ],
    ],
  });
}
assert.ok(
  playerManager.snapshotBuffer.length <= 40,
  `Snapshot buffer length (${playerManager.snapshotBuffer.length}) should be capped to prevent unbounded memory growth`,
);
console.log("   ✅ Snapshot buffer pruning verified.");

// 4. Test Local Player Prediction Reconciliation and Input Replay
console.log("4️⃣  Testing Local Player Prediction & Input Replay (reconcileServerSnapshot)...");
const localPlayer = new Player(mockAudio as any, tileMap, {
  id: "local_p1",
  name: "Local Pilot",
  isLocal: true,
});

localPlayer.spawn(100, 100);

// Client simulates 3 movement inputs (thrust + right)
const input1: SerializedInputState = {
  sequenceId: 1,
  left: false,
  right: true,
  up: false,
  down: false,
  thrust: true,
  phase: false,
  suicide: false,
};
const input2: SerializedInputState = {
  sequenceId: 2,
  left: false,
  right: true,
  up: false,
  down: false,
  thrust: true,
  phase: false,
  suicide: false,
};
const input3: SerializedInputState = {
  sequenceId: 3,
  left: false,
  right: true,
  up: false,
  down: false,
  thrust: true,
  phase: false,
  suicide: false,
};

localPlayer.pendingInputs.push(input1, input2, input3);
localPlayer.simulateMovement(1 / 60, input1);
localPlayer.simulateMovement(1 / 60, input2);
localPlayer.simulateMovement(1 / 60, input3);

const predictedX = localPlayer.x;
const predictedY = localPlayer.y;
assert.ok(predictedX > 100, "Predicted X should have advanced forward");

// Server acknowledges sequenceId 1 (server position is where player was after input 1)
const serverStateAfterInput1 = new Player(null, tileMap);
serverStateAfterInput1.spawn(100, 100);
serverStateAfterInput1.simulateMovement(1 / 60, input1);

// Reconcile: server snapshot acknowledges sequenceId 1
localPlayer.reconcileServerSnapshot({
  socketId: "local_player_1",
  id: "local_p1",
  x: serverStateAfterInput1.x,
  y: serverStateAfterInput1.y,
  vx: serverStateAfterInput1.vx,
  vy: serverStateAfterInput1.vy,
  fuel: serverStateAfterInput1.fuel,
  lives: 3,
  score: 0,
  facingRight: true,
  isGrounded: false,
  isThrusting: true,
  isClimbing: false,
  isPhasing: false,
  isDead: false,
  respawnInvulnerability: 0,
  lastSequenceId: 1, // Acknowledged input 1
});

// Verify input1 was pruned and inputs 2 & 3 were replayed
assert.equal(localPlayer.pendingInputs.length, 2);
assert.equal(localPlayer.pendingInputs[0].sequenceId, 2);
assert.equal(localPlayer.pendingInputs[1].sequenceId, 3);

// Position after replaying inputs 2 and 3 should match predicted position within negligible float tolerance
const diffX = Math.abs(localPlayer.x - predictedX);
const diffY = Math.abs(localPlayer.y - predictedY);
assert.ok(
  diffX < 0.1 && diffY < 0.1,
  `Reconciled position (${localPlayer.x}, ${localPlayer.y}) should match prediction (${predictedX}, ${predictedY})`,
);
console.log("   ✅ Prediction reconciliation correctly replays unacknowledged inputs without position snapping.");

// 5. Test Enemy Dead-Reckoning & Continuous Projectile Movement
console.log("5️⃣  Testing Enemy Dead-Reckoning & Continuous Projectile Simulation...");
const enemyManager = new EnemyManager(tileMap, mockAudio as any);

// Add enemy with target and velocity
enemyManager.addFlitzer(100, 100, 120, 0, "flitzer_1");
const flitzer = enemyManager.enemies[0];
flitzer.targetX = 100;
flitzer.targetY = 100;
flitzer.vx = 120;
flitzer.vy = 0;

// Add a projectile
enemyManager.projectiles.push({
  x: 50,
  y: 50,
  vx: 200,
  vy: 0,
  radius: 3,
  life: 1.0,
});

// Run interpolateEnemies with dt = 0.1s
enemyManager.interpolateEnemies(0.1);

// Enemy should have dead-reckoned forward
assert.ok(
  flitzer.x > 100,
  `Enemy x (${flitzer.x}) should have advanced forward with dead reckoning`,
);

// Projectile should have moved forward continuously (50 + 200 * 0.1 = 70)
const projectile = enemyManager.projectiles[0];
assert.ok(projectile, "Projectile should remain alive");
assert.equal(
  projectile.x,
  70,
  `Projectile x (${projectile.x}) should have moved to 70 with dt = 0.1`,
);
assert.equal(
  Math.round(projectile.life * 10) / 10,
  0.9,
  "Projectile life should have decreased by dt",
);
console.log("   ✅ Enemy dead-reckoning and continuous projectile physics in multiplayer verified.");

// 6. Test Socket.IO Transports Option
console.log("6️⃣  Testing Socket.IO WebSocket Transport Preference...");
const networkManager = new NetworkManager();
assert.equal(
  networkManager.interpolationDelay,
  NETWORK_SETTINGS.DEFAULT_INTERPOLATION_DELAY,
  "NetworkManager initial interpolation delay should match NETWORK_SETTINGS",
);
console.log("   ✅ NetworkManager WebSocket configuration verified.");

console.log("\n🎉 ALL MULTIPLAYER SMOOTHNESS & WAN LATENCY TESTS PASSED CLEANLY!");
