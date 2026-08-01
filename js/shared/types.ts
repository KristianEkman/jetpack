/* ==========================================================================
   SHARED TYPE DEFINITIONS
   ========================================================================== */

export interface InputState {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
  thrust?: boolean;
  phase?: boolean;
  sequenceId?: number;
  dt?: number;
}

export interface PlayerConfig {
  id?: string;
  name?: string;
  color?: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  levelIndex: number | string;
  customMapData?: LevelData | null;
  players: Array<{
    id: string;
    socketId: string;
    name: string;
    color: string;
    isHost: boolean;
  }>;
  status: 'lobby' | 'playing' | 'ended';
  maxPlayers: number;
}

export interface LevelData {
  name: string;
  author?: string;
  grid: number[];
  spawnX?: number;
  spawnY?: number;
}

export type PlayerSnapshotTuple = [
  socketId: string,
  playerId: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  fuel: number,
  lives: number,
  score: number,
  flags: number,
  animFrame: number,
  sequenceId: number
];

export type EnemySnapshotTuple = [
  id: string,
  type: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  state: number
];

export interface WorldSnapshotPayload {
  timestamp: number;
  players: PlayerSnapshotTuple[];
  enemies?: EnemySnapshotTuple[];
  levelIndex?: number | string;
}

export interface SerializedInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  thrust: boolean;
  phase: boolean;
  suicide: boolean;
  sequenceId: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  facingRight?: boolean;
  isGrounded?: boolean;
  isThrusting?: boolean;
  isClimbing?: boolean;
  isPhasing?: boolean;
}

export interface ParticleSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}
