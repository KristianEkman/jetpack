/* ==========================================================================
   AUDIO MANAGER (Main Audio Coordinator)
   ========================================================================== */

import { SoundEffects } from './sfx.js';
import { MusicSequencer } from './sequencer.js';

export class AudioManager {
    ctx: AudioContext | null;
    isSfxMuted: boolean;
    isMusicMuted: boolean;
    noiseBuffer: AudioBuffer | null;
    sfx: SoundEffects;
    sequencer: MusicSequencer;

    constructor() {
        this.ctx = null;
        this.isSfxMuted = false;
        this.isMusicMuted = false;
        this.noiseBuffer = null;

        // Load persisted audio preferences if available
        if (typeof localStorage !== 'undefined') {
            try {
                const savedSfx = localStorage.getItem('jetpack_sfx_muted');
                if (savedSfx !== null) {
                    this.isSfxMuted = savedSfx === 'true';
                }
                const savedMusic = localStorage.getItem('jetpack_music_muted');
                if (savedMusic !== null) {
                    this.isMusicMuted = savedMusic === 'true';
                }
            } catch (e) {
                // Ignore localStorage errors (e.g. security / sandboxed iframes)
            }
        }

        this.sfx = new SoundEffects(this);
        this.sequencer = new MusicSequencer(this);
    }

    get isMuted(): boolean {
        return this.isSfxMuted && this.isMusicMuted;
    }

    set isMuted(val: boolean) {
        this.isSfxMuted = val;
        this.isMusicMuted = val;
        this.persistAudioPreferences();
        this.applyMuteState();
    }

