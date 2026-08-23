/* ==========================================================================
   CHIPTUNE & SYNTH BGM SEQUENCER
   ========================================================================== */

import {
    BASS_PATTERN, MELODY_PATTERN,
    BASS_PATTERN_L2, MELODY_PATTERN_L2,
    BASS_PATTERN_L3, MELODY_PATTERN_L3,
    BASS_PATTERN_L4, MELODY_PATTERN_L4,
    BASS_PATTERN_L5, MELODY_PATTERN_L5,
    BASS_PATTERN_L7, MELODY_PATTERN_L7,
    BASS_PATTERN_L8, MELODY_PATTERN_L8,
    MENU_BASS_PATTERN, MENU_CHIME_PATTERN
} from './patterns.js';
import type { AudioManager } from './audioManager.js';

export class MusicSequencer {
    audio: AudioManager;
    bgmGain: GainNode | null;
    isPlayingMusic: boolean;
    currentTrack: string;
    currentLevel: number;
    currentStep: number;
    nextStepTime: number;
    musicTimer: ReturnType<typeof setInterval> | null;

    constructor(audioManager: AudioManager) {
        this.audio = audioManager;
        this.bgmGain = null;
        this.isPlayingMusic = false;
        this.currentTrack = 'none';
        this.currentLevel = 0;
        this.currentStep = 0;
        this.nextStepTime = 0;
        this.musicTimer = null;
    }

    get ctx(): AudioContext | null {
        return this.audio.ctx;
    }

    get isMuted(): boolean {
        return this.audio.isMusicMuted;
    }

    get noiseBuffer(): AudioBuffer | null {
        return this.audio.noiseBuffer;
    }

    startMenuMusic(forceReset: boolean = false): void {
        this.stopMusic();
    }

