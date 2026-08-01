/* ==========================================================================
   NODE.JS SHARED MODULES VALIDATION SUITE
   ========================================================================== */

import assert from 'node:assert/strict';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, TILES, PLAYER_PHYSICS, GAME_EVENTS } from '../js/shared/constants.js';
import { TileMap } from '../js/world/tilemap.js';
import { Player } from '../js/entities/player.js';
import { InputHandler } from '../js/engine/input.js';
import { EnemyManager } from '../js/entities/enemy.js';
import { CAMPAIGN_LEVELS } from '../js/levels/campaign.js';

console.log('🧪 Starting Node.js Shared Core Modules Test Suite...\n');

// 1. Verify Constants
console.log('1️⃣  Testing Shared Constants & Physics Parameters...');
assert.equal(TILE_SIZE, 32);
assert.equal(GRID_COLS, 30);
assert.equal(GRID_ROWS, 18);
assert.equal(PLAYER_PHYSICS.WIDTH, 22);
assert.equal(PLAYER_PHYSICS.GRAVITY, 950);
assert.equal(GAME_EVENTS.TILE_PHASED, 'tile_phased');
console.log('   ✅ Shared Constants verified.\n');

// 2. Verify TileMap & Event System
console.log('2️⃣  Testing TileMap, Event Dispatches, & Phase Bricks...');
const tileMap = new TileMap();
tileMap.loadLevelData(CAMPAIGN_LEVELS[0]);

let phasedEventReceived = null;
let restoredEventReceived = null;

tileMap.on(GAME_EVENTS.TILE_PHASED, (data) => {
    phasedEventReceived = data;
});

tileMap.on(GAME_EVENTS.TILE_RESTORED, (data) => {
    restoredEventReceived = data;
});

// Find a PHASE_BRICK tile in level 0 or set one for testing
let targetCol = -1, targetRow = -1;
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

// Phase the tile
const phased = tileMap.phaseTile(targetCol, targetRow);
assert.equal(phased, true);
assert.equal(tileMap.getTile(targetCol, targetRow), TILES.AIR);
assert.notEqual(phasedEventReceived, null);
assert.equal(phasedEventReceived.col, targetCol);
assert.equal(phasedEventReceived.row, targetRow);
console.log('   ✅ Tile Phase event dispatched successfully.');

// Fast-forward time to trigger tile restoration
tileMap.update(5.1);
assert.equal(tileMap.getTile(targetCol, targetRow), TILES.PHASE_BRICK);
assert.notEqual(restoredEventReceived, null);
assert.equal(restoredEventReceived.col, targetCol);
assert.equal(restoredEventReceived.row, targetRow);
console.log('   ✅ Tile Restore event dispatched successfully.\n');

// 3. Verify Headless Multi-Player Physics Simulation
console.log('3️⃣  Testing Headless Multi-Player Physics & Collision...');
const p1 = new Player(null, tileMap, { id: 'p1', color: '#ff0000', name: 'Player 1' });
const p2 = new Player(null, tileMap, { id: 'p2', color: '#00ff00', name: 'Player 2' });

assert.equal(p1.id, 'p1');
assert.equal(p2.id, 'p2');
assert.equal(p1.color, '#ff0000');
assert.equal(p2.color, '#00ff00');

const spawnX = 128, spawnY = 100;
p1.spawn(spawnX, spawnY);
const initialY = p1.y;

// Simulate thrusting input
const thrustInput = InputHandler.deserializeInputState({ thrust: true, sequenceId: 1 });
p1.update(0.1, thrustInput, null);
assert.ok(p1.vy < 0, `Player velocity (${p1.vy}) should be negative (upward) under thrust`);
assert.ok(p1.y < initialY, 'Player Y coordinate should decrease (rise)');

// Simulate gravity tick (no thrust)
const idleInput = InputHandler.deserializeInputState({ sequenceId: 2 });
p1.update(0.1, idleInput, null);
console.log('   ✅ Multi-Player headless physics simulation passed.\n');

// 4. Verify Input State Serialization
console.log('4️⃣  Testing Input Handler Payload Serialization...');
const input = new InputHandler();
const serialized = input.serializeInputState(42);
assert.equal(serialized.sequenceId, 42);
assert.equal(serialized.thrust, false);

const deserialized = InputHandler.deserializeInputState({ right: true, thrust: true, sequenceId: 43 });
assert.equal(deserialized.right, true);
assert.equal(deserialized.thrust, true);
assert.equal(deserialized.left, false);
assert.equal(deserialized.sequenceId, 43);
console.log('   ✅ Input state serialization & deserialization passed.\n');

