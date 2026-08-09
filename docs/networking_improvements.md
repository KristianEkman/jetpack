# Networking — Improvement Opportunities

## 🔴 Security / Cheating Vulnerabilities

### 1. Client-trusted position is exploitable
In [gameLoop.ts:102-116](file:///Users/kristianekman/jetpack/server/gameLoop.ts#L102-L116), when the client sends `x`/`y` in its input state, the server **directly overwrites** the player entity position before running `simulateMovement()`. A malicious client can teleport anywhere by sending arbitrary coordinates.

**Fix:** The server should run its own physics authoritatively. Accept only input booleans (left/right/thrust/phase) and the sequence ID — never raw position. If you want client-side prediction for responsiveness, do server-side reconciliation by replaying inputs, not by trusting client positions.

---

### 2. No payload validation or sanitization
Throughout [index.ts](file:///Users/kristianekman/jetpack/server/index.ts), incoming socket data is cast to typed interfaces but never actually validated. A client could send:
- Non-numeric `x`/`y` values (NaN injection → physics breaks for everyone)
- Absurdly large `sequenceId` to bypass the sequence check
- Malformed `customMapData` with a grid of 540 items that are all strings instead of numbers

**Fix:** Add a validation layer (e.g., [zod](https://zod.dev/) schemas) for every inbound event payload. Reject and disconnect clients that send malformed data.

---

### 3. No rate limiting on socket events
A client can spam `player_input`, `enemy_destroyed`, or `complete_level` at any rate. The only throttle is client-side in [networkManager.ts:387-413](file:///Users/kristianekman/jetpack/js/network/networkManager.ts#L387-L413), which a cheater bypasses trivially.

**Fix:** Add server-side rate limiting per socket per event type. For example, cap `player_input` to ~120/s and `enemy_destroyed` to 10/s.

---

### 4. Enemy kills are client-claimed with no server verification
In [index.ts:365-401](file:///Users/kristianekman/jetpack/server/index.ts#L365-L401), the server only deduplicates enemy kills — it never checks whether the player was actually close enough to hit the enemy or had line-of-sight.

**Fix:** When `enemy_destroyed` arrives, verify on the server that the player's position and the enemy's position are within attack range, and that no wall tiles block the path. You already have test infrastructure for this from the wall-hit bug investigation.

---

## 🟡 Architecture Concerns

### 5. Dual authority for level completion
Level completion can be triggered **two different ways**:
- Client sends `complete_level` → [index.ts:403-443](file:///Users/kristianekman/jetpack/server/index.ts#L403-L443)
- Server game loop detects exit portal collision → [gameLoop.ts:177-224](file:///Users/kristianekman/jetpack/server/gameLoop.ts#L177-L224)

Both paths emit `level_complete` to the room. If they race, the level could complete twice. The `room.status = "finished"` guard partially protects this, but it's fragile.

**Fix:** Remove the client-side `complete_level` event entirely. Let the server game loop be the sole authority for detecting level completion. The server already checks portal collision on every tick.

---

### 6. Collectibles are server-authoritative but logic is shared awkwardly
[playerCollectibles.ts](file:///Users/kristianekman/jetpack/js/entities/player/playerCollectibles.ts) runs on the server via `checkCollectibles()` in the game loop. It calls `player.audio?.playEmeraldPickup?.()` and `player.tileMap.addSparkles(...)` — these are no-ops on the server but waste CPU cycles and make the code harder to reason about.

**Fix:** Split collectible detection (server) from presentation effects (client). The server should only emit `ITEM_COLLECTED` events; the client already handles visual/audio effects in [multiplayerController.ts:91-151](file:///Users/kristianekman/jetpack/js/network/multiplayerController.ts#L91-L151).

---

### 7. Snapshot buffer grows unbounded within a session
In [playerManager.ts:135-137](file:///Users/kristianekman/jetpack/js/entities/playerManager.ts#L135-L137), the buffer is capped at 30 entries but never pruned of stale entries older than the interpolation window. Over time, the linear scan in `update()` iterates through snapshots that can never be used.

**Fix:** After interpolation, discard snapshots older than `renderTime - someMargin`. This also reduces the per-player `Array.find()` cost in the interpolation loop.

---

### 8. Player lookup inside snapshot interpolation is O(n²)
In [playerManager.ts:236-237](file:///Users/kristianekman/jetpack/js/entities/playerManager.ts#L236-L237), for each player entity the code does `older.players.find(...)` and `newer.players.find(...)`. With 4 players this is negligible, but it's a structural smell.

**Fix:** Pre-index snapshots into a `Map<socketId, snapshot>` when they arrive, or use the tuple's array index since player order is stable within a room.

---

## 🟠 Reliability Gaps

### 9. No reconnection support for in-progress games
If a client disconnects during a match (network hiccup, tab backgrounded), the server runs `leaveRoom()` in the [disconnect handler](file:///Users/kristianekman/jetpack/server/index.ts#L512-L526) — the player is permanently removed. Socket.IO's built-in reconnection will create a new socket ID, and the player has no way to rejoin.

**Fix:** Implement a reconnection window (e.g., 30 seconds). On disconnect, mark the player as "disconnected" but keep them in the room. If a client reconnects with a reconnection token before the window expires, restore their player state.

---

### 10. No room cleanup / timeout
Rooms in `lobby` status with a single AFK player live forever. There's no TTL or idle timeout in [roomManager.ts](file:///Users/kristianekman/jetpack/server/roomManager.ts). The `createdAt` field exists but is never checked.

**Fix:** Add a periodic sweep (e.g., every 60s) that destroys rooms idle for more than N minutes.

---

### 11. Host migration during "playing" state doesn't handle game logic
When the host leaves during a match, [roomManager.ts:266-273](file:///Users/kristianekman/jetpack/server/roomManager.ts#L266-L273) reassigns `hostSocketId`, but the `next_level` and `start_match` handlers require `room.hostSocketId === socket.id`. The remaining players see "WAITING FOR HOST..." buttons that now work for the new host — but there's no notification or UI update telling the new host they now have control.

**Fix:** Emit a dedicated `host_changed` event so the client can update the UI immediately. The current code only sends `player_left` which updates the lobby UI but not the in-game level-complete/game-over dialogs.

---

## 🔵 Performance Opportunities

### 12. `setTimeout`-based game loop has drift
[gameLoop.ts:46](file:///Users/kristianekman/jetpack/server/gameLoop.ts#L46) uses `setTimeout` for the tick loop. While the accumulator pattern compensates for drift, `setTimeout` can be delayed by 10+ ms under Node.js event loop pressure, causing bursty catch-up ticks.

**Fix:** Consider using `setImmediate` with a high-resolution timer check, or the [`worker_threads`](https://nodejs.org/api/worker_threads.html) approach for a dedicated tick thread.

---

### 13. No delta compression on snapshots
Every snapshot in [gameLoop.ts:295-345](file:///Users/kristianekman/jetpack/server/gameLoop.ts#L295-L345) includes the full state for all players and all enemies, even if nothing changed. With 4 players and many enemies, this adds up.

**Fix:** For a game this size it's likely fine, but if bandwidth becomes an issue, consider sending only changed fields (delta snapshots) or compressing with a binary protocol like MessagePack.

---

## Summary Priority Matrix

| Priority | Issue | Effort |
|---|---|---|
| 🔴 High | #1 Client-trusted position | Medium — need server-side physics replay |
| 🔴 High | #2 No payload validation | Low — add zod schemas |
| 🔴 High | #4 Unverified enemy kills | Medium — add range + LoS check |
| 🟡 Medium | #5 Dual level-complete authority | Low — delete client event |
| 🟡 Medium | #9 No reconnection support | High — needs reconnection tokens |
| 🟡 Medium | #10 No room cleanup | Low — add periodic sweep |
| 🟡 Medium | #11 Host migration UI gap | Low — add event |
| 🟠 Low | #3 No rate limiting | Low — add per-event counters |
| 🟠 Low | #6 Shared collectible code | Medium — refactor |
| 🟠 Low | #12 setTimeout drift | Low-Medium |
| 🔵 Nice-to-have | #7, #8, #13 | Low each |
