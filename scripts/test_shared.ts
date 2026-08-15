/* ==========================================================================
   NODE.JS SHARED MODULES VALIDATION SUITE
   ========================================================================== */

import assert from "node:assert/strict";
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TILES,
  PLAYER_PHYSICS,
  GAME_EVENTS,
  PLAYER_FLAGS,
} from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { Player } from "../js/entities/player.js";
import { InputHandler } from "../js/engine/input.js";
import { EnemyManager } from "../js/entities/enemy/index.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { SoundEffects } from "../js/audio/sfx.js";
import { AudioManager } from "../js/audio/audioManager.js";

console.log("🧪 Starting Node.js Shared Core Modules Test Suite...\n");

// 1. Verify Constants
console.log("1️⃣  Testing Shared Constants & Physics Parameters...");
assert.equal(TILE_SIZE, 32);
assert.equal(GRID_COLS, 30);
assert.equal(GRID_ROWS, 18);
assert.equal(PLAYER_PHYSICS.WIDTH, 22);
assert.equal(PLAYER_PHYSICS.GRAVITY, 950);
assert.equal(GAME_EVENTS.TILE_PHASED, "tile_phased");
console.log("   ✅ Shared Constants verified.\n");

// 2. Verify TileMap & Event System
console.log("2️⃣  Testing TileMap, Event Dispatches, & Phase Bricks...");
const tileMap = new TileMap();
tileMap.loadLevelData(CAMPAIGN_LEVELS[0]);

import { TilePositionPayload } from "../js/shared/payloads.js";

let phasedEventReceived: TilePositionPayload | null = null;
let restoredEventReceived: TilePositionPayload | null = null;

tileMap.on<TilePositionPayload>(GAME_EVENTS.TILE_PHASED, (data) => {
  phasedEventReceived = data;
});

tileMap.on<TilePositionPayload>(GAME_EVENTS.TILE_RESTORED, (data) => {
  restoredEventReceived = data;
});

let targetCol = -1,
  targetRow = -1;
for (let r = 0; r < tileMap.rows; r++) {
  for (let c = 0; c < tileMap.cols; c++) {
    if (tileMap.getTile(c, r) === TILES.PHASE_BRICK) {
      targetCol = c;
      targetRow = r;
      break;
    }
  }
  if (targetCol !== -1) break;
}

if (targetCol === -1) {
  targetCol = 5;
  targetRow = 5;
  tileMap.setTile(targetCol, targetRow, TILES.PHASE_BRICK);
}

const phased = tileMap.phaseTile(targetCol, targetRow);
assert.equal(phased, true);
assert.equal(tileMap.getTile(targetCol, targetRow), TILES.AIR);
assert.notEqual(phasedEventReceived, null);
const phasedPayload = phasedEventReceived as TilePositionPayload | null;
assert.equal(phasedPayload?.col, targetCol);
assert.equal(phasedPayload?.row, targetRow);
console.log("   ✅ Tile Phase event dispatched successfully.");

tileMap.update(5.1);
assert.equal(tileMap.getTile(targetCol, targetRow), TILES.PHASE_BRICK);
assert.notEqual(restoredEventReceived, null);
const restoredPayload = restoredEventReceived as TilePositionPayload | null;
assert.equal(restoredPayload?.col, targetCol);
assert.equal(restoredPayload?.row, targetRow);
console.log("   ✅ Tile Restore event dispatched successfully.\n");

// 3. Verify Headless Multi-Player Physics Simulation
console.log("3️⃣  Testing Headless Multi-Player Physics & Collision...");
const p1 = new Player(new AudioManager(), tileMap, {
  id: "p1",
  color: "#ff0000",
  name: "Player 1",
});
const p2 = new Player(new AudioManager(), tileMap, {
  id: "p2",
  color: "#00ff00",
  name: "Player 2",
  showNameTag: true,
});

assert.equal(p1.id, "p1");
assert.equal(p2.id, "p2");
assert.equal(p1.color, "#ff0000");
assert.equal(p2.color, "#00ff00");
assert.equal(p1.showNameTag, false);
assert.equal(p2.showNameTag, true);

