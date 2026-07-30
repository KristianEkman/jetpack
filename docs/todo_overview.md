# Browser-Based Jetpack Game: TODO & Implementation Overview

This document outlines the architecture, tech stack selection, core features, and step-by-step implementation plan to build a high-performance, retro-inspired browser game based on the classic **Jetpack** (1993 MS-DOS) and **Jetpac** (1983) mechanics.

---

## 1. Technology Stack Selection

### Selected Stack: **HTML5 `<canvas>` + Vanilla JavaScript (ES6 Modules) + Web Audio API + CSS3 Glassmorphism UI**

| Layer | Selected Tech | Rationale |
| :--- | :--- | :--- |
| **Rendering Engine** | **HTML5 Canvas 2D Context** | Ideal for 2D pixel-art tilemaps, custom sprite rendering, retro CRT effects, and custom particle systems with minimal overhead and 60 FPS performance. |
| **Logic & Structure** | **Vanilla JS (ES6 Modules)** | Zero build lock-in, zero runtime overhead, instant browser execution, clear OOP/Component architecture (`Game`, `Player`, `TileMap`, `Editor`, `Physics`, `Audio`). |
| **Styling & UI Shell** | **Vanilla CSS3** | Custom retro-neon & glassmorphism aesthetic for HUD, menus, modal dialogs, and level editor toolbars. Modern flexbox/grid layout around the game canvas. |
| **Audio Engine** | **Web Audio API** | Real-time procedural retro sound synthesis (laser fire, jetpack thrust noise, emerald pick-up chimes, explosions) without requiring external audio asset files. |
| **Storage & Persistence** | **Browser `localStorage` + JSON Import/Export** | Allows instant saving/loading of custom levels created in the Level Editor and high scores without backend server requirements. |

---

## 2. Selected Game Scope & Core Mechanics

The web app will focus on the legendary **MS-DOS Jetpack (1993)** gameplay loop, enhanced with modern visual effects and responsive controls:

* **Primary Objective:** Collect all green emeralds in a level to unlock the Exit Portal, then fly into the portal to complete the level.
* **Flight & Fuel System:** Free 2D jetpack thrust with realistic gravity and momentum. Thrust depletes fuel; fuel can be refueled at fuel stations or by picking up fuel canisters.
* **Phase Shifter Tool:** Player can aim and disintegrate phaseable brick blocks, creating temporary paths through walls (with timed block regeneration).
* **Interactive Elements:** Ladders, vines, slippery ice platforms, conveyor belts, teleporters, spikes, and energy drain fields.
* **Enemies & Obstacles:** Flitzers (patrol enemies), Homing Missiles, and Turrets.
* **Built-in Visual Level Editor:** Interactive tile-placement map editor allowing players to design, playtest, export, and import custom levels.

---

## 3. Implementation Todo List

### Phase 1: Engine Foundation & Project Structure
- [x] Create `index.html` structure with `<canvas>` container, HUD overlay, and retro navigation menus.
- [x] Create `index.css` design system (CRT filter toggle, retro typography, glassmorphism modal dialogs, neon accent color palette).
- [x] Build core `GameLoop` module (requestAnimationFrame, delta-time calculation, FPS counter, pause/resume state machine).
- [x] Build `InputHandler` module (Keyboard mapping for WASD/Arrows + Space/Z for Phase Shifter, gamepad support ready).
- [x] Build `AudioManager` using Web Audio API procedural sound generators for thrust, laser, gem pickup, and explosions.

### Phase 2: Player Controller & Physics Engine
- [x] Implement `Player` entity with state management (Idle, Running, Climbing, Flying, Phasing, Dead).
- [x] Implement 2D physics engine: gravity, acceleration, velocity cap, ladder snap, and pixel-accurate tile collision detection (AABB).
- [x] Implement Jetpack Thrust mechanics with fuel consumption and thrust particle system.
- [x] Implement Phase Shifter raycast / block targeting to disintegrate phaseable tiles with timer-based block restoration.

### Phase 3: Tilemap System & Level Elements
- [x] Implement `TileMap` renderer supporting grid layers (Background, Collision, Collectibles, Interactive Elements).
- [x] Implement custom tile behaviors:
  - Phaseable Bricks (destructible/respawning)
  - Ice Blocks (reduced friction / sliding)
  - Conveyor Belts (directional player displacement)
  - Teleporters (linked warp nodes with instant player position transfer, audio, particle VFX, and debounce cooldown)
  - Ladders & Vines (climbing physics override)
- [x] Implement Collectible items (Green Emeralds, Gold Coins, Fuel Canisters) with floating chimes and score integration.
- [x] Implement Level Exit Portal with state lock (closed until all emeralds are collected).

### Phase 4: Enemy AI & Environmental Hazards
- [x] Implement `Enemy` base class and entity manager.
- [x] Implement **Flitzer** AI (bouncing patrol movement along walls/grids).
- [x] Implement **Homing Rocket** AI (tracking player position with turning velocity).
- [x] Implement **Turret** AI (periodic projectile launcher).
- [x] Implement hazards: Spikes (instant kill) and Energy Drain zones (rapid fuel depletion).

### Phase 5: Built-in Level Editor
- [x] Implement UI toolbar for selecting tile categories (Blocks, Items, Enemies, Spawn Point, Exit).
- [x] Implement grid canvas hover preview and click/drag paint & erase tools.
- [x] Implement map validation check (ensuring 1 player spawn, 1 exit portal, and at least 1 emerald).
- [x] Implement Instant Playtest / Return to Editor toggle mode.
- [x] Implement Save to `localStorage`, JSON Export file download, and JSON Import file upload.

### Phase 6: Premade Levels, Menu System & Polish
- [x] Design 5 classic built-in campaign levels with increasing difficulty.
- [x] Build Main Menu, Level Select screen, High Score board, and Controls settings modal.
- [x] Add retro aesthetic polish:
  - Jetpack thrust fire particles & smoke.
  - Phase Shifter beam effect with disintegration sparkles.
  - Optional retro CRT scanline overlay filter.
- [x] Ensure full keyboard & mobile touch overlay compatibility.

### Phase 7: Verification & Testing
- [x] Verify physics at 30, 60, and 120 FPS screens (delta-time independent movement).
- [x] Verify collision edge cases (corner catching, phase block re-solidifying while player is inside).
- [x] Verify Level Editor export/import fidelity.
- [x] Audit performance, memory usage, and Web Audio lifecycle on page hide/show.

---

## 4. Next Steps
Upon review and approval of this plan, execution can begin immediately starting with **Phase 1: Engine Foundation & Project Structure**.
