import assert from "node:assert/strict";
import { TileMap } from "../js/world/tilemap.js";
import { PlayerManager } from "../js/entities/playerManager.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy.js";

class MockAudio {
  phaseSoundsPlayed: number = 0;
  phaseImpactsPlayed: number = 0;
  explosionsPlayed: number = 0;
  thrustStarted: number = 0;
  thrustStopped: number = 0;

  playPhaseSound(): void {
    this.phaseSoundsPlayed++;
  }
  playPhaseImpact(): void {
    this.phaseImpactsPlayed++;
  }
  playExplosion(): void {
    this.explosionsPlayed++;
  }
  startThrust(): void {
    this.thrustStarted++;
  }
  stopThrust(): void {
    this.thrustStopped++;
  }
}

console.log("🧪 Running Remote Sound Effects Test Suite...\n");

// 1. Test Remote Player Laser Sound (playPhaseSound)
{
  console.log("1️⃣  Testing Remote Player Laser Fire Sound (playPhaseSound)...");
  const audio = new MockAudio();
  const tileMap = new TileMap();
  const manager = new PlayerManager(audio, tileMap);
  manager.setLocalSocketId("local_socket");

  const pLocal = manager.addPlayer("local_socket", { isLocal: true });
  const pRemote = manager.addPlayer("remote_socket", { isLocal: false });

  assert.equal(audio.phaseSoundsPlayed, 0, "No sounds played initially");

  // Remote player starts phasing
  pRemote.setPhasing(true);
  assert.equal(audio.phaseSoundsPlayed, 1, "Remote player laser fire triggered playPhaseSound");

  // Subsequent call while already phasing should not re-trigger
  pRemote.setPhasing(true);
  assert.equal(audio.phaseSoundsPlayed, 1, "Redundant setPhasing(true) did not duplicate sound");

  // Reset phasing
  pRemote.setPhasing(false);
  pRemote.setPhasing(true);
  assert.equal(audio.phaseSoundsPlayed, 2, "Re-firing phase beam played playPhaseSound again");
  console.log("   ✅ Remote player laser fire sound verified.");
}

// 2. Test Remote Player Thrust Audio State (startThrust / stopThrust)
{
  console.log("\n2️⃣  Testing Global Thrust Audio Evaluation across Local & Remote Players...");
  const audio = new MockAudio();
  const tileMap = new TileMap();
  const manager = new PlayerManager(audio, tileMap);
  manager.setLocalSocketId("local_socket");

  const pLocal = manager.addPlayer("local_socket", { isLocal: true });
  const pRemote = manager.addPlayer("remote_socket", { isLocal: false });

  // Neither player thrusting
  manager.update(0.016);
  assert.equal(audio.thrustStarted, 0);
  assert.ok(audio.thrustStopped > 0, "stopThrust called when no player thrusts");

  const initialStops = audio.thrustStopped;

  // Remote player starts thrusting
  pRemote.isThrusting = true;
  manager.update(0.016);
  assert.ok(audio.thrustStarted > 0, "startThrust called when remote player thrusts");

  // Remote player stops thrusting
  pRemote.isThrusting = false;
  manager.update(0.016);
  assert.ok(audio.thrustStopped > initialStops, "stopThrust called when remote player stops thrusting");

  console.log("   ✅ Remote player thrust audio evaluation verified.");
}

// 3. Test Remote Player Death / Hit Explosion Sound
{
  console.log("\n3️⃣  Testing Remote Player Death / Hit Explosion Sound...");
  const audio = new MockAudio();
  const tileMap = new TileMap();
  const manager = new PlayerManager(audio, tileMap);
  manager.setLocalSocketId("local_socket");

  const pLocal = manager.addPlayer("local_socket", { isLocal: true });
  const pRemote = manager.addPlayer("remote_socket", { isLocal: false });

  const initialExplosions = audio.explosionsPlayed;

  // Receive snapshot where remote player dies
  manager.updateFromSnapshot({
    players: [
      {
        socketId: "remote_socket",
        id: "remote_socket",
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        fuel: 100,
        lives: 2,
        score: 0,
        isDead: true,
      },
    ],
  });

  assert.ok(audio.explosionsPlayed > initialExplosions, "Remote player death triggered explosion hit sound");
  assert.equal(pRemote.isDead, true, "Remote player marked as dead");
  console.log("   ✅ Remote player death explosion hit sound verified.");
}

// 4. Test Enemy Snapshot Hit Sound
{
  console.log("\n4️⃣  Testing Enemy Hit Sound on Snapshot HP Drop...");
  const audio = new MockAudio();
  const tileMap = new TileMap();
  const enemyMgr = new EnemyManager(tileMap, audio);

  enemyMgr.addBoss(100, 100, 25, "boss_1");
  const initialImpacts = audio.phaseImpactsPlayed;

  // Snapshot with reduced HP (hit taken)
  enemyMgr.applyEnemySnapshot(
    [
      {
        id: "boss_1",
        type: ENEMY_TYPES.BOSS,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        animTimer: 0,
        timer: 0,
        fireInterval: 2,
        hp: 24,
        maxHp: 25,
        phase: 1,
        hitFlashTimer: 0.15,
      },
    ],
    [],
  );

  assert.ok(audio.phaseImpactsPlayed > initialImpacts, "Enemy hit triggered phase impact sound");
  console.log("   ✅ Enemy hit sound on snapshot update verified.");
}

console.log("\n🎉 ALL REMOTE SOUND EFFECT TESTS PASSED CLEANLY!");
