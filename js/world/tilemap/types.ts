export interface DissolvedBrick {
  index: number;
  col: number;
  row: number;
  originalTile: number;
  timer: number;
}

export interface TeleporterPad {
  tiles: number[];
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface DebrisObject {
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  gravity?: number;
  life: number;
  maxLife: number;
  bounce?: number;
  radius?: number;
  speed?: number;
}

export type TileMapListener<T = any> = (payload: T) => void;
