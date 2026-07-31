# Multiplayer Architecture & Implementation TODO

This document details the architectural requirements, network model, refactoring steps, and implementation roadmap to turn **Jetpack** into a real-time online multiplayer game.

---

## 1. Architecture Overview: Authoritative Client-Server

For an action-platformer with physics, phase-able terrain, and shared collectibles, an **Authoritative Server Model** (using **Node.js** with **WebSockets**) is the recommended pattern.

```
       +--------------------------------------------------+
       |             Node.js Backend Server               |
       |  - Authoritative Game Loop & Physics             |
       |  - Tilemap State (Phase Bricks, Emeralds)        |
       |  - Enemy AI & Collision Logic                    |
       |  - Room/Lobby Management                         |
       +------------------------+-------------------------+
                                |  (WebSocket / WebRTC)
             +------------------+------------------+
             |                                     |
    +--------v-------+                    +--------v-------+
    | Client Player 1|                    | Client Player 2|
    | - Sends Inputs |                    | - Sends Inputs |
    | - Renders State|                    | - Renders State|
    | - Prediction   |                    | - Prediction   |
    +----------------+                    +----------------+
```

### Core Benefits
* **State Synchronization:** Prevents desynchronization when players disintegrate phase bricks or collect items simultaneously.
* **Deterministic Enemies:** Handles enemy movement deterministically across all players.
* **Anti-Cheat:** Prevents client-side tampering or invalid player coordinates.

---

## 2. Technical Requirements Checklist

### Real-Time Networking Layer
- [ ] Choose protocol (`Socket.IO` or `ws` for WebSockets in Node.js; optional WebRTC DataChannels for UDP-like latency).
- [ ] Define network message protocol:
  - [ ] `PLAYER_JOIN` / `PLAYER_LEAVE` / `ROOM_READY`
  - [ ] `INPUT_DELTA` (Client → Server: input presses/releases with tick sequence number)
  - [ ] `WORLD_SNAPSHOT` (Server → Client: positions, velocities, fuel levels, phase brick timers, remaining emeralds)
  - [ ] `EVENT_TRIGGER` (Server → Client: brick phased, emerald collected, player respawned, sound effect trigger)

### Client-Side Engineering & Sync Mechanisms
- [ ] **Multi-Player Entity Management:** Refactor `Player` into a `PlayerManager` capable of instantiating and rendering local vs. remote players (distinct colors, names, individual HUD meters).
- [ ] **Client-Side Prediction & Reconciliation:** Local player runs physics immediately on keypress; server reconciliation compares acknowledged server position with predicted position.
- [ ] **Entity Interpolation:** Smoothly interpolate (lerp) positions of remote players and enemies between network snapshots.
- [ ] **Shared Logic Extraction:** Extract collision detection (`tilemap.js`) and physics parameters (`player.js`) into shared ES modules readable by both browser and Node.js.

### World & Mechanics Synchronization
- [ ] **Phaseable Bricks:** Server tracks phase brick disintegration timers and regeneration intervals, broadcasting tile updates.
- [ ] **Collectibles & Scoring:** Server validates emerald and fuel canister pick-ups to prevent double-collection.
- [ ] **Enemy AI Authority:** Server runs `EnemyManager` updates and broadcasts enemy positions/states.

### Lobby & Room System
- [ ] **Room Creation / Join Code:** Private rooms (e.g. 4-letter room code `JTPK`) or public lobbies.
- [ ] **Custom Level Editor Integration:** Host uploads custom level maps built in the Level Editor to room peers.
- [ ] **Player Customization & Ready System:** Color picking (Red, Blue, Green, Yellow), player names, and ready toggle.

---

## 3. Codebase Changes & File Refactoring Map

| File / Component | Required Changes |
| :--- | :--- |
| **`js/engine/input.js`** | Decouple direct player mutation from input events; convert inputs into serialized input state payloads (`{ left, right, thrust, phase, sequenceId }`). |
| **`js/entities/player.js`** | Separate physics simulation from rendering/audio. Support multiple player instances with custom IDs, colors, and remote state overrides. |
| **`js/world/tilemap.js`** | Make tile map updates event-driven (`phaseTile(x, y)`, `restoreTile(x, y)`) so changes can be dispatched and received over sockets. |
| **`js/game.js`** | Abstract local game loop into Network Game Manager updating based on server ticks instead of local-only state transitions. |
| **`js/editor/level_editor.js`** | Add JSON map exporter/importer interface to payload custom maps to room peers. |
| **`server/` (New Backend)** | Build Node.js server (`Express` + `Socket.IO`) executing server-side loop, room management, and snapshot broadcasting. |

---

## 4. Game Modes

1. **Co-Op Campaign (2–4 Players):** Shared lives pool or individual respawns; collect all emeralds to unlock exit portal.
2. **Emerald Race / Versus Mode:** Competitive race to gather the most emeralds. Phase bricks can trap opponents strategically.
3. **Survival / Last Jetpack Standing:** Endless enemy spawns with limited fuel; last player surviving wins.

---

## 5. Phased Implementation Roadmap

- [x] **Phase 1: Shared Core Modules**  
  Reorganize code so tile collision and physics constants can be imported by Node.js.
- [x] **Phase 2: Node.js Backend Server Setup**  
  Setup Express server with `Socket.IO`, basic connection handshake, room creation, and tick loop (30 or 60 Hz).
- [ ] **Phase 3: Multiplayer Entity System & Input Sync**  
  Connect clients to room; send inputs to server; receive state updates; render multiple jetpack players on screen.
- [ ] **Phase 4: Client-Side Prediction & Interpolation**  
  Implement local movement prediction and remote entity smoothing to ensure fluid gameplay under network latency.
- [ ] **Phase 5: World State Sync & Custom Map Sharing**  
  Sync phase bricks, emerald pickups, exit portal triggers, and Level Editor map uploading.
- [ ] **Phase 6: UI, Lobby, & Polishing**  
  Add room creation UI, scoreboard, audio triggers for net events, and color selection.
