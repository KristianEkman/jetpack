/* ==========================================================================
   CHIPTUNE & SYNTH BGM SEQUENCER
   ========================================================================== */

import {
    BASS_PATTERN, MELODY_PATTERN,
    BASS_PATTERN_L2, MELODY_PATTERN_L2,
    MENU_BASS_PATTERN, MENU_CHIME_PATTERN
} from './patterns.js';

export class MusicSequencer {
    constructor(audioManager) {
        this.audio = audioManager;
        this.bgmGain = null;
        this.isPlayingMusic = false;
        this.currentTrack = 'none'; // 'none', 'menu', 'game_0', 'game_1', etc.
        this.currentLevel = 0;
        this.currentStep = 0;
        this.nextStepTime = 0;
        this.musicTimer = null;
    }

    get ctx() {
        return this.audio.ctx;
    }

    get isMuted() {
        return this.audio.isMuted;
    }

    get noiseBuffer() {
        return this.audio.noiseBuffer;
    }

    startMenuMusic(forceReset = false) {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                this.nextStepTime = this.ctx.currentTime + 0.05;
            });
        }
        if (!forceReset && this.currentTrack === 'menu' && this.isPlayingMusic) {
            if (this.nextStepTime < this.ctx.currentTime) {
                this.nextStepTime = this.ctx.currentTime + 0.05;
            }
            return;
        }
        this.stopMusic();
        this.currentTrack = 'menu';
        this.startMusic();
    }

    startGameMusic(levelIndex = 0) {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                this.nextStepTime = this.ctx.currentTime + 0.05;
            });
        }
        this.currentLevel = levelIndex;
        const trackName = 'game_' + levelIndex;
        if (this.currentTrack === trackName && this.isPlayingMusic) {
            if (this.nextStepTime < this.ctx.currentTime) {
                this.nextStepTime = this.ctx.currentTime + 0.05;
            }
            return;
        }
        this.stopMusic();
        this.currentTrack = trackName;
        this.startMusic();
    }

    startMusic() {
        this.audio.init();
        if (!this.ctx) return;

        if (this.isPlayingMusic) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    this.nextStepTime = this.ctx.currentTime + 0.05;
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

    stopMusic() {
        this.isPlayingMusic = false;
        this.currentTrack = 'none';
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }

    scheduleMusic() {
        if (!this.isPlayingMusic || !this.ctx) return;
        if (this.ctx.state === 'suspended') return;

        // Auto-align lookahead timer if context was resumed
        if (this.nextStepTime < this.ctx.currentTime) {
            this.nextStepTime = this.ctx.currentTime + 0.05;
        }

        const bpm = this.currentTrack === 'menu' ? 30 : (this.currentLevel === 1 ? 132 : 96);
        const maxSteps = this.currentTrack === 'menu' ? 32 : 192;
        const stepDuration = (60 / bpm) / 4;

        while (this.nextStepTime < this.ctx.currentTime + 0.1) {
            this.playMusicStep(this.currentStep, this.nextStepTime, stepDuration);
            this.nextStepTime += stepDuration;
            this.currentStep = (this.currentStep + 1) % maxSteps;
        }
    }

    playMusicStep(step, time, stepDuration) {
        if (this.isMuted) return;

        if (this.currentTrack === 'menu') {
            this.playMenuStep(step, time, stepDuration);
        } else {
            this.playGameStep(step, time, stepDuration);
        }
    }

    playMenuStep(step, time, stepDuration) {
        // 1. Dark Atmospheric Minor Synth Pad / Chime
        const chimeFreq = MENU_CHIME_PATTERN[step];
        if (chimeFreq) {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(chimeFreq, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(550, time);

            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.0005, time + stepDuration * 3.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * 3.5);
        }

        // 2. Heavy Sub-Bass Drone
        const bassFreq = MENU_BASS_PATTERN[step];
        if (bassFreq) {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(bassFreq, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(180, time);

            gain.gain.setValueAtTime(0.22, time);
            gain.gain.exponentialRampToValueAtTime(0.005, time + stepDuration * 3.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * 3.2);
        }

        // 3. Dark Heavy Beat Pulse (Every 4 steps / beat)
        if (step % 4 === 0) {
            // Heavy Sub Kick
            const kickOsc = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();

            kickOsc.type = 'sine';
            kickOsc.frequency.setValueAtTime(100, time);
            kickOsc.frequency.exponentialRampToValueAtTime(28, time + 0.25);

            kickGain.gain.setValueAtTime(0.35, time);
            kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

            kickOsc.connect(kickGain);
            kickGain.connect(this.bgmGain);

            kickOsc.start(time);
            kickOsc.stop(time + 0.3);

            // Dark Noise Thud
            if (this.noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(350, time);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.08, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);

                noise.start(time);
                noise.stop(time + 0.12);
            }
        }
    }

    playGameStep(step, time, stepDuration) {
        const isLevel2 = this.currentLevel === 1;

        // 1. Synth Bass Channel (Level 1: Chiptune Triangle / Level 2: Resonant Punch Synth Bass)
        const bassPattern = isLevel2 ? BASS_PATTERN_L2 : BASS_PATTERN;
        const bassFreq = bassPattern[step];
        if (bassFreq) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = isLevel2 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(bassFreq, time);

            filter.type = 'lowpass';
            if (isLevel2) {
                filter.Q.setValueAtTime(3.2, time);
                filter.frequency.setValueAtTime(900, time);
                filter.frequency.exponentialRampToValueAtTime(200, time + stepDuration * 0.9);
            } else {
                filter.frequency.setValueAtTime(800, time);
            }

            gain.gain.setValueAtTime(isLevel2 ? 0.24 : 0.28, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + stepDuration * 0.9);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * 0.9);
        }

        // 2. Lead Channel (Level 1: 8-Bit Square Wave / Level 2: Detuned Dual-Oscillator Resonant Synth Lead)
        const melodyPattern = isLevel2 ? MELODY_PATTERN_L2 : MELODY_PATTERN;
        const leadFreq = melodyPattern[step];
        if (leadFreq) {
            if (isLevel2) {
                // Level 2 Instrument: Dual-Oscillator Detuned Resonant Synth Lead
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'sawtooth';
                osc1.frequency.setValueAtTime(leadFreq, time);

                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(leadFreq * 1.006, time); // 10-cent detune chorus effect

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
                // Level 1 Instrument: Classic Chiptune Square Pulse Wave
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(leadFreq, time);

                gain.gain.setValueAtTime(0.14, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + stepDuration * 0.85);

                osc.connect(gain);
                gain.connect(this.bgmGain);

                osc.start(time);
                osc.stop(time + stepDuration * 0.85);
            }
        }

        // 3. Retro Drums: Kick Drum (beats 1, 2, 3, 4)
        if (step % 4 === 0) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, time);
            osc.frequency.exponentialRampToValueAtTime(32, time + 0.07);

            gain.gain.setValueAtTime(0.35, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.07);

            osc.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + 0.07);
        }

        // 4. Retro Drums: Snare Drum (beats 2 and 4)
        if (step % 8 === 4 && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
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

        // 5. Retro Drums: Hi-Hat Ticks (Level 2 includes syncopated 16th bounce)
        const isHatStep = step % 2 === 0 || (isLevel2 && step % 8 === 3);
        if (isHatStep && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(isLevel2 ? 7000 : 6000, time);

            const gain = this.ctx.createGain();
            const hatVol = (isLevel2 && step % 8 === 3) ? 0.04 : 0.06;
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
