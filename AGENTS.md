# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

**Jetpack** (`jetpack-multiplayer` v1.0.0) is a retro 1993-inspired arcade action puzzle-platformer with real-time multiplayer. It is a browser game built with HTML5 Canvas, vanilla TypeScript, and Web Audio, plus a Node.js authoritative game server. Players collect emeralds, manage jetpack fuel, phase through walls, avoid hazards/enemies, and can build and share custom levels. Multiplayer supports CO-OP and COMPETE (last-pilot-standing) rooms of up to 4 players.

## Technology Stack

- **Client:** TypeScript (ES2022, strict), Vite 8, HTML5 Canvas 2D, Web Audio API, native ES modules. No frontend framework — DOM is manipulated directly against `index.html`.
- **Server:** Node.js (>=18), Express 5, Socket.IO 4 (websocket + polling transports), `tsx` for running TypeScript directly (no server build step).
- **Persistence:** Firebase Realtime Database via `firebase-admin` (user accounts, custom levels, high scores, ratings).
- **Language config:** ES modules throughout (`"type": "module"`); TypeScript is type-checked but never emitted (`noEmit: true`); `allowJs: true`, `checkJs: false`.
- Shared game code under `js/` is imported by **both** the browser client and the Node server — this is intentional. Imports use `.js` extensions in TypeScript source (bundler module resolution).

## Build, Run, and Test Commands

- `npm run dev` — Vite dev server on port 5173, proxying `/socket.io` to the backend on port 3000.
- `npm start` — run the multiplayer server directly with tsx (`server/index.ts`, port from `PORT` env or 3000). For local dev, run this alongside `npm run dev`.
- `npm run typecheck` — `tsc --noEmit` over `js/`, `server/`, `scripts/`.
- `npm run build` — generates `version.json` (prebuild), type-checks, then Vite-builds into `dist/`. In production the Express server serves `dist/` statically, so a single process serves both HTTP and WebSocket traffic.
- `npm test` — runs the full test suite (see Testing below).
- `npm run test:coverage` — c8 coverage over `js/**/*.ts` and `server/**/*.ts` (config in `.c8rc.json`, reports in `coverage/`).
- `npm run deploy` — builds and deploys to Azure App Service with `az webapp up` (resource group `jetpack-rg`, webapp `jetpack`, see `.azure/config`). `.azignore` excludes `node_modules`, `.git`, `.github`, logs.

## Code Organization

The client entry point is `index.html` → `js/game.ts` (the `Game` master controller, which wires up all sub-managers and owns the `GAME_STATES` state machine: `menu`, `playing`, `paused`, `level_editor`, `game_over`, `level_complete`, `campaign_complete`, `spectating`).

- `js/shared/` — **isomorphic code used by client AND server**: `constants.ts` (tile types, physics, `GAME_EVENTS`/`ROOM_EVENTS` socket event names, `NETWORK_SETTINGS`), `payloads.ts` (socket/REST payload interfaces), `types.ts`, `collision.ts`. Keep this directory free of DOM and Node-specific APIs.
- `js/engine/` — client game loop (`loop.ts`), keyboard/touch input (`input.ts`).
- `js/world/` — tile map model, rendering, and effects (`tilemap.ts` facade + `tilemap/` internals).
- `js/entities/` — `Player` (facade `player.ts` + `player/` split: physics, combat, collectibles, effects, renderer, stuck-detection), `EnemyManager` and enemy types (`enemy/`: flitzer, homingMissile, turret, boss), `playerManager.ts` (remote-player rendering/interpolation).
- `js/levels/` — campaign level data (`campaign.ts`) and level loading/progression (`levelManager.ts`).
- `js/network/` — `networkManager.ts` (Socket.IO client: connect, rooms, inputs, snapshots), `multiplayerController.ts` (client-side multiplayer orchestration), `userService.ts`.
- `js/audio/` — Web Audio music sequencer (`sequencer.ts`, `notes.ts`, `patterns.ts`) and SFX (`sfx.ts`), behind `audioManager.ts`.
- `js/editor/` — in-browser level editor (`level_editor.ts`).
- `js/ui/` — DOM/HUD managers (`uiManager.ts`), user auth modal, server-health telemetry modal, error monitor.
- `js/types/` — ambient declarations (`env.d.ts` for the Vite-injected `__GIT_COMMIT_HASH__` / `__BUILD_DATE_TIME__` globals).
- `server/` — backend, all tsx-run TypeScript:
  - `index.ts` — Express app + Socket.IO event handlers + REST APIs (users, custom levels, `/health`, `/api/version`). Exported (`app`, `httpServer`, `io`, `roomManager`, `gameLoop`) for integration tests; the listener only starts when the file is run directly.
  - `roomManager.ts` — room lifecycle (`ServerRoom`: lobby/playing/finished, host migration, player configs).
  - `gameLoop.ts` — **authoritative server simulation at 60 Hz**; broadcasts world snapshots every 3 ticks (20 Hz, see `NETWORK_SETTINGS.SNAPSHOT_INTERVAL_TICKS`).
  - `userModule.ts` — user registration/login backed by Firebase.
  - `levelModule.ts` — custom-level CRUD, ratings, high scores backed by Firebase.
  - `firebase.ts` — Firebase Admin init.
