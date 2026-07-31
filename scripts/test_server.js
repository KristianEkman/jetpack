/* ==========================================================================
   NODE.JS BACKEND SERVER INTEGRATION TEST SUITE
   ========================================================================== */

import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { httpServer, gameLoop, roomManager, io } from '../server/index.js';
import { GAME_EVENTS } from '../js/shared/constants.js';

console.log('🧪 Starting Node.js Backend Server Integration Test Suite...\n');

// 1. Start Server on ephemeral test port (3099)
const TEST_PORT = 3099;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve));
gameLoop.start();
console.log(`1️⃣  Server started on ${SERVER_URL}`);

let client1 = null;
let client2 = null;

try {
    // 2. HTTP Health Endpoint Verification
    console.log('2️⃣  Testing GET /health Endpoint...');
    const res = await fetch(`${SERVER_URL}/health`);
    assert.equal(res.status, 200);
    const health = await res.json();
    assert.equal(health.status, 'ok');
    console.log('   ✅ HTTP Health check endpoint responded correctly.\n');

    // 3. Socket.IO Client 1 Connection & Handshake
    console.log('3️⃣  Testing Socket.IO Client Connection & Handshake...');
    client1 = ioClient(SERVER_URL, { forceNew: true });
    
    await new Promise((resolve) => client1.on('connect', resolve));
    assert.ok(client1.id, 'Client 1 should receive a valid socket ID');
    console.log(`   ✅ Client 1 connected with socket ID: ${client1.id}`);

    // Ping / Pong Handshake
    const handshakeReply = await new Promise((resolve) => {
        client1.emit('ping_handshake', (data) => resolve(data));
    });
    assert.equal(handshakeReply.pong, true);
    assert.equal(handshakeReply.socketId, client1.id);
    console.log('   ✅ Handshake ping/pong verified successfully.\n');

    // 4. Room Creation
    console.log('4️⃣  Testing Room Creation...');
    const createResult = await new Promise((resolve) => {
        client1.emit('create_room', { playerName: 'Host Pilot', playerColor: '#ff0000' }, resolve);
    });
    assert.equal(createResult.success, true);
    assert.ok(createResult.roomId, 'Room ID should be generated');
    assert.equal(createResult.roomId.length, 4, 'Room code should be 4 characters');
    const roomId = createResult.roomId;
    console.log(`   ✅ Room created with code: ${roomId}`);
    assert.equal(createResult.room.players.length, 1);
    assert.equal(createResult.room.players[0].name, 'Host Pilot');
    console.log('   ✅ Host room metadata verified.\n');

    // 5. Client 2 Joining Room
    console.log('5️⃣  Testing Client 2 Joining Room & Event Broadcasts...');
    client2 = ioClient(SERVER_URL, { forceNew: true });
    await new Promise((resolve) => client2.on('connect', resolve));

    let client1PlayerJoinedEvent = null;
    client1.on('player_joined', (data) => {
        client1PlayerJoinedEvent = data;
    });

    const joinResult = await new Promise((resolve) => {
        client2.emit('join_room', { roomId: roomId, playerName: 'Wingman', playerColor: '#00ff00' }, resolve);
    });

    assert.equal(joinResult.success, true);
    assert.equal(joinResult.room.id, roomId);
    assert.equal(joinResult.room.players.length, 2);
    console.log('   ✅ Client 2 joined room successfully.');

    // Wait briefly for event listener to catch `player_joined` on Client 1
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.notEqual(client1PlayerJoinedEvent, null, 'Client 1 should receive player_joined event');
    assert.equal(client1PlayerJoinedEvent.player.name, 'Wingman');
    console.log('   ✅ player_joined broadcast event received by host.\n');

    // 6. World Snapshot Broadcasting (60 Hz Game Loop)
    console.log('6️⃣  Testing 60 Hz World Snapshot Ticks...');
    const snapshotsReceived = [];
    client1.on(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', (snapshot) => {
        snapshotsReceived.push(snapshot);
    });

    // Collect snapshots for ~150ms (~9 ticks)
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(snapshotsReceived.length >= 3, `Should receive at least 3 snapshot ticks (received ${snapshotsReceived.length})`);
    
    const latestSnapshot = snapshotsReceived[snapshotsReceived.length - 1];
    assert.equal(latestSnapshot.roomId, roomId);
    assert.equal(latestSnapshot.players.length, 2);
    assert.ok(latestSnapshot.tick > 0);
    console.log(`   ✅ Received ${snapshotsReceived.length} ticks. Latest tick: #${latestSnapshot.tick} with ${latestSnapshot.players.length} players.\n`);

    // 7. Player Input Emission
    console.log('7️⃣  Testing Player Input Processing...');
    client2.emit(GAME_EVENTS.PLAYER_INPUT || 'player_input', {
        thrust: true,
        sequenceId: 101
    });
    // Wait one tick
    await new Promise((resolve) => setTimeout(resolve, 30));
    const room = roomManager.getRoom(roomId);
    const client2Config = room.playerConfigs.get(client2.id);
    assert.equal(client2Config.lastSequenceId, 101);
    console.log('   ✅ Client 2 input sequenceId updated on server.\n');

    // 8. Client Disconnection & Room Cleanup
    console.log('8️⃣  Testing Client Disconnect & Room Cleanup...');
    let client1PlayerLeftEvent = null;
    client1.on('player_left', (data) => {
        client1PlayerLeftEvent = data;
    });

    client2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.notEqual(client1PlayerLeftEvent, null, 'Client 1 should receive player_left notification');
    assert.equal(client1PlayerLeftEvent.socketId, client2.id);
    assert.equal(roomManager.getRoom(roomId).players.size, 1);
    console.log('   ✅ Client 2 leave cleanup verified.');

    client1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(roomManager.getRoom(roomId), null, 'Room should be destroyed when all players disconnect');
    console.log('   ✅ Empty room destruction verified.\n');

    console.log('🎉 ALL BACKEND SERVER INTEGRATION TESTS PASSED SUCCESSFULLY!');
} finally {
    gameLoop.stop();
    if (client1) client1.close();
    if (client2) client2.close();
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
    process.exit(0);
}
