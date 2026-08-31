// Repro: server-style weapon damage on a stationary boss
import { TILES, WEAPON_TYPES } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { EnemyManager } from "../js/entities/enemy/index.js";
import { Player } from "../js/entities/player.js";

function makeWorld() {
  const tileMap = new TileMap({ effectsEnabled: false });
  tileMap.cols = 30;
  tileMap.rows = 18;
  tileMap.grid = new Array(30 * 18).fill(TILES.AIR);
  for (let c = 0; c < 30; c++) tileMap.grid[17 * 30 + c] = TILES.BRICK;
  const enemyManager = new EnemyManager(tileMap);
  enemyManager.addBoss(440, 180, 30, null, "MECHA CORE ALPHA", 80, 64);
  const boss = enemyManager.enemies[0];
  const player = new Player(null, tileMap);
  player.x = 380;
  player.y = 200;
  player.facingRight = true;
  return { tileMap, enemyManager, boss, player };
}

function holdFire(player: any, enemyManager: any, seconds: number) {
  const dt = 1 / 60;
  const ticks = Math.round(seconds * 60);
  for (let i = 0; i < ticks; i++) {
    const input = {
      left: false, right: false, up: false, down: false,
      thrust: false, phase: true, suicide: false, sequenceId: i,
      facingRight: true,
    };
    player.simulateMovement(dt, input, enemyManager, null);
  }
}

for (const weapon of [
  WEAPON_TYPES.PHASE_BEAM,
  WEAPON_TYPES.SPREAD_CANNON,
  WEAPON_TYPES.PLASMA_GRENADE,
  WEAPON_TYPES.SEEKER_MISSILE,
]) {
  const { enemyManager, boss, player } = makeWorld();
  player.activeWeapon = weapon;
  if (weapon !== WEAPON_TYPES.PHASE_BEAM) player.weaponAmmo[weapon] = 99;
  holdFire(player, enemyManager, 5);
  console.log(`${weapon}: boss hp = ${boss.hp} / 30`);
}
