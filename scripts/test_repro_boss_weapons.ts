import { TILES, WEAPON_TYPES } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy/index.js";
import { Player } from "../js/entities/player.js";

function makeWorld() {
  const tileMap = new TileMap();
  tileMap.cols = 30;
  tileMap.rows = 18;
  tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
  const enemyManager = new EnemyManager(tileMap);
  const player = new Player(null, tileMap);
  return { tileMap, enemyManager, player };
}

// --- Phase Beam vs Boss ---
{
  const { enemyManager, player } = makeWorld();
  enemyManager.addBoss(200, 100, 10, "boss1");
  const boss = enemyManager.enemies[0];
  // Place player left of boss, same height so beam (y = player.y + 12) crosses boss box
  player.x = 100;
  player.y = boss.y + 20; // beam y = boss.y + 32, inside boss (y..y+64)
  player.facingRight = true;
  player.activeWeapon = WEAPON_TYPES.PHASE_BEAM;
  player.fireWeapon(enemyManager);
  console.log("phase beam: boss hp =", boss.hp, "(expected 9)");
}

// --- Spread Cannon vs Boss ---
{
  const { enemyManager, player } = makeWorld();
  enemyManager.addBoss(300, 100, 10, "boss2");
  const boss = enemyManager.enemies[0];
  player.x = 200;
  player.y = boss.y + 20;
  player.facingRight = true;
  player.activeWeapon = WEAPON_TYPES.SPREAD_CANNON;
  player.weaponAmmo[WEAPON_TYPES.SPREAD_CANNON] = 10;
  player.fireWeapon(enemyManager);
  for (let i = 0; i < 60; i++) {
    player.updateProjectiles(1 / 60, enemyManager);
  }
  console.log("spread: boss hp =", boss.hp, "(expected < 10)");
}

// --- Plasma Grenade vs Boss ---
{
  const { enemyManager, player } = makeWorld();
  enemyManager.addBoss(300, 300, 10, "boss3");
  const boss = enemyManager.enemies[0];
  player.x = 250;
  player.y = 300;
  player.facingRight = true;
  player.activeWeapon = WEAPON_TYPES.PLASMA_GRENADE;
  player.weaponAmmo[WEAPON_TYPES.PLASMA_GRENADE] = 10;
  player.fireWeapon(enemyManager);
  for (let i = 0; i < 600 && player.projectiles.length > 0; i++) {
    player.updateProjectiles(1 / 60, enemyManager);
  }
  console.log("grenade: boss hp =", enemyManager.enemies[0]?.hp, "(expected < 10)");
}

// --- Seeker Missile vs Boss ---
{
  const { enemyManager, player } = makeWorld();
  enemyManager.addBoss(300, 100, 10, "boss4");
  const boss = enemyManager.enemies[0];
  player.x = 100;
  player.y = 300;
  player.facingRight = true;
  player.activeWeapon = WEAPON_TYPES.SEEKER_MISSILE;
  player.weaponAmmo[WEAPON_TYPES.SEEKER_MISSILE] = 10;
  player.fireWeapon(enemyManager);
  for (let i = 0; i < 600 && player.projectiles.length > 0; i++) {
    player.updateProjectiles(1 / 60, enemyManager);
  }
  console.log("seeker: boss hp =", enemyManager.enemies[0]?.hp, "(expected < 10)");
}
