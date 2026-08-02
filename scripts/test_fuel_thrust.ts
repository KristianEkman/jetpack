import assert from 'node:assert/strict';
import { GameLoop } from '../server/gameLoop.js';

class FakePlayer {
  fuel = 100;
  simulateCalls = 0;
  isDead = false;
  respawnInvulnerability = 0;
  deathTimer = 0;
  lives = 3;
  score = 0;
  facingRight = true;
  isGrounded = false;
  isThrusting = false;
  isClimbing = false;
  isPhasing = false;
  phaseCooldown = 0;
  phaseBeamTimer = 0;
  teleportCooldown = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  id = 'player-1';
  name = 'Tester';

  simulateMovement(dt: number, input: any): void {
    this.simulateCalls += 1;
    this.fuel = Math.max(0, this.fuel - 18 * dt);
    this.isThrusting = !!input?.thrust;
  }

  checkCollectibles(): void {}
  spawn(): void {}
}

const fakeTileMap = {
  update() {},
  getTile() { return 0; },
  isSolid() { return false; },
  isClimbable() { return false; },
  totalEmeralds: 0,
  collectedEmeralds: 0,
  rows: 1,
  cols: 1,
  emit() {},
  addSparkles() {},
  rebuildTeleporters() {},
  countTotalEmeralds() {},
};

const player = new FakePlayer();
const room = {
  id: 'room-1',
  tickCount: 0,
  status: 'playing',
  tileMap: fakeTileMap,
  players: new Map([['socket-1', player]]),
  playerConfigs: new Map([['socket-1', {
    pendingInputs: [{ x: 10, y: 20, thrust: true, sequenceId: 1 }],
    lastInput: null,
    lastSequenceId: 0,
  }]]),
  enemyManager: null,
};

const roomManager = { rooms: new Map([['room-1', room]]) };
const io = {
  to() {
    return {
      volatile: { emit() {} },
      emit() {},
    };
  },
};

const gameLoop = new GameLoop(roomManager as any, io as any, 60);
gameLoop.tick();

assert.equal(player.simulateCalls, 1, 'thrust input should still run movement simulation');
assert.ok(player.fuel < 100, 'thrusting should reduce fuel');

console.log('✅ fuel-thrust regression test passed');
