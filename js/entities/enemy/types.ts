/* ==========================================================================
   ENEMY TYPES & INTERFACES
   ========================================================================== */

export const ENEMY_TYPES = {
  FLITZER: "flitzer",
  HOMING_MISSILE: "homing_missile",
  TURRET: "turret",
  BOSS: "boss",
} as const;

export type EnemyType = (typeof ENEMY_TYPES)[keyof typeof ENEMY_TYPES];

export interface FlitzerDirection {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

export const FLITZER_DIRECTIONS: readonly FlitzerDirection[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

export const FLITZER_CENTER_EPSILON = 0.01;

export interface Enemy {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx?: number;
  vy?: number;
  speed?: number;
  timer?: number;
  fireInterval?: number;
  animTimer?: number;
  targetX?: number;
  targetY?: number;
  dead?: boolean;
  hp?: number;
  maxHp?: number;
  phase?: number;
  hitFlashTimer?: number;
  attackTimer?: number;
  laserCharging?: boolean;
  laserChargeTimer?: number;
  laserActiveTimer?: number;
  laserX?: number;
  bossName?: string;
  startY?: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
}
