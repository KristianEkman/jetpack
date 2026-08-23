/* ==========================================================================
   AUDIO MODULE EXPORTS
   ========================================================================== */

export { AudioManager } from './audioManager.js';
export { MusicSequencer } from './sequencer.js';
export { SoundEffects } from './sfx.js';
export { NOTES } from './notes.js';
export * from './patterns.js';

export interface AudioLike {
  isMuted?: boolean;
  isSfxMuted?: boolean;
  isMusicMuted?: boolean;
  toggleSfx?: () => boolean;
  toggleMusic?: () => boolean;
  toggleMute?: () => boolean;
  setSfxMuted?: (muted: boolean) => void;
  setMusicMuted?: (muted: boolean) => void;
  startThrust?: () => void;
  stopThrust?: () => void;
  playPhaseSound?: () => void;
  playPhaseImpact?: () => void;
  playEmeraldPickup?: () => void;
  playExtraLifePickup?: () => void;
  playRapidFirePickup?: () => void;
  playAllDiamondsCaught?: () => void;
  playFuelPickup?: () => void;
  playExplosion?: (isGameOver?: boolean) => void;
  playDramaticDeath?: (isGameOver?: boolean) => void;
  playPortalWarp?: () => void;
  playTeleport?: () => void;
  playRespawn?: () => void;
  startEnergyDrain?: () => void;
  stopEnergyDrain?: () => void;
  startMenuMusic?: (forceReset?: boolean) => void;
  startGameMusic?: (levelIndex?: number) => void;
  startMusic?: () => void;
  stopMusic?: () => void;
  sfx?: AudioLike;
}