    startGameMusic(levelIndex: number = 0): void {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.05;
            });
        }
        this.currentLevel = levelIndex;
        const trackName = 'game_' + levelIndex;
        if (this.currentTrack === trackName && this.isPlayingMusic) {
            if (this.ctx && this.nextStepTime < this.ctx.currentTime) {
                this.nextStepTime = this.ctx.currentTime + 0.05;
            }
            return;
        }
        this.stopMusic();
        this.currentTrack = trackName;
        this.startMusic();
    }

    startMusic(): void {
        this.audio.init();
        if (!this.ctx) return;

        if (this.isPlayingMusic) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.05;
                });
            }
            return;
        }

        this.isPlayingMusic = true;
        this.currentStep = 0;
        this.nextStepTime = this.ctx.currentTime + 0.05;

        if (!this.bgmGain) {
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime);
            this.bgmGain.connect(this.ctx.destination);
        } else {
            this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime);
        }

        if (this.musicTimer) clearInterval(this.musicTimer);
        this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
    }

    stopMusic(): void {
        this.isPlayingMusic = false;
        this.currentTrack = 'none';
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }

    scheduleMusic(): void {
        if (!this.isPlayingMusic || !this.ctx) return;
        if (this.ctx.state === 'suspended') return;

        if (this.nextStepTime < this.ctx.currentTime) {
            this.nextStepTime = this.ctx.currentTime + 0.05;
        }

        const gameBpms = [112, 132, 110, 96, 120, 115, 75, 140, 100, 136];
        const bpm = this.currentTrack === 'menu' ? 100 : (gameBpms[this.currentLevel] ?? 112);
        const maxSteps = 192;
        const stepDuration = (60 / bpm) / 4;

        while (this.nextStepTime < this.ctx.currentTime + 0.1) {
            this.playMusicStep(this.currentStep, this.nextStepTime, stepDuration);
            this.nextStepTime += stepDuration;
            this.currentStep = (this.currentStep + 1) % maxSteps;
        }
    }

    playMusicStep(step: number, time: number, stepDuration: number): void {
        if (this.isMuted) return;

        if (this.currentTrack === 'menu') {
            this.playMenuStep(step, time, stepDuration);
        } else {
            this.playGameStep(step, time, stepDuration);
        }
    }

    playMenuStep(step: number, time: number, stepDuration: number): void {
        if (!this.ctx || !this.bgmGain) return;

        const leadFreq = MENU_CHIME_PATTERN[step];
        if (leadFreq) {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const osc3 = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(leadFreq, time);

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(leadFreq * 1.0015, time);

            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(leadFreq * 2.0, time);

            filter.type = 'lowpass';
            filter.Q.setValueAtTime(2.2, time);
            filter.frequency.setValueAtTime(3600, time);
            filter.frequency.exponentialRampToValueAtTime(1200, time + stepDuration * 3.0);

            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.linearRampToValueAtTime(0.13, time + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.002, time + stepDuration * 3.2);

            osc1.connect(filter);
            osc2.connect(filter);
            osc3.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc1.start(time);
            osc2.start(time);
            osc3.start(time);
            osc1.stop(time + stepDuration * 3.3);
            osc2.stop(time + stepDuration * 3.3);
            osc3.stop(time + stepDuration * 3.3);
        }

        const bassFreq = MENU_BASS_PATTERN[step];
        if (bassFreq) {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(bassFreq, time);

            filter.type = 'lowpass';
            filter.Q.setValueAtTime(1.8, time);
            filter.frequency.setValueAtTime(450, time);

            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.linearRampToValueAtTime(0.22, time + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.004, time + stepDuration * 3.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * 3.6);
        }

        if (step % 16 === 0 && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(8000, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.linearRampToValueAtTime(0.015, time + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            noise.start(time);
            noise.stop(time + 0.8);
        }
    }

    playGameStep(step: number, time: number, stepDuration: number): void {
        if (!this.ctx || !this.bgmGain) return;

        const isLevel2 = this.currentLevel === 1;
        const isLevel3 = this.currentLevel === 2;
        const isLevel4 = this.currentLevel === 3;
        const isLevel5 = this.currentLevel === 4;
        const isLevel6 = this.currentLevel === 5;
        const isLevel7 = this.currentLevel === 6;
        const isLevel8 = this.currentLevel === 7;
        const isLevel9 = this.currentLevel === 8;
        const isLevel10 = this.currentLevel === 9;

        let bassPattern = BASS_PATTERN;
        if (isLevel2) bassPattern = BASS_PATTERN_L2;
        if (isLevel3) bassPattern = BASS_PATTERN_L3;
        if (isLevel4) bassPattern = BASS_PATTERN_L4;
        if (isLevel5) bassPattern = BASS_PATTERN_L5;
        if (isLevel6) bassPattern = BASS_PATTERN_L3;
        if (isLevel7 || isLevel10) bassPattern = BASS_PATTERN_L7;
        if (isLevel8) bassPattern = BASS_PATTERN_L8;
        if (isLevel9) bassPattern = BASS_PATTERN_L5;

        let bassTied = 1;
        if (isLevel7 || isLevel10) {
            while (step + bassTied < bassPattern.length && bassPattern[step + bassTied] === null && bassTied < 4) {
                bassTied++;
            }
        }
        const bassDurMult = (isLevel7 || isLevel10) ? (bassTied - 0.05) : 0.85;

        const bassFreq = bassPattern[step];
        if (bassFreq) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = (isLevel5 || isLevel7 || isLevel10) ? 'square' : ((isLevel2 || isLevel3 || isLevel6 || isLevel8) ? 'sawtooth' : 'triangle');
            osc.frequency.setValueAtTime(bassFreq, time);

            filter.type = 'lowpass';
            if (isLevel7 || isLevel10) {
                filter.Q.setValueAtTime(4.2, time);
                filter.frequency.setValueAtTime(1600, time);
                filter.frequency.exponentialRampToValueAtTime(300, time + stepDuration * bassDurMult);
            } else if (isLevel8) {
                filter.Q.setValueAtTime(3.8, time);
                filter.frequency.setValueAtTime(1500, time);
                filter.frequency.exponentialRampToValueAtTime(350, time + stepDuration * 0.88);
            } else if (isLevel2) {
                filter.Q.setValueAtTime(3.2, time);
                filter.frequency.setValueAtTime(900, time);
                filter.frequency.exponentialRampToValueAtTime(200, time + stepDuration * 0.9);
            } else if (isLevel3) {
                filter.Q.setValueAtTime(4.5, time);
                filter.frequency.setValueAtTime(1400, time);
                filter.frequency.exponentialRampToValueAtTime(250, time + stepDuration * 0.85);
            } else if (isLevel5) {
                filter.Q.setValueAtTime(2.8, time);
                filter.frequency.setValueAtTime(1350, time);
                filter.frequency.exponentialRampToValueAtTime(260, time + stepDuration * 0.78);
            } else if (isLevel4) {
                filter.Q.setValueAtTime(2.0, time);
                filter.frequency.setValueAtTime(1200, time);
                filter.frequency.exponentialRampToValueAtTime(300, time + stepDuration * 0.75);
            } else {
                filter.frequency.setValueAtTime(800, time);
            }

            gain.gain.setValueAtTime(isLevel8 ? 0.28 : ((isLevel7 || isLevel10) ? 0.32 : (isLevel5 ? 0.23 : (isLevel4 ? 0.30 : (isLevel2 ? 0.24 : (isLevel3 ? 0.26 : 0.28))))), time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + stepDuration * bassDurMult);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * bassDurMult);
        }

        let melodyPattern = MELODY_PATTERN;
        if (isLevel2) melodyPattern = MELODY_PATTERN_L2;
        if (isLevel3) melodyPattern = MELODY_PATTERN_L3;
        if (isLevel4) melodyPattern = MELODY_PATTERN_L4;
        if (isLevel5) melodyPattern = MELODY_PATTERN_L5;
        if (isLevel6) melodyPattern = MELODY_PATTERN_L3;
        if (isLevel7 || isLevel10) melodyPattern = MELODY_PATTERN_L7;
        if (isLevel8) melodyPattern = MELODY_PATTERN_L8;
        if (isLevel9) melodyPattern = MELODY_PATTERN_L5;

        const leadFreq = melodyPattern[step];
        if (leadFreq) {
            let leadTied = 1;
            if (isLevel7 || isLevel10) {
                while (step + leadTied < melodyPattern.length && melodyPattern[step + leadTied] === null && leadTied < 4) {
                    leadTied++;
                }
            }
            const leadDurMult = (isLevel7 || isLevel10) ? (leadTied - 0.05) : 0.9;

            if (isLevel7 || isLevel10) {
                // Boss Level Cathedral Organ Synth (3 detuned oscillators) with tied note sustain
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const osc3 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'sawtooth';
                osc1.frequency.setValueAtTime(leadFreq, time);

                osc2.type = 'square';
                osc2.frequency.setValueAtTime(leadFreq * 0.998, time);

                osc3.type = 'triangle';
                osc3.frequency.setValueAtTime(leadFreq * 2.0, time);

                filter.type = 'lowpass';
                filter.Q.setValueAtTime(4.5, time);
                filter.frequency.setValueAtTime(4200, time);
                filter.frequency.exponentialRampToValueAtTime(1100, time + stepDuration * leadDurMult * 0.9);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(0.18, time + 0.004);
                gain.gain.exponentialRampToValueAtTime(0.005, time + stepDuration * leadDurMult);

                osc1.connect(filter);
                osc2.connect(filter);
                osc3.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                osc1.start(time);
                osc2.start(time);
                osc3.start(time);
                osc1.stop(time + stepDuration * leadDurMult);
                osc2.stop(time + stepDuration * leadDurMult);
                osc3.stop(time + stepDuration * leadDurMult);
            } else if (isLevel5) {
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const harmonicGain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(leadFreq, time);
                osc2.type = 'square';
                osc2.frequency.setValueAtTime(leadFreq * 2, time);
                harmonicGain.gain.setValueAtTime(0.16, time);

                filter.type = 'lowpass';
                filter.Q.setValueAtTime(3.0, time);
                filter.frequency.setValueAtTime(3800, time);
                filter.frequency.exponentialRampToValueAtTime(1050, time + stepDuration * 0.72);

                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(0.155, time + 0.004);
                gain.gain.exponentialRampToValueAtTime(0.004, time + stepDuration * 0.82);

                osc1.connect(filter);
                osc2.connect(harmonicGain);
                harmonicGain.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                osc1.start(time);
                osc2.start(time);
                osc1.stop(time + stepDuration * 0.84);
                osc2.stop(time + stepDuration * 0.84);
            } else if (isLevel4) {
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(leadFreq, time);

                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(leadFreq * 1.002, time);

                filter.type = 'lowpass';
                filter.Q.setValueAtTime(2.2, time);
                filter.frequency.setValueAtTime(2200, time);
                filter.frequency.exponentialRampToValueAtTime(750, time + stepDuration * 0.85);

                const attackTime = 0.008;
                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(0.14, time + attackTime);
                gain.gain.exponentialRampToValueAtTime(0.003, time + stepDuration * 0.9);

                osc1.connect(filter);
                osc2.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                osc1.start(time);
                osc2.start(time);
                osc1.stop(time + stepDuration * 0.9);
                osc2.stop(time + stepDuration * 0.9);
            } else if (isLevel3) {
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'square';
                osc1.frequency.setValueAtTime(leadFreq, time);

                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(leadFreq * 0.5, time);

                filter.type = 'lowpass';
                filter.Q.setValueAtTime(4.0, time);
                filter.frequency.setValueAtTime(3200, time);
                filter.frequency.exponentialRampToValueAtTime(800, time + stepDuration * 0.65);

                gain.gain.setValueAtTime(0.15, time);
                gain.gain.exponentialRampToValueAtTime(0.005, time + stepDuration * 0.8);

                osc1.connect(filter);
                osc2.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                osc1.start(time);
                osc2.start(time);
                osc1.stop(time + stepDuration * 0.8);
                osc2.stop(time + stepDuration * 0.8);
            } else if (isLevel2) {
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'sawtooth';
                osc1.frequency.setValueAtTime(leadFreq, time);

                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(leadFreq * 1.006, time);

                filter.type = 'lowpass';
                filter.Q.setValueAtTime(5.5, time);
                filter.frequency.setValueAtTime(2800, time);
                filter.frequency.exponentialRampToValueAtTime(550, time + stepDuration * 0.7);

                gain.gain.setValueAtTime(0.13, time);
                gain.gain.exponentialRampToValueAtTime(0.005, time + stepDuration * 0.85);

                osc1.connect(filter);
                osc2.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                osc1.start(time);
                osc2.start(time);
                osc1.stop(time + stepDuration * 0.85);
                osc2.stop(time + stepDuration * 0.85);
            } else {
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(leadFreq, time);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2800, time);

                const attackTime = 0.006;
                gain.gain.setValueAtTime(0.001, time);
                gain.gain.linearRampToValueAtTime(0.14, time + attackTime);
                gain.gain.exponentialRampToValueAtTime(0.005, time + stepDuration * 0.85);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                osc.start(time);
                osc.stop(time + stepDuration * 0.85);
            }
        }

        const isKickStep = (isLevel4 || isLevel5) ? (step % 8 === 0) : ((isLevel7) ? (step % 4 === 0 || step % 16 === 14) : (step % 4 === 0));
        if (isKickStep) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const kickStart = isLevel7 ? 150 : (isLevel5 ? 108 : (isLevel4 ? 125 : 140));
            const kickLength = isLevel7 ? 0.09 : (isLevel5 ? 0.11 : (isLevel4 ? 0.06 : 0.07));
            osc.frequency.setValueAtTime(kickStart, time);
            osc.frequency.exponentialRampToValueAtTime(32, time + kickLength);

            gain.gain.setValueAtTime(isLevel7 ? 0.36 : (isLevel5 ? 0.28 : (isLevel4 ? 0.32 : 0.35)), time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + kickLength);

            osc.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + kickLength);
        }

        const isSnareStep = isLevel4 ? (step % 8 === 4 || step % 16 === 14) : (step % 8 === 4);
        if (isSnareStep && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();

            if (isLevel4) {
                const isSyncopatedTap = (step % 16 === 14);
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(isSyncopatedTap ? 2600 : 1700, time);
                filter.Q.setValueAtTime(2.0, time);

                const gain = this.ctx.createGain();
                const snareVol = isSyncopatedTap ? 0.12 : 0.22;
                gain.gain.setValueAtTime(snareVol, time);
                gain.gain.exponentialRampToValueAtTime(0.005, time + (isSyncopatedTap ? 0.045 : 0.07));

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                noise.start(time);
                noise.stop(time + (isSyncopatedTap ? 0.045 : 0.07));
            } else {
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(800, time);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.2, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.09);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                noise.start(time);
                noise.stop(time + 0.09);
            }
        }

        const isHatStep = isLevel4
            ? (step % 2 === 0 || step % 4 === 1)
            : (step % 2 === 0 || ((isLevel2 || isLevel3) && step % 4 === 1));

        if (isHatStep && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();

            if (isLevel4) {
                const isOffbeat = (step % 4 === 2);
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(isOffbeat ? 7500 : 5500, time);

                const gain = this.ctx.createGain();
                const hatVol = isOffbeat ? 0.07 : 0.035;
                gain.gain.setValueAtTime(hatVol, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.022);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                noise.start(time);
                noise.stop(time + 0.022);
            } else {
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(isLevel3 ? 8000 : (isLevel2 ? 7000 : (isLevel5 ? 6500 : 6000)), time);

                const gain = this.ctx.createGain();
                const hatVol = ((isLevel2 || isLevel3) && step % 4 === 1) ? 0.04 : 0.06;
                gain.gain.setValueAtTime(hatVol, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                noise.start(time);
                noise.stop(time + 0.025);
            }
        }
    }
}
