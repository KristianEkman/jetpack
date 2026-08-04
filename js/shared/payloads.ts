import { MultiplayerGameMode, WorldSnapshotPayload } from "./types";

export interface LevelData {
  name: string;
  author?: string;
  grid: number[];
  spawnX?: number;
  spawnY?: number;
}

export interface MultiplayerPlayer {
  id: string;
  socketId: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fuel?: number;
  lives?: number;
  score?: number;
  facingRight?: boolean;
}

export type MultiplayerLevelData = Omit<LevelData, "name"> & {
  name: string;
  flitzers?: Array<{ x: number; y: number; vx: number; vy: number }>;
  missiles?: Array<{ x: number; y: number }>;
  turrets?: Array<{ x: number; y: number; fireInterval: number }>;
};

export interface MultiplayerRoomInfo {
  id: string;
  hostSocketId: string;
  maxPlayers: number;
  levelIndex: number;
  gameMode: MultiplayerGameMode;
  customMapData?: MultiplayerLevelData | null;
  mapName?: string;
  status: "lobby" | "playing" | "ended" | "finished";
  tickCount?: number;
  players: MultiplayerPlayer[];
  destroyedEnemyIds?: string[];
}

export interface PublicRoomInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  status: MultiplayerRoomInfo["status"];
  levelIndex: number;
  gameMode: MultiplayerGameMode;
  mapName?: string;
}

export interface CreateRoomOptions {
  customCode?: string;
  levelIndex?: number;
  maxPlayers?: number;
  playerName?: string;
  playerColor?: string;
  customMapData?: MultiplayerLevelData;
  gameMode?: MultiplayerGameMode;
}

export interface JoinRoomOptions {
  playerName?: string;
  playerColor?: string;
}

export interface NetworkResponse {
  success: boolean;
  error?: string;
}

export interface RoomActionResponse extends NetworkResponse {
  room?: MultiplayerRoomInfo;
  roomId?: string;
  socketId?: string;
  player?: MultiplayerPlayer;
}

export interface RoomCreatedPayload extends RoomActionResponse {
  success: true;
  room: MultiplayerRoomInfo;
  roomId: string;
}

export interface RoomJoinedPayload extends RoomActionResponse {
  success: true;
  room: MultiplayerRoomInfo;
}

export interface PlayerJoinedPayload {
  room?: MultiplayerRoomInfo;
  player?: MultiplayerPlayer;
}

export interface PlayerLeftPayload {
  room?: MultiplayerRoomInfo;
  socketId?: string;
  leavingPlayer?: MultiplayerPlayer;
  newHostSocketId?: string | null;
}

export interface GameStartedPayload extends RoomActionResponse {
  room?: MultiplayerRoomInfo;
  levelIndex?: number;
  customMapData?: MultiplayerLevelData | null;
  destroyedEnemyIds?: string[];
}

export interface TilePositionPayload {
  col: number;
  row: number;
}

export interface ItemCollectedPayload extends TilePositionPayload {
  tileType: number;
  collectedEmeralds: number;
  isAllCaught: boolean;
}

export interface EnemyDestroyedPayload {
  enemyId: string;
  killedBy?: string;
}

export interface LevelCompletePayload extends RoomActionResponse {
  clearedBy?: string;
  players?: MultiplayerPlayer[];
  levelIndex?: number;
}

export interface GameOverPayload extends Pick<RoomActionResponse, "room"> {
  roomId?: string;
  reason?: string;
  players?: MultiplayerPlayer[];
  winnerName?: string;
  winnerSocketId?: string;
}

export interface NetworkWorldSnapshotPayload extends WorldSnapshotPayload {
  projectiles?: unknown;
}

export interface EnemyDestroyedResponse extends NetworkResponse {
  duplicate?: boolean;
}
