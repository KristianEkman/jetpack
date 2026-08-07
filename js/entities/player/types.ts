/* ==========================================================================
   PLAYER TYPES & INTERFACES
   ========================================================================== */

import { AudioManager, SoundEffects } from "../../audio/index.js";
import { TileMap } from "../../world/tilemap.js";

export interface PlayerOptions {
  id?: string;
  color?: string;
  name?: string;
  isLocal?: boolean;
  showNameTag?: boolean;
  audio?: SoundEffects | AudioManager;
  tileMap?: TileMap;
}
