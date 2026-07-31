/* ==========================================================================
   TEST SUITE: PHASE 5 WORLD STATE SYNC & CUSTOM MAP SHARING
   ========================================================================== */

import assert from 'node:assert';
import { RoomManager } from '../server/roomManager.js';
import { GameLoop } from '../server/gameLoop.js';
import { GAME_EVENTS, TILES } from '../js/shared/constants.js';

console.log('🧪 Starting Phase 5 Test Suite...\n');

// 1. Room creation with Custom Map Payload
console.log('1️⃣  Testing Room Creation with Custom Map Payload...');
const roomManager = new RoomManager();

const customGrid = new Array(540).fill(TILES.AIR);
customGrid[0] = TILES.SPAWN;
customGrid[1] = TILES.EXIT_PORTAL;
customGrid[2] = TILES.EMERALD;
customGrid[3] = TILES.PHASE_BRICK;

const customMap = {
    name: 'Test Arena',
    author: 'TestBot',
    cols: 30,
    rows: 18,
    grid: customGrid
};

const room = roomManager.createRoom('socket_host_1', {
    playerName: 'HostPilot',
    customMapData: customMap
});

assert.strictEqual(room.mapName, 'Test Arena');
assert.strictEqual(room.customMapData.name, 'Test Arena');
assert.strictEqual(room.tileMap.grid[2], TILES.EMERALD);
console.log('   ✅ Custom Map room creation verified.');

// 2. Test Tile Map Net Event Dispatching
console.log('\n2️⃣  Testing World State Net Events (tile_phased, tile_restored, item_collected)...');

let phasedEventEmitted = false;
let restoredEventEmitted = false;
let itemCollectedEmitted = false;

room.tileMap.on(GAME_EVENTS.TILE_PHASED, (payload) => {
    phasedEventEmitted = true;
    assert.strictEqual(payload.col, 3);
});

room.tileMap.on(GAME_EVENTS.TILE_RESTORED, (payload) => {
    restoredEventEmitted = true;
    assert.strictEqual(payload.col, 3);
});

room.tileMap.on(GAME_EVENTS.ITEM_COLLECTED, (payload) => {
    itemCollectedEmitted = true;
    assert.strictEqual(payload.col, 2);
    assert.strictEqual(payload.tileType, TILES.EMERALD);
});

// Perform tile modifications
room.tileMap.phaseTile(3, 0); // Phase brick at col 3 row 0
assert.strictEqual(phasedEventEmitted, true);

room.tileMap.restoreTile(3, 0); // Restore brick
assert.strictEqual(restoredEventEmitted, true);

// Collect emerald at col 2 row 0 via player collectible check
const player = room.players.get('socket_host_1');
player.x = 2 * 32;
player.y = 0;
player.checkCollectibles();
assert.strictEqual(itemCollectedEmitted, true);
console.log('   ✅ TileMap net events verified.');

// 3. Test Snapshot WorldState and Level Completion
console.log('\n3️⃣  Testing Authoritative Level Complete & World Snapshot...');

let levelCompleteEmitted = false;

const mockIo = {
    to: (roomId) => ({
        emit: (evt, data) => {
            if (evt === GAME_EVENTS.LEVEL_COMPLETE) {
                levelCompleteEmitted = true;
            }
        }
    })
};

const gameLoop = new GameLoop(roomManager, mockIo, 60);

// Mark room as playing and collect remaining emeralds
room.status = 'playing';
room.tileMap.collectedEmeralds = room.tileMap.totalEmeralds;

// Move player onto EXIT_PORTAL (col 1, row 0)
player.x = 1 * 32;
player.y = 0;

// Run tick
gameLoop.tick();

assert.strictEqual(levelCompleteEmitted, true);
assert.strictEqual(room.status, 'finished');
console.log('   ✅ Authoritative Level Completion verified.');

console.log('\n🎉 ALL PHASE 5 TESTS PASSED SUCCESSFULLY!');