const spawnX = 128,
  spawnY = 100;
p1.spawn(spawnX, spawnY);
const initialY = p1.y;

const thrustInput = InputHandler.deserializeInputState({
  thrust: true,
  sequenceId: 1,
});
p1.update(0.1, thrustInput, new EnemyManager(tileMap));
assert.ok(
  p1.vy < 0,
  `Player velocity (${p1.vy}) should be negative (upward) under thrust`,
);
assert.ok(p1.y < initialY, "Player Y coordinate should decrease (rise)");

const idleInput = InputHandler.deserializeInputState({ sequenceId: 2 });
p1.update(0.1, idleInput, new EnemyManager(tileMap));

const phaseInput = InputHandler.deserializeInputState({ phase: true, sequenceId: 3 });
p1.spawn(128, 100);
p1.update(0.1, phaseInput, new EnemyManager(tileMap));
assert.equal(
  p1.phaseCooldown,
  PLAYER_PHYSICS.PHASE_COOLDOWN_TIME,
  "Phase beam should enter a one-second cooldown after firing",
);
console.log("   ✅ Phase beam cooldown is enforced.");

// Ladder movement speed test
const ladderCol = 5;
const ladderRow = 5;
tileMap.setTile(ladderCol, ladderRow, TILES.LADDER);
tileMap.setTile(ladderCol, ladderRow + 1, TILES.BRICK);
tileMap.setTile(ladderCol + 1, ladderRow, TILES.AIR);
tileMap.setTile(ladderCol + 1, ladderRow + 1, TILES.BRICK);

const ladderX = ladderCol * TILE_SIZE + 5;
const ladderY = ladderRow * TILE_SIZE + (TILE_SIZE - PLAYER_PHYSICS.HEIGHT);

p1.spawn(ladderX, ladderY);
p1.isGrounded = true;
p1.isClimbing = true;
const groundedRightInput = InputHandler.deserializeInputState({ right: true, sequenceId: 4 });
p1.simulateMovement(0.1, groundedRightInput, new EnemyManager(tileMap));
const groundedVx = p1.vx;

p1.spawn(ladderX, ladderY - 10);
p1.isGrounded = false;
p1.isClimbing = true;
const airRightInput = InputHandler.deserializeInputState({ right: true, up: true, sequenceId: 5 });
p1.simulateMovement(0.1, airRightInput, new EnemyManager(tileMap));
const airVx = p1.vx;

assert.ok(
  groundedVx > airVx,
  `Grounded ladder speed (${groundedVx}) should be faster than air climbing ladder speed (${airVx})`,
);
assert.equal(groundedVx, 120, "Grounded ladder speed should be full speed (120)");
assert.equal(airVx, 60, "Air climbing ladder speed should be half speed (60)");
console.log("   ✅ Ladder speed when grounded vs in air verified.\n");

// 4. Verify Input State Serialization
console.log("4️⃣  Testing Input Handler Payload Serialization...");
const input = new InputHandler();
const serialized = input.serializeInputState(42);
assert.equal(serialized.sequenceId, 42);
assert.equal(serialized.thrust, false);

const deserialized = InputHandler.deserializeInputState({
  right: true,
  thrust: true,
  sequenceId: 43,
});
assert.equal(deserialized.right, true);
assert.equal(deserialized.thrust, true);
assert.equal(deserialized.left, false);
assert.equal(deserialized.sequenceId, 43);
console.log("   ✅ Input state serialization & deserialization passed.\n");