    private persistAudioPreferences(): void {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('jetpack_sfx_muted', String(this.isSfxMuted));
                localStorage.setItem('jetpack_music_muted', String(this.isMusicMuted));
            } catch (e) {
                // Ignore
            }
        }
    }

    private applyMuteState(): void {
        if (this.sequencer.bgmGain && this.ctx) {
            this.sequencer.bgmGain.gain.setValueAtTime(this.isMusicMuted ? 0 : 0.2, this.ctx.currentTime);
        }
        if (this.isSfxMuted) {
            if (this.sfx.thrustGain) {
                this.sfx.thrustGain.gain.value = 0;
            }
            if (this.sfx.drainGain) {
                this.sfx.drainGain.gain.value = 0;
            }
            if (this.sfx.isThrusting) {
                this.sfx.stopThrust();
            }
            if (this.sfx.isEnergyDraining) {
                this.sfx.stopEnergyDrain();
            }
        }
    }

    toggleSfx(): boolean {
        this.isSfxMuted = !this.isSfxMuted;
        this.persistAudioPreferences();
        if (this.isSfxMuted) {
            if (this.sfx.thrustGain) {
                this.sfx.thrustGain.gain.value = 0;
            }
            if (this.sfx.drainGain) {
                this.sfx.drainGain.gain.value = 0;
            }
            if (this.sfx.isThrusting) {
                this.sfx.stopThrust();
            }
            if (this.sfx.isEnergyDraining) {
                this.sfx.stopEnergyDrain();
            }
        }
        return this.isSfxMuted;
    }

    toggleMusic(): boolean {
        this.isMusicMuted = !this.isMusicMuted;
        this.persistAudioPreferences();
        if (this.sequencer.bgmGain && this.ctx) {
            this.sequencer.bgmGain.gain.setValueAtTime(this.isMusicMuted ? 0 : 0.2, this.ctx.currentTime);
        }
        return this.isMusicMuted;
    }

    setSfxMuted(muted: boolean): void {
        this.isSfxMuted = muted;
        this.persistAudioPreferences();
        if (this.isSfxMuted) {
            if (this.sfx.thrustGain) {
                this.sfx.thrustGain.gain.value = 0;
            }
            if (this.sfx.drainGain) {
                this.sfx.drainGain.gain.value = 0;
            }
            if (this.sfx.isThrusting) {
                this.sfx.stopThrust();
            }
            if (this.sfx.isEnergyDraining) {
                this.sfx.stopEnergyDrain();
            }
        }
    }

    setMusicMuted(muted: boolean): void {
        this.isMusicMuted = muted;
        this.persistAudioPreferences();
        if (this.sequencer.bgmGain && this.ctx) {
            this.sequencer.bgmGain.gain.setValueAtTime(this.isMusicMuted ? 0 : 0.2, this.ctx.currentTime);
        }
    }

    toggleMute(): boolean {
        const newMuteState = !(this.isSfxMuted && this.isMusicMuted);
        this.isSfxMuted = newMuteState;
        this.isMusicMuted = newMuteState;
        this.persistAudioPreferences();
        this.applyMuteState();
        return newMuteState;
    }

    get thrustGain(): GainNode | null { return this.sfx.thrustGain; }
    get isThrusting(): boolean { return this.sfx.isThrusting; }
    get bgmGain(): GainNode | null { return this.sequencer.bgmGain; }
    get isPlayingMusic(): boolean { return this.sequencer.isPlayingMusic; }
    get currentTrack(): string { return this.sequencer.currentTrack; }
    set currentTrack(val: string) { this.sequencer.currentTrack = val; }
    get currentLevel(): number { return this.sequencer.currentLevel; }
    set currentLevel(val: number) { this.sequencer.currentLevel = val; }
    get currentStep(): number { return this.sequencer.currentStep; }
    set currentStep(val: number) { this.sequencer.currentStep = val; }
    get nextStepTime(): number { return this.sequencer.nextStepTime; }
    set nextStepTime(val: number) { this.sequencer.nextStepTime = val; }
    get musicTimer(): ReturnType<typeof setInterval> | null { return this.sequencer.musicTimer; }

    init(): void {

        // Node/headless tests do not have the browser Web Audio API.
        if (typeof window === "undefined") {
            return;
        }
        if (!this.ctx) {
            const AudioCtx = window?.AudioContext || window?.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (this.ctx && !this.noiseBuffer) {
            const bufferSize = this.ctx.sampleRate * 0.1;
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
    }

    hideAudioPrompt(): void {
        const prompt = document.getElementById('audioUnlockPrompt');
        if (prompt) {
            prompt.style.visibility = 'hidden';
            prompt.style.opacity = '0';
        }
    }

    setupUserUnlock(): void {
        if (this.ctx && this.ctx.state === 'running') {
            this.hideAudioPrompt();
            return;
        }

        const removeUnlockListeners = () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('pointerdown', unlock, true);
                window.removeEventListener('keydown', unlock, true);
                window.removeEventListener('click', unlock, true);
            }
        };

        const unlock = () => {
            removeUnlockListeners();
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.05;
                    this.hideAudioPrompt();
                });
            } else {
                this.hideAudioPrompt();
            }
            if (this.currentTrack.startsWith('game')) {
                this.startGameMusic(this.currentLevel || 0);
            } else {
                this.stopMusic();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('pointerdown', unlock, { capture: true });
            window.addEventListener('keydown', unlock, { capture: true });
            window.addEventListener('click', unlock, { capture: true });
        }
    }

    // Sequencer Methods
    startMenuMusic(forceReset: boolean = false): void {
        this.sequencer.startMenuMusic(forceReset);
    }

    startGameMusic(levelIndex: number = 0): void {
        this.sequencer.startGameMusic(levelIndex);
    }

    startMusic(): void {
        this.sequencer.startMusic();
    }

    stopMusic(): void {
        this.sequencer.stopMusic();
    }

    // Sound Effects Methods
    startThrust(): void {
        this.sfx.startThrust();
    }

    stopThrust(): void {
        this.sfx.stopThrust();
    }

    playPhaseSound(): void {
        this.sfx.playPhaseSound();
    }

    playPhaseImpact(): void {
        this.sfx.playPhaseImpact();
    }

    playEmeraldPickup(): void {
        this.sfx.playEmeraldPickup();
    }

    playExtraLifePickup(): void {
        this.sfx.playExtraLifePickup();
    }

    playRapidFirePickup(): void {
        this.sfx.playRapidFirePickup();
    }

    playAllDiamondsCaught(): void {
        this.sfx.playAllDiamondsCaught();
    }

    playCampaignFanfare(): void {
        this.sfx.playCampaignFanfare();
    }

    playFuelPickup(): void {
        this.sfx.playFuelPickup();
    }

    playExplosion(): void {
        this.sfx.playExplosion();
    }

    playPortalWarp(): void {
        this.sfx.playPortalWarp();
    }

    playTeleport(): void {
        this.sfx.playTeleport();
    }

    playRespawn(): void {
        this.sfx.playRespawn();
    }

    playSpreadShotSound(): void {
        this.sfx.playSpreadShotSound();
    }

    playGrenadeLaunchSound(): void {
        this.sfx.playGrenadeLaunchSound();
    }

    playClusterExplosionSound(): void {
        this.sfx.playClusterExplosionSound();
    }

    playMissileLaunchSound(): void {
        this.sfx.playMissileLaunchSound();
    }

    playWeaponPickupSound(): void {
        this.sfx.playWeaponPickupSound();
    }

    startEnergyDrain(): void {
        this.sfx.startEnergyDrain();
    }

    stopEnergyDrain(): void {
        this.sfx.stopEnergyDrain();
    }
}
