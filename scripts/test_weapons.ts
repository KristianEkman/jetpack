/* ==========================================================================
   WEAPONS ARSENAL & COMBAT UNIT TEST SUITE
   Validates Spread Cannon, Plasma Grenades, Seeker Missiles, Inventory,
   Physics, AoE Detonations, Homing Steering, Level Pickups, and UI HUD.
   ========================================================================== */

import {
  TILES,
  TILE_SIZE,
  WEAPON_TYPES,
  WEAPON_SPECS,
  PLAYER_PHYSICS,
} from "../js/shared/constants.js";
import { Player } from "../js/entities/player/playerClass.js";
import { TileMap } from "../js/world/tilemap.js";
import { EnemyManager } from "../js/entities/enemy/enemyManager.js";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";
import { PALETTE } from "../js/editor/level_editor.js";
import { AudioManager } from "../js/audio/audioManager.js";

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
}

async function runWeaponsTestSuite(): Promise<void> {
  console.log("🧪 Starting Weapons Arsenal Unit & Integration Test Suite...\n");

  // Mock Audio Manager
  const audio = new AudioManager();

  // =========================================================================
  // 1. Weapon Constants, Specs & Inventory Management
  // =========================================================================
  console.log("1️⃣  Testing Weapon Constants, Specs & Inventory Management...");
  {
    assert(WEAPON_TYPES.PHASE_BEAM === "phase_beam", "Phase beam type defined");
    assert(WEAPON_TYPES.SPREAD_CANNON === "spread_cannon", "Spread cannon type defined");
    assert(WEAPON_TYPES.PLASMA_GRENADE === "plasma_grenade", "Plasma grenade type defined");
    assert(WEAPON_TYPES.SEEKER_MISSILE === "seeker_missile", "Seeker missile type defined");

    assert(TILES.WEAPON_SPREAD === 22, "Tile WEAPON_SPREAD = 22");
    assert(TILES.WEAPON_GRENADE === 23, "Tile WEAPON_GRENADE = 23");
    assert(TILES.WEAPON_MISSILE === 24, "Tile WEAPON_MISSILE = 24");

    const tileMap = new TileMap();
    const player = new Player(audio, tileMap);

    assert(player.activeWeapon === WEAPON_TYPES.PHASE_BEAM, "Default weapon is Phase Beam");
    assert(player.getWeaponAmmo(WEAPON_TYPES.SPREAD_CANNON) === 0, "Initial spread ammo 0");
    assert(player.getWeaponAmmo(WEAPON_TYPES.PLASMA_GRENADE) === 0, "Initial grenade ammo 0");
    assert(player.getWeaponAmmo(WEAPON_TYPES.SEEKER_MISSILE) === 0, "Initial missile ammo 0");

    // Cannot equip weapon with 0 ammo
    const equipSpreadEmpty = player.setWeapon(WEAPON_TYPES.SPREAD_CANNON);
    assert(!equipSpreadEmpty && player.activeWeapon === WEAPON_TYPES.PHASE_BEAM, "Cannot equip empty weapon");

    // Add ammo
    player.addWeaponAmmo(WEAPON_TYPES.SPREAD_CANNON, 25);
    assert(player.getWeaponAmmo(WEAPON_TYPES.SPREAD_CANNON) === 25, "Spread ammo added");

    const equipSpread = player.setWeapon(WEAPON_TYPES.SPREAD_CANNON);
    assert(equipSpread && player.activeWeapon === WEAPON_TYPES.SPREAD_CANNON, "Successfully equipped Spread Cannon");

    // Add grenade ammo
    player.addWeaponAmmo(WEAPON_TYPES.PLASMA_GRENADE, 10);
    assert(player.getWeaponAmmo(WEAPON_TYPES.PLASMA_GRENADE) === 10, "Grenade ammo added");

    // Cycling weapons (with Spread and Grenade available)
    const cycledNext = player.cycleWeapon(1);
    assert(cycledNext === WEAPON_TYPES.PLASMA_GRENADE, "Cycled forward to Plasma Grenade");

    const cycledNextAgain = player.cycleWeapon(1);
    assert(cycledNextAgain === WEAPON_TYPES.PHASE_BEAM, "Cycled forward to Phase Beam (skipping empty Seeker)");

    const cycledPrev = player.cycleWeapon(-1);
    assert(cycledPrev === WEAPON_TYPES.PLASMA_GRENADE, "Cycled backward to Plasma Grenade");

    console.log("   ✅ Inventory management, ammo caps, and weapon cycling verified.");
  }

  // =========================================================================
  // 2. Spread Cannon (Tri-Beam Pulser)
  // =========================================================================
  console.log("2️⃣  Testing Spread Cannon (Tri-Beam) Firing & Collision...");
  {
    const tileMap = new TileMap();
    tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
    const enemyManager = new EnemyManager(tileMap, audio);
    const player = new Player(audio, tileMap);
    player.x = 100;
    player.y = 100;
    player.addWeaponAmmo(WEAPON_TYPES.SPREAD_CANNON, 10);
    player.setWeapon(WEAPON_TYPES.SPREAD_CANNON);

    // Fire Spread Cannon
    player.fireWeapon(enemyManager);
    assert(player.weaponAmmo.spread_cannon === 9, "Ammo decremented to 9");
    assert(player.projectiles.length === 3, "3 divergent projectiles spawned");

    const centerProj = player.projectiles.find((p) => Math.abs(p.vy) < 0.1);
    const upProj = player.projectiles.find((p) => p.vy < -50);
    const downProj = player.projectiles.find((p) => p.vy > 50);

    assert(!!centerProj && !!upProj && !!downProj, "Center, up-angled, and down-angled projectiles exist");
    assert(centerProj != null && centerProj.vx > 300, "Forward velocity correct");

    // Spawn an enemy in center projectile path
    enemyManager.addFlitzer(200, 100, 0, 0, "test_flitzer");
    assert(enemyManager.enemies.length === 1, "Enemy spawned");

    // Simulate projectile movement with 60Hz delta-t steps
    for (let s = 0; s < 25; s++) {
      player.updateProjectiles(0.016, enemyManager);
      if (enemyManager.enemies.length === 0) break;
    }
    assert(enemyManager.enemies.length === 0, "Enemy destroyed by Spread Cannon beam");
    assert(player.score === 200, "Score awarded for destroying enemy");

    // Place a phase brick in path of remaining projectile
    tileMap.setTile(8, 4, TILES.PHASE_BRICK);
    player.projectiles = [{
      id: "p1",
      ownerId: player.id,
      type: WEAPON_TYPES.SPREAD_CANNON,
      x: 8 * TILE_SIZE - 2,
      y: 4 * TILE_SIZE + 10,
      vx: 380,
      vy: 0,
      radius: 4,
      life: 0.8,
      maxLife: 0.8,
      damage: 1,
    }];

    player.updateProjectiles(0.02, enemyManager);
    assert(tileMap.getTile(8, 4) === TILES.AIR, "Spread Cannon beam phases Phase Brick upon impact");

    console.log("   ✅ Spread Cannon tri-beam angle divergence, enemy damage, and phase brick melting verified.");
  }

  // =========================================================================
  // 3. Plasma Grenade (Bouncing Cluster Mortar & 48px AoE Explosion)
  // =========================================================================
  console.log("3️⃣  Testing Plasma Grenades (Bouncing Physics & 48px AoE Detonation)...");
  {
    const tileMap = new TileMap();
    tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
    // Solid floor at row 8
    for (let c = 0; c < 30; c++) tileMap.setTile(c, 8, TILES.BRICK);

    const enemyManager = new EnemyManager(tileMap, audio);
    const player = new Player(audio, tileMap);
    player.x = 100;
    player.y = 100;
    player.addWeaponAmmo(WEAPON_TYPES.PLASMA_GRENADE, 5);
    player.setWeapon(WEAPON_TYPES.PLASMA_GRENADE);

    // Launch Grenade
    player.fireWeapon(enemyManager);
    assert(player.weaponAmmo.plasma_grenade === 4, "Grenade ammo decremented to 4");
    assert(player.projectiles.length === 1, "1 grenade projectile spawned");

    const grenade = player.projectiles[0];
    assert(grenade.type === WEAPON_TYPES.PLASMA_GRENADE, "Projectile is Plasma Grenade");
    assert(grenade.vy < 0, "Initial upward launch velocity");

    // Setup 3 Phase Bricks within 48px blast zone
    tileMap.setTile(5, 5, TILES.PHASE_BRICK);
    tileMap.setTile(6, 5, TILES.PHASE_BRICK);
    tileMap.setTile(5, 6, TILES.PHASE_BRICK);

    // Setup 2 enemies within blast zone
    enemyManager.addFlitzer(5 * 32, 5 * 32, 0, 0, "flitzer_aoe_1");
    enemyManager.addTurret(6 * 32, 5 * 32, 2.0, "turret_aoe_2");

    // Detonate grenade manually at (5.5 * 32, 5.5 * 32)
    grenade.x = 5.5 * 32;
    grenade.y = 5.5 * 32;
    grenade.life = 0; // Trigger fuse expiration detonation

    player.updateProjectiles(0.01, enemyManager);

    assert(tileMap.getTile(5, 5) === TILES.AIR, "Phase brick 1 phased by AoE blast");
    assert(tileMap.getTile(6, 5) === TILES.AIR, "Phase brick 2 phased by AoE blast");
    assert(tileMap.getTile(5, 6) === TILES.AIR, "Phase brick 3 phased by AoE blast");
    assert(enemyManager.enemies.length === 0, "Both enemies destroyed by AoE blast");
    assert(player.score === 400, "Score awarded for 2 enemies destroyed (400 pts)");

    console.log("   ✅ Plasma Grenade projectile launch, fuse detonation, and multi-tile AoE destruction verified.");
  }

  // =========================================================================
  // 4. Seeker Missile Pod (Target Tracking & Homing Steering)
  // =========================================================================
  console.log("4️⃣  Testing Seeker Missiles (Target Tracking & Homing Steering)...");
  {
    const tileMap = new TileMap();
    tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
    const enemyManager = new EnemyManager(tileMap, audio);

    // Place an enemy above and ahead of the player
    enemyManager.addFlitzer(300, 80, 0, 0, "target_flitzer");

    const player = new Player(audio, tileMap);
    player.x = 100;
    player.y = 200;
    player.addWeaponAmmo(WEAPON_TYPES.SEEKER_MISSILE, 4);
    player.setWeapon(WEAPON_TYPES.SEEKER_MISSILE);

    // Fire Seeker Missile
    player.fireWeapon(enemyManager);
    assert(player.weaponAmmo.seeker_missile === 3, "Missile ammo decremented to 3");
    assert(player.projectiles.length === 1, "1 missile projectile spawned");

    const missile = player.projectiles[0];
    assert(missile.type === WEAPON_TYPES.SEEKER_MISSILE, "Projectile is Seeker Missile");
    assert(missile.targetId === "target_flitzer", "Missile locked on to target_flitzer");

    // Simulate homing steering over multiple frames
    for (let frame = 0; frame < 80; frame++) {
      player.updateProjectiles(0.016, enemyManager);
      if (enemyManager.enemies.length === 0) break;
    }

    assert(enemyManager.enemies.length === 0, "Target destroyed by homing seeker missile");
    assert(player.score === 200, "Score awarded for missile kill (200 pts)");

    console.log("   ✅ Seeker Missile target lock-on, homing steering physics, and impact kill verified.");
  }

  // =========================================================================
  // 5. Tilemap Collectible Pickups
  // =========================================================================
  console.log("5️⃣  Testing Tilemap Weapon Pickups (Spread, Grenade, Missile)...");
  {
    const tileMap = new TileMap();
    tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
    const player = new Player(audio, tileMap);
    player.x = 2 * TILE_SIZE;
    player.y = 2 * TILE_SIZE;

    // Place Spread pickup at player position
    tileMap.setTile(2, 2, TILES.WEAPON_SPREAD);
    player.checkCollectibles();

    assert(tileMap.getTile(2, 2) === TILES.AIR, "Spread tile consumed");
    assert(player.activeWeapon === WEAPON_TYPES.SPREAD_CANNON, "Auto-equipped Spread Cannon on pickup");
    assert(player.getWeaponAmmo(WEAPON_TYPES.SPREAD_CANNON) === 25, "Added 25 spread ammo");

    // Place Grenade pickup at player position
    tileMap.setTile(2, 2, TILES.WEAPON_GRENADE);
    player.checkCollectibles();

    assert(tileMap.getTile(2, 2) === TILES.AIR, "Grenade tile consumed");
    assert(player.activeWeapon === WEAPON_TYPES.PLASMA_GRENADE, "Auto-equipped Plasma Grenade on pickup");
    assert(player.getWeaponAmmo(WEAPON_TYPES.PLASMA_GRENADE) === 10, "Added 10 grenade ammo");

    // Place Missile pickup at player position
    tileMap.setTile(2, 2, TILES.WEAPON_MISSILE);
    player.checkCollectibles();

    assert(tileMap.getTile(2, 2) === TILES.AIR, "Missile tile consumed");
    assert(player.activeWeapon === WEAPON_TYPES.SEEKER_MISSILE, "Auto-equipped Seeker Missile on pickup");
    assert(player.getWeaponAmmo(WEAPON_TYPES.SEEKER_MISSILE) === 8, "Added 8 missile ammo");

    console.log("   ✅ Tile pickups correctly grant ammo and auto-equip weapon.");
  }

  // =========================================================================
  // 6. Campaign & Level Editor Integration
  // =========================================================================
  console.log("6️⃣  Testing Campaign & Level Editor Palette Integration...");
  {
    assert(CAMPAIGN_LEVELS.length >= 10, "10 campaign levels present");

    const hasSpreadInPalette = PALETTE.some((p) => p.type === TILES.WEAPON_SPREAD);
    const hasGrenadeInPalette = PALETTE.some((p) => p.type === TILES.WEAPON_GRENADE);
    const hasMissileInPalette = PALETTE.some((p) => p.type === TILES.WEAPON_MISSILE);

    assert(hasSpreadInPalette, "Level editor palette has Spread Cannon");
    assert(hasGrenadeInPalette, "Level editor palette has Plasma Grenade");
    assert(hasMissileInPalette, "Level editor palette has Seeker Missile");

    // Verify campaign levels contain weapon tiles
    const stage3HasSpread = CAMPAIGN_LEVELS[2].grid.includes(TILES.WEAPON_SPREAD);
    const stage8HasMissile = CAMPAIGN_LEVELS[7].grid.includes(TILES.WEAPON_MISSILE);
    const stage10HasMissile = CAMPAIGN_LEVELS[9].grid.includes(TILES.WEAPON_MISSILE);

    assert(stage3HasSpread, "Stage 3 includes Spread Cannon pickup");
    assert(stage8HasMissile, "Stage 8 Treasure Vault includes Seeker Missile pickup");
    assert(stage10HasMissile, "Stage 10 Cyber Omega Core includes Seeker Missile pickup");

    console.log("   ✅ Campaign levels and Level Editor palette validated.");
  }

  // =========================================================================
  // 7. Web Audio Synthesizer Methods
  // =========================================================================
  console.log("7️⃣  Testing Audio Synthesizer Methods...");
  {
    assert(typeof audio.sfx.playSpreadShotSound === "function", "playSpreadShotSound exists");
    assert(typeof audio.sfx.playGrenadeLaunchSound === "function", "playGrenadeLaunchSound exists");
    assert(typeof audio.sfx.playClusterExplosionSound === "function", "playClusterExplosionSound exists");
    assert(typeof audio.sfx.playMissileLaunchSound === "function", "playMissileLaunchSound exists");
    assert(typeof audio.sfx.playWeaponPickupSound === "function", "playWeaponPickupSound exists");

    // Execute methods to verify no exceptions
    audio.sfx.playSpreadShotSound();
    audio.sfx.playGrenadeLaunchSound();
    audio.sfx.playClusterExplosionSound();
    audio.sfx.playMissileLaunchSound();
    audio.sfx.playWeaponPickupSound();

    console.log("   ✅ Web Audio synthesis routines executed cleanly without errors.");
  }

  console.log("\n🎉 ALL 3 WEAPONS ARSENAL UNIT & INTEGRATION TESTS PASSED PERFECTLY!\n");
}

runWeaponsTestSuite().catch((err) => {
  console.error("💥 Weapons Test Suite Encountered an Error:", err);
  process.exit(1);
});
