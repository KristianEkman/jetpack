import assert from "node:assert/strict";
import { TILES, WEAPON_SPECS, WEAPON_TYPES } from "../js/shared/constants.js";
import { TileMap } from "../js/world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "../js/entities/enemy/index.js";
import {
  detonateGrenade,
  detonateMissile,
} from "../js/entities/player/playerCombat.js";
import { distanceSqToBox } from "../js/shared/collision.js";

console.log("🧪 Running Boss Blast Damage Test Suite...\n");

const tileMap = new TileMap();
tileMap.cols = 30;
tileMap.rows = 18;
tileMap.grid = new Array(30 * 18).fill(TILES.AIR);

const fakePlayer: any = {
  id: "p1",
  tileMap,
  audio: null,
  addScore: () => {},
};

function makeBossManager(width: number, height: number, name: string) {
  const em = new EnemyManager(tileMap);
  em.addBoss(400, 200, 25, null, name, width, height);
  return em;
}

const GRENADE_SPEC = WEAPON_SPECS[WEAPON_TYPES.PLASMA_GRENADE];
const SEEKER_SPEC = WEAPON_SPECS[WEAPON_TYPES.SEEKER_MISSILE];

// 1. distanceSqToBox helper sanity
console.log("1️⃣  Testing distanceSqToBox helper...");
const box = { x: 100, y: 100, width: 40, height: 20 };
assert.equal(distanceSqToBox(110, 110, box), 0, "Point inside box -> 0");
assert.equal(distanceSqToBox(100, 110, box), 0, "Point on edge -> 0");
assert.equal(distanceSqToBox(90, 110, box), 100, "Point 10px left -> 100");
assert.equal(distanceSqToBox(150, 130, box), 200, "Corner dx=10, dy=10 -> 200");
console.log("   ✅ distanceSqToBox verified.");

// 2. Grenade side-edge detonation damages both bosses
console.log("2️⃣  Testing grenade side-edge blast vs bosses...");
for (const [w, h, name] of [
  [80, 64, "MECHA CORE ALPHA"],
  [128, 96, "MECHA CORE OMEGA"],
] as const) {
  const em = makeBossManager(w, h, name);
  const boss = em.enemies[0];
  detonateGrenade(
    {
      x: boss.x, // left edge, vertically centered (direct-contact point)
      y: boss.y + boss.height / 2,
      damage: GRENADE_SPEC.damage,
      blastRadius: GRENADE_SPEC.blastRadius,
    } as any,
    fakePlayer,
    em,
    [],
  );
  assert.equal(
    boss.hp,
    25 - GRENADE_SPEC.damage,
    `Grenade side blast must damage ${name}`,
  );
}
console.log("   ✅ Grenade side-edge blasts damage both bosses.");

// 3. Seeker side-edge detonation damages both bosses
console.log("3️⃣  Testing seeker side-edge blast vs bosses...");
for (const [w, h, name] of [
  [80, 64, "MECHA CORE ALPHA"],
  [128, 96, "MECHA CORE OMEGA"],
] as const) {
  const em = makeBossManager(w, h, name);
  const boss = em.enemies[0];
  detonateMissile(
    {
      x: boss.x,
      y: boss.y + boss.height / 2,
      damage: SEEKER_SPEC.damage,
      blastRadius: SEEKER_SPEC.blastRadius,
    } as any,
    fakePlayer,
    em,
    [],
  );
  assert.equal(
    boss.hp,
    25 - SEEKER_SPEC.damage,
    `Seeker side blast must damage ${name}`,
  );
}
console.log("   ✅ Seeker side-edge blasts damage both bosses.");

// 4. Blasts beyond the radius still do NOT damage (no regression)
console.log("4️⃣  Testing out-of-range blast does no damage...");
{
  const em = makeBossManager(80, 64, "MECHA CORE ALPHA");
  const boss = em.enemies[0];
  detonateGrenade(
    {
      x: boss.x - GRENADE_SPEC.blastRadius - 20,
      y: boss.y + boss.height / 2,
      damage: GRENADE_SPEC.damage,
      blastRadius: GRENADE_SPEC.blastRadius,
    } as any,
    fakePlayer,
    em,
    [],
  );
  assert.equal(boss.hp, 25, "Out-of-range grenade must not damage boss");
}
console.log("   ✅ Out-of-range blast does no damage.");

// 5. Small enemies still take blast damage (unchanged behavior)
console.log("5️⃣  Testing blast vs small enemy (flitzer)...");
{
  const em = new EnemyManager(tileMap);
  em.addFlitzer(400, 200, 100, 100, "flitz1");
  const flitzer = em.enemies[0];
  assert.equal(flitzer.type, ENEMY_TYPES.FLITZER);
  detonateMissile(
    {
      x: flitzer.x,
      y: flitzer.y + flitzer.height / 2,
      damage: SEEKER_SPEC.damage,
      blastRadius: SEEKER_SPEC.blastRadius,
    } as any,
    fakePlayer,
    em,
    [],
  );
  assert.equal(
    em.enemies.length,
    0,
    "Flitzer must be destroyed by seeker blast",
  );
}
console.log("   ✅ Small enemies still destroyed by blasts.");

console.log("\n🎉 All boss blast damage tests passed!");
