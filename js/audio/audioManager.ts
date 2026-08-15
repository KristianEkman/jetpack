/* ==========================================================================
   AUDIO MANAGER (Main Audio Coordinator)
   ========================================================================== */

import { SoundEffects } from './sfx.js';
import { MusicSequencer } from './sequencer.js';

export class AudioManager {
    ctx: AudioContext | null;
    isMuted: boolean;
    noiseBuffer: AudioBuffer | null;
    sfx: SoundEffects;
    sequencer: MusicSequencer;

    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.noiseBuffer = null;

        this.sfx = new SoundEffects(this);
        this.sequencer = new MusicSequencer(this);
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

    toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.sequencer.bgmGain && this.ctx) {
            this.sequencer.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime);
        }
        if (this.isMuted && this.sfx.thrustGain) {
            this.sfx.thrustGain.gain.value = 0;
        }
        if (this.isMuted && this.sfx.drainGain) {
            this.sfx.drainGain.gain.value = 0;
        }
        return this.isMuted;
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

    startEnergyDrain(): void {
        this.sfx.startEnergyDrain();
    }

    stopEnergyDrain(): void {
        this.sfx.stopEnergyDrain();
    }
}