// 5. Verify PlayerManager & Snapshot Entity Sync
console.log("5️⃣  Testing PlayerManager Entity Lifecycle & Snapshot Sync...");
import("../js/entities/playerManager.js").then(({ PlayerManager }) => {
  const manager = new PlayerManager(null, tileMap);
  manager.setLocalSocketId("socket_1");

  const pLocal = manager.addPlayer("socket_1", {
    name: "Alpha",
    color: "#ff4444",
  });
  const pRemote = manager.addPlayer("socket_2", {
    name: "Beta",
    color: "#44ff44",
  });

  assert.equal(manager.getLocalPlayer(), pLocal);
  assert.equal(pLocal.isLocal, true);
  assert.equal(pRemote.isLocal, false);

  manager.updateFromSnapshot([
    [
      "socket_1",
      pLocal.id,
      200,
      150,
      0,
      0,
      85,
      3,
      0,
      PLAYER_FLAGS.IS_THRUSTING,
      0,
      0,
    ],
    [
      "socket_2",
      pRemote.id,
      300,
      180,
      0,
      0,
      90,
      3,
      0,
      PLAYER_FLAGS.IS_PHASING,
      0,
      0,
    ],
    ["socket_3", "p3", 400, 200, 0, 0, 100, 3, 0, 0, 0, 0],
  ]);

  assert.equal(pLocal.x, 200);
  assert.equal(pLocal.fuel, 85);
  assert.equal(pLocal.isThrusting, true);
  assert.equal(pRemote.x, 300);
  assert.equal(pRemote.isPhasing, true);

  const p3 = manager.getPlayer("socket_3");
  assert.notEqual(p3, null);

  manager.updateFromSnapshot([
    ["socket_1", pLocal.id, 210, 150, 0, 0, 85, 3, 0, 0, 0, 0],
    ["socket_3", "p3", 410, 200, 0, 0, 100, 3, 0, 0, 0, 0],
  ]);

  assert.equal(manager.getPlayer("socket_2"), undefined);
  assert.equal(manager.players.size, 2);

  pLocal.takeDamage();
  assert.equal(pLocal.isDead, true);

  manager.updateFromSnapshot([
    ["socket_1", pLocal.id, 210, 150, 0, 0, 85, 3, 0, 0, 0, 0],
  ]);
  assert.equal(pLocal.isDead, true);

  manager.updateFromSnapshot([
    [
      "socket_1",
      pLocal.id,
      210,
      150,
      0,
      0,
      85,
      2,
      0,
      PLAYER_FLAGS.IS_DEAD,
      0,
      0,
    ],
  ]);
  assert.equal(pLocal.isDead, true);
  assert.equal(pLocal.serverAcknowledgedDeath, true);
  assert.equal(pLocal.lives, 2);

  manager.updateFromSnapshot([
    ["socket_1", pLocal.id, 128, 100, 0, 0, 100, 2, 0, 0, 0, 0],
  ]);
  assert.equal(pLocal.isDead, false);
  assert.equal(pLocal.x, 128);
  assert.equal(pLocal.y, 100);

  pLocal.takeDamage();
  assert.equal(pLocal.isDead, true);
  pLocal._localDeathTimestamp = Date.now() - 600;
  manager.updateFromSnapshot([
    ["socket_1", pLocal.id, 128, 100, 0, 0, 100, 1, 0, 0, 0, 0],
  ]);
  assert.equal(
    pLocal.isDead,
    false,
    "Player should recover from dropped death snapshot after 500ms",
  );
  assert.equal(pLocal.lives, 1);

  pLocal.spawn(128, 100);
  assert.ok(
    pLocal.respawnInvulnerability > 0,
    "Spawn should set respawnInvulnerability",
  );
  const livesBefore = pLocal.lives;
  pLocal.takeDamage();
  assert.equal(
    pLocal.lives,
    livesBefore,
    "takeDamage must be ignored during respawnInvulnerability",
  );

  const enemyMgr = new EnemyManager(tileMap);
  enemyMgr.addFlitzer(100, 100, 50, 50, "flitzer_test");
  const initialAnimTimer = enemyMgr.enemies[0].animTimer!;
  enemyMgr.interpolateEnemies(0.1);
  assert.ok(
    enemyMgr.enemies[0].animTimer! > initialAnimTimer,
    "Flitzer animTimer must advance during interpolation",
  );

  console.log("   ✅ PlayerManager entity lifecycle & snapshot sync passed.\n");
  console.log("🎉 ALL SHARED CORE MODULE TESTS PASSED SUCCESSFULLY!");
});