- `scripts/` — all test scripts (see Testing) plus `generate_version.ts`.
- `styles/` — CSS split by concern (base, hud, lobby, dialogs, editor, viewport, health), all bundled through `index.css`.
- `docs/` — design notes: `game_description.md`, `networking_summary.md`, `networking_improvements.md`, `todo.md` (working task list).

### Runtime architecture (multiplayer)

The server is authoritative. Clients send serialized input states (`GAME_EVENTS.PLAYER_INPUT`, sequenced, heartbeat at 50 ms when unchanged); the server consumes them in its 60 Hz `GameLoop`, simulates player physics, and emits `WORLD_SNAPSHOT` payloads at 20 Hz. Clients run prediction/replay and render remote players with interpolation/dead-reckoning. Room management (create/join/leave, host-only start/level change, host migration on disconnect) goes through Socket.IO events defined in `js/shared/constants.ts`. See `docs/networking_summary.md` for the full protocol description.

## Code Style Guidelines

- TypeScript strict mode; ESM only. Use `.js` extensions in relative imports (`import { X } from "./foo.js"`).
- Codebase conventions: `PascalCase` classes with typed public fields, `UPPER_SNAKE_CASE` constants, descriptive camelCase methods. Files typically start with a banner comment block (`/* ====...==== */`).
- The `js/` tree must stay runnable in both browser and Node (via tsx) where it already is — never import DOM-only or Node-only APIs from `js/shared/`, `js/entities/`, `js/world/`, or `js/levels/` without checking how server code uses them.
- Emoji are used deliberately in console logs and UI strings (🚀, 🏠, ✅, etc.) — match the surrounding style.
- ESLint config (`eslint.config.js`) is minimal: `no-unused-vars` (warn, `_`-prefixed ignored), `no-unreachable` (error), `no-constant-condition` (warn). There is no `lint` npm script; run `npx eslint .` if needed.
- Prefer minimal, scoped changes. Many `js/` modules are consumed by the server; a "client-only" refactor can silently break the server simulation and its tests.

## Testing Instructions

- Tests are **plain tsx scripts in `scripts/`** using `node:assert/strict` — no Jest/Vitest framework. Each script prints numbered, emoji-tagged sections and exits non-zero on failure; scripts that start the server listen on dedicated high ports (e.g. 3099) and clean up before exit.
- `npm test` runs the full chained suite (shared-core module checks, server/socket integration, gameplay regressions: boss, extra life, compete mode, spawn safety, respawn sync, network manager, weapons, HUD/touch, audio toggles, levels 8–10, custom-levels API, game-loop optimization, and more). Individual scripts have their own `test:*` npm aliases.
- When fixing a bug or adding behavior, add or extend a `scripts/test_*.ts` script and register it in both the `test` chain and as a `test:<name>` alias in `package.json` (some existing scripts like `test_level7.ts` and `test_enemy_wall_hit.ts` are not in the chain — follow the registered pattern).
- Coverage: `npm run test:coverage` (c8, configured in `.c8rc.json`; `js/types/` and `scripts/` are excluded).
- Tests that touch Firebase-backed modules use mocks or the real database depending on the script — check the script header before assuming isolation.

## Security Considerations

- **Firebase credentials:** `server/firebase.ts` loads the service account from (1) the `FIREBASE_SERVICE_ACCOUNT_JSON` env var (used on Azure), or (2) a key file at `FIREBASE_SERVICE_ACCOUNT_PATH`, defaulting to `server/jetpack-a9e21-firebase-adminsdk-fbsvc-*.json`. That default key file is listed in `.gitignore` — do not commit credentials, and prefer the env var in any new environment.
- **Auth is intentionally lightweight:** user IDs are accepted from a `Bearer` header, `x-user-id` header, or request body (`getAuthUserId` in `server/index.ts`) with no signed tokens; passwords are stored/compared by `userModule.ts`. Treat this as game-grade auth, not hardened security, and don't build sensitive features on top of it without redesign.
- Socket.IO CORS is `origin: "*"`; the `/health` endpoint exposes memory and room telemetry by design (it backs the in-game Server Health modal).
- Never commit generated artifacts: `dist/`, `version.json`, `coverage/` are all gitignored.

## Versioning & Deployment Notes

- Build-time version info (git short hash + UTC deploy timestamp) is injected two ways: Vite `define` globals for the client and `version.json` (written to repo root and `dist/`) for the server's `/api/version` and `/health` endpoints. The HUD badge and Server Health modal display these.
- Deployment target is a single Azure App Service (`jetpack`, Linux, B1, northcentralus) running `npm start`; the server serves the built `dist/` and handles WebSockets on the same port. The `PORT` env var must be honored (Azure sets it).