// 5. Verify PlayerManager & Snapshot Entity Sync
console.log('5️⃣  Testing PlayerManager Entity Lifecycle & Snapshot Sync...');
import('../js/entities/playerManager.js').then(({ PlayerManager }) => {
    const manager = new PlayerManager(null, tileMap);
    manager.setLocalSocketId('socket_1');

    const pLocal = manager.addPlayer('socket_1', { name: 'Alpha', color: '#ff4444' });
    const pRemote = manager.addPlayer('socket_2', { name: 'Beta', color: '#44ff44' });

    assert.equal(manager.getLocalPlayer(), pLocal);
    assert.equal(pLocal.isLocal, true);
    assert.equal(pRemote.isLocal, false);

    // Apply snapshot update
    manager.updateFromSnapshot([
        { socketId: 'socket_1', id: pLocal.id, x: 200, y: 150, fuel: 85, isThrusting: true },
        { socketId: 'socket_2', id: pRemote.id, x: 300, y: 180, fuel: 90, isPhasing: true },
        { socketId: 'socket_3', id: 'p3', name: 'Gamma', color: '#4488ff', x: 400, y: 200 }
    ]);

    // Local player properties should NOT be overwritten by server snapshot
    assert.equal(pLocal.x, 100);
    assert.equal(pLocal.fuel, 100);
    assert.equal(pLocal.isThrusting, false);
    assert.equal(pRemote.x, 300);
    assert.equal(pRemote.isPhasing, true);

    const p3 = manager.getPlayer('socket_3');
    assert.notEqual(p3, null);
    assert.equal(p3.name, 'Gamma');

    // Snapshot omitting socket_2 should prune socket_2
    manager.updateFromSnapshot([
        { socketId: 'socket_1', id: pLocal.id, x: 210, y: 150 },
        { socketId: 'socket_3', id: 'p3', x: 410, y: 200 }
    ]);

    assert.equal(manager.getPlayer('socket_2'), undefined);
    assert.equal(manager.players.size, 2);

    // Test multiplayer death snapshot synchronization:
    // 1. Local player takes damage
    pLocal.takeDamage();
    assert.equal(pLocal.isDead, true);

    // 2. Incoming stale server snapshot (sent before server processed death, so isDead: false)
    manager.updateFromSnapshot([
        { socketId: 'socket_1', id: pLocal.id, x: 210, y: 150, isDead: false }
    ]);
    // Should NOT revive local player prematurely!
    assert.equal(pLocal.isDead, true);

    // 3. Server acknowledges death (isDead: true)
    manager.updateFromSnapshot([
        { socketId: 'socket_1', id: pLocal.id, x: 210, y: 150, isDead: true, lives: 2 }
    ]);
    assert.equal(pLocal.isDead, true);
    assert.equal(pLocal.serverAcknowledgedDeath, true);
    assert.equal(pLocal.lives, 2);

    // 4. Server signals respawn (isDead: false with new spawn coordinates)
    manager.updateFromSnapshot([
        { socketId: 'socket_1', id: pLocal.id, x: 128, y: 100, isDead: false, lives: 2 }
    ]);
    assert.equal(pLocal.isDead, false);
    assert.equal(pLocal.x, 128);
    assert.equal(pLocal.y, 100);

    // 4.5 Test fallback respawn if server's isDead: true snapshot was dropped by network
    pLocal.takeDamage();
    assert.equal(pLocal.isDead, true);
    pLocal._localDeathTimestamp = Date.now() - 600; // Simulate 600ms passed
    manager.updateFromSnapshot([
        { socketId: 'socket_1', id: pLocal.id, x: 128, y: 100, isDead: false, lives: 1 }
    ]);
    assert.equal(pLocal.isDead, false, 'Player should recover from dropped death snapshot after 500ms');
    assert.equal(pLocal.lives, 1);

    // 4.6 Test Spawn Invulnerability
    pLocal.spawn(128, 100);
    assert.ok(pLocal.respawnInvulnerability > 0, 'Spawn should set respawnInvulnerability');
    const livesBefore = pLocal.lives;
    pLocal.takeDamage();
    assert.equal(pLocal.lives, livesBefore, 'takeDamage must be ignored during respawnInvulnerability');

    // 5. Test EnemyManager interpolation and animTimer advancement
    const enemyMgr = new EnemyManager(tileMap);
    enemyMgr.addFlitzer(100, 100, 50, 50, 'flitzer_test');
    const initialAnimTimer = enemyMgr.enemies[0].animTimer;
    enemyMgr.interpolateEnemies(0.1);
    assert.ok(enemyMgr.enemies[0].animTimer > initialAnimTimer, 'Flitzer animTimer must advance during interpolation');

    console.log('   ✅ PlayerManager entity lifecycle & snapshot sync passed.\n');
    console.log('🎉 ALL SHARED CORE MODULE TESTS PASSED SUCCESSFULLY!');
});
