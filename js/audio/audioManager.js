/* ==========================================================================
   AUDIO MANAGER (Main Audio Coordinator)
   ========================================================================== */

import { SoundEffects } from './sfx.js';
import { MusicSequencer } from './sequencer.js';

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.noiseBuffer = null;

        this.sfx = new SoundEffects(this);
        this.sequencer = new MusicSequencer(this);
    }

    // Property getters/setters for compatibility
    get thrustOsc() { return this.sfx.thrustOsc; }
    get thrustGain() { return this.sfx.thrustGain; }
    get isThrusting() { return this.sfx.isThrusting; }
    get bgmGain() { return this.sequencer.bgmGain; }
    get isPlayingMusic() { return this.sequencer.isPlayingMusic; }
    get currentTrack() { return this.sequencer.currentTrack; }
    set currentTrack(val) { this.sequencer.currentTrack = val; }
    get currentLevel() { return this.sequencer.currentLevel; }
    set currentLevel(val) { this.sequencer.currentLevel = val; }
    get currentStep() { return this.sequencer.currentStep; }
    set currentStep(val) { this.sequencer.currentStep = val; }
    get nextStepTime() { return this.sequencer.nextStepTime; }
    set nextStepTime(val) { this.sequencer.nextStepTime = val; }
    get musicTimer() { return this.sequencer.musicTimer; }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
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

    hideAudioPrompt() {
        const prompt = document.getElementById('audioUnlockPrompt');
        if (prompt) {
            prompt.style.visibility = 'hidden';
            prompt.style.opacity = '0';
        }
    }

    setupUserUnlock() {
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
                    this.nextStepTime = this.ctx.currentTime + 0.05;
                    this.hideAudioPrompt();
                });
            } else {
                this.hideAudioPrompt();
            }
            if (this.currentTrack.startsWith('game')) {
                this.startGameMusic(this.currentLevel || 0);
            } else if (!this.sequencer.isPlayingMusic) {
                this.startMenuMusic();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('pointerdown', unlock, { capture: true });
            window.addEventListener('keydown', unlock, { capture: true });
            window.addEventListener('click', unlock, { capture: true });
        }
    }

    toggleMute() {
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
    startMenuMusic(forceReset = false) {
        this.sequencer.startMenuMusic(forceReset);
    }

    startGameMusic(levelIndex = 0) {
        this.sequencer.startGameMusic(levelIndex);
    }

    startMusic() {
        this.sequencer.startMusic();
    }

    stopMusic() {
        this.sequencer.stopMusic();
    }

    // Sound Effects Methods
    startThrust() {
        this.sfx.startThrust();
    }

    stopThrust() {
        this.sfx.stopThrust();
    }

    playPhaseSound() {
        this.sfx.playPhaseSound();
    }

    playEmeraldPickup() {
        this.sfx.playEmeraldPickup();
    }

    playAllDiamondsCaught() {
        this.sfx.playAllDiamondsCaught();
    }

    playFuelPickup() {
        this.sfx.playFuelPickup();
    }

    playExplosion() {
        this.sfx.playExplosion();
    }

    playPortalWarp() {
        this.sfx.playPortalWarp();
    }

    playTeleport() {
        this.sfx.playTeleport();
    }

    startEnergyDrain() {
        this.sfx.startEnergyDrain();
    }

    stopEnergyDrain() {
        this.sfx.stopEnergyDrain();
    }
}
