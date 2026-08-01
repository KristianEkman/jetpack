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
    const playerJoinedPromise = new Promise((resolve) => {
        client1.on('player_joined', (data) => {
            client1PlayerJoinedEvent = data;
            resolve(data);
        });
    });

    const joinResult = await new Promise((resolve) => {
        client2.emit('join_room', { roomId: roomId, playerName: 'Wingman', playerColor: '#00ff00' }, resolve);
    });

    assert.equal(joinResult.success, true);
    assert.equal(joinResult.room.id, roomId);
    assert.equal(joinResult.room.players.length, 2);
    console.log('   ✅ Client 2 joined room successfully.');

    // Wait for player_joined event or timeout after 500ms
    await Promise.race([
        playerJoinedPromise,
        new Promise((resolve) => setTimeout(resolve, 500))
    ]);

    assert.notEqual(client1PlayerJoinedEvent, null, 'Client 1 should receive player_joined event');
    assert.equal(client1PlayerJoinedEvent.player.name, 'Wingman');
    console.log('   ✅ player_joined broadcast event received by host.\n');

    // 6. World Snapshot Broadcasting (60 Hz Game Loop)
    console.log('6️⃣  Testing 60 Hz World Snapshot Ticks...');
    const snapshotsReceived = [];
    client1.on(GAME_EVENTS.WORLD_SNAPSHOT || 'world_snapshot', (snapshot) => {
        snapshotsReceived.push(snapshot);
    });

    // Collect snapshots for ~350ms
    await new Promise((resolve) => setTimeout(resolve, 350));
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

    // 8. Multiplayer Match Start, Level Completion & Next Level Transition
    console.log('8️⃣  Testing Multiplayer Level Complete & Next Level Flow...');
    const startMatchResult = await new Promise((resolve) => {
        client1.emit(GAME_EVENTS.START_MATCH || 'start_match', {}, resolve);
    });
    assert.equal(startMatchResult.success, true);
    assert.equal(room.status, 'playing');
    console.log('   ✅ Match started successfully.');

    // Client 2 completes level
    let client1LevelCompleteEvent = null;
    const levelCompletePromise = new Promise((resolve) => {
        client1.on(GAME_EVENTS.LEVEL_COMPLETE || 'level_complete', (data) => {
            client1LevelCompleteEvent = data;
            resolve(data);
        });
    });

    const completeResult = await new Promise((resolve) => {
        client2.emit(GAME_EVENTS.COMPLETE_LEVEL || 'complete_level', {}, resolve);
    });
    assert.equal(completeResult.success, true);
    assert.equal(completeResult.clearedBy, 'Wingman');

    await Promise.race([
        levelCompletePromise,
        new Promise((resolve) => setTimeout(resolve, 500))
    ]);

    assert.notEqual(client1LevelCompleteEvent, null, 'Client 1 should receive level_complete event');
    assert.equal(client1LevelCompleteEvent.clearedBy, 'Wingman');
    assert.equal(room.status, 'level_complete');
    console.log('   ✅ level_complete broadcast and room state verified.');

    // Non-host attempts next_level (should be rejected)
    const nonHostNextResult = await new Promise((resolve) => {
        client2.emit(GAME_EVENTS.NEXT_LEVEL || 'next_level', {}, resolve);
    });
    assert.equal(nonHostNextResult.success, false);
    assert.equal(nonHostNextResult.error, 'Only the room host can advance to the next level');
    console.log('   ✅ Non-host next_level permission restriction verified.');

    // Host emits next_level
    let client2GameStartedEvent = null;
    const gameStartedPromise = new Promise((resolve) => {
        client2.on(GAME_EVENTS.GAME_STARTED || 'game_started', (data) => {
            client2GameStartedEvent = data;
            resolve(data);
        });
    });

    const hostNextResult = await new Promise((resolve) => {
        client1.emit(GAME_EVENTS.NEXT_LEVEL || 'next_level', {}, resolve);
    });
    assert.equal(hostNextResult.success, true);
    assert.equal(hostNextResult.levelIndex, 1);

    await Promise.race([
        gameStartedPromise,
        new Promise((resolve) => setTimeout(resolve, 500))
    ]);

    assert.notEqual(client2GameStartedEvent, null, 'Client 2 should receive game_started event');
    assert.equal(client2GameStartedEvent.levelIndex, 1);
    assert.equal(room.status, 'playing');
    console.log('   ✅ Host next_level advanced room levelIndex to 1 and synchronized clients.\n');

    // 8.5 Enemy Destruction Synchronization Verification
    console.log('8️⃣.5️⃣  Testing Enemy Destruction Synchronization...');
    let client2EnemyDestroyedData = null;
    const enemyDestroyedPromise = new Promise((resolve) => {
        client2.on(GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed', (data) => {
            client2EnemyDestroyedData = data;
            resolve(data);
        });
    });

    const destroyAck = await new Promise((resolve) => {
        client1.emit(GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed', { enemyId: 'enemy_0' }, resolve);
    });
    assert.equal(destroyAck.success, true);

    await Promise.race([
        enemyDestroyedPromise,
        new Promise((resolve) => setTimeout(resolve, 500))
    ]);

    assert.notEqual(client2EnemyDestroyedData, null, 'Client 2 should receive enemy_destroyed event');
    assert.equal(client2EnemyDestroyedData.enemyId, 'enemy_0');
    assert.equal(client2EnemyDestroyedData.killedBy, client1.id);
    assert.equal(room.destroyedEnemyIds.has('enemy_0'), true);

    // Verify duplicate shot handling
    const dupAck = await new Promise((resolve) => {
        client1.emit(GAME_EVENTS.ENEMY_DESTROYED || 'enemy_destroyed', { enemyId: 'enemy_0' }, resolve);
    });
    assert.equal(dupAck.duplicate, true);
    console.log('   ✅ Enemy destruction event broadcast and duplicate handling verified.\n');

    // 8.6 Testing All-Players-Eliminated Game Over Flow
    console.log('8️⃣.6️⃣  Testing All Players Eliminated Game Over Flow...');
    const targetRoom = roomManager.getRoom(roomId);
    targetRoom.status = 'playing';
    for (const p of targetRoom.players.values()) {
        p.isDead = true;
        p.lives = 0;
    }

    let gameOverData = null;
    const gameOverPromise = new Promise((resolve) => {
        client1.on(GAME_EVENTS.GAME_OVER || 'game_over', (data) => {
            gameOverData = data;
            resolve(data);
        });
    });

    // Tick game loop once to evaluate game over
    gameLoop.tick();

    await Promise.race([
        gameOverPromise,
        new Promise((resolve) => setTimeout(resolve, 500))
    ]);

    assert.notEqual(gameOverData, null, 'Client 1 should receive game_over event when all players are eliminated');
    assert.equal(targetRoom.status, 'finished');
    console.log('   ✅ All players eliminated game_over broadcast and room state verified.\n');

    // 9. Client Disconnection & Room Cleanup
    console.log('9️⃣  Testing Client Disconnect & Room Cleanup...');
    let client1PlayerLeftEvent = null;
    const playerLeftPromise = new Promise((resolve) => {
        client1.on('player_left', (data) => {
            client1PlayerLeftEvent = data;
            resolve(data);
        });
    });

    const client2SocketId = client2.id;
    client2.disconnect();
    await Promise.race([
        playerLeftPromise,
        new Promise((resolve) => setTimeout(resolve, 500))
    ]);

    assert.notEqual(client1PlayerLeftEvent, null, 'Client 1 should receive player_left notification');
    assert.equal(client1PlayerLeftEvent.socketId, client2SocketId);
    assert.equal(roomManager.getRoom(roomId).players.size, 1);
    console.log('   ✅ Client 2 leave cleanup verified.');

    client1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(roomManager.getRoom(roomId), undefined, 'Room should be destroyed when all players disconnect');
    console.log('   ✅ Empty room destruction verified.\n');

    console.log('🎉 ALL BACKEND SERVER INTEGRATION TESTS PASSED SUCCESSFULLY!');
} catch (err) {
    console.error('❌ Integration Test Error:', err);
    process.exitCode = 1;
} finally {
    gameLoop.stop();
    if (client1) client1.close();
    if (client2) client2.close();
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
    process.exit(0);
}
