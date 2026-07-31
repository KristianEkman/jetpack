/* ==========================================================================
   CHIPTUNE & SYNTH BGM SEQUENCER
   ========================================================================== */

import {
    BASS_PATTERN, MELODY_PATTERN,
    BASS_PATTERN_L2, MELODY_PATTERN_L2,
    BASS_PATTERN_L3, MELODY_PATTERN_L3,
    BASS_PATTERN_L4, MELODY_PATTERN_L4,
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

        const bpm = this.currentTrack === 'menu' ? 112 : (this.currentLevel === 1 ? 132 : (this.currentLevel === 2 ? 116 : (this.currentLevel === 3 ? 110 : 96)));
        const maxSteps = this.currentTrack === 'menu' ? 64 : 192;
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
        // 1. Heroic 8-Bit Retro Arcade Lead (Chorused Square/Saw Pulse)
        const leadFreq = MENU_CHIME_PATTERN[step];
        if (leadFreq) {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc1.type = 'square';
            osc1.frequency.setValueAtTime(leadFreq, time);

            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(leadFreq * 1.003, time);

            filter.type = 'lowpass';
            filter.Q.setValueAtTime(3.0, time);
            filter.frequency.setValueAtTime(3200, time);
            filter.frequency.exponentialRampToValueAtTime(1000, time + stepDuration * 0.8);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.003, time + stepDuration * 0.85);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc1.start(time);
            osc2.start(time);
            osc1.stop(time + stepDuration * 0.85);
            osc2.stop(time + stepDuration * 0.85);
        }

        // 2. Driving 8-Bit Octave Synth Bass
        const bassFreq = MENU_BASS_PATTERN[step];
        if (bassFreq) {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(bassFreq, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1100, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.22, time + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.005, time + stepDuration * 0.8);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * 0.8);
        }

        // 3. Upbeat Arcade Title Drums (Kick, Snare & Hi-Hat ticks)
        if (step % 4 === 0) {
            const kickOsc = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();

            kickOsc.type = 'sine';
            kickOsc.frequency.setValueAtTime(135, time);
            kickOsc.frequency.exponentialRampToValueAtTime(32, time + 0.07);

            kickGain.gain.setValueAtTime(0.30, time);
            kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

            kickOsc.connect(kickGain);
            kickGain.connect(this.bgmGain);

            kickOsc.start(time);
            kickOsc.stop(time + 0.07);
        }

        if (step % 8 === 4 && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1200, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18, time);
            gain.gain.exponentialRampToValueAtTime(0.005, time + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            noise.start(time);
            noise.stop(time + 0.08);
        }

        if (step % 2 === 0 && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(7000, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.05, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            noise.start(time);
            noise.stop(time + 0.02);
        }
    }

    playGameStep(step, time, stepDuration) {
        const isLevel2 = this.currentLevel === 1;
        const isLevel3 = this.currentLevel === 2;
        const isLevel4 = this.currentLevel === 3;

        // 1. Synth Bass Channel (L1: Chiptune Triangle / L2: Resonant Synth / L3: Galloping Bass / L4: Ragtime Stride Bass)
        let bassPattern = BASS_PATTERN;
        if (isLevel2) bassPattern = BASS_PATTERN_L2;
        if (isLevel3) bassPattern = BASS_PATTERN_L3;
        if (isLevel4) bassPattern = BASS_PATTERN_L4;

        const bassFreq = bassPattern[step];
        if (bassFreq) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = (isLevel2 || isLevel3) ? 'sawtooth' : (isLevel4 ? 'triangle' : 'triangle');
            osc.frequency.setValueAtTime(bassFreq, time);

            filter.type = 'lowpass';
            if (isLevel2) {
                filter.Q.setValueAtTime(3.2, time);
                filter.frequency.setValueAtTime(900, time);
                filter.frequency.exponentialRampToValueAtTime(200, time + stepDuration * 0.9);
            } else if (isLevel3) {
                filter.Q.setValueAtTime(4.5, time);
                filter.frequency.setValueAtTime(1400, time);
                filter.frequency.exponentialRampToValueAtTime(250, time + stepDuration * 0.85);
            } else if (isLevel4) {
                filter.Q.setValueAtTime(2.0, time);
                filter.frequency.setValueAtTime(1200, time);
                filter.frequency.exponentialRampToValueAtTime(300, time + stepDuration * 0.75);
            } else {
                filter.frequency.setValueAtTime(800, time);
            }

            gain.gain.setValueAtTime(isLevel4 ? 0.30 : (isLevel2 ? 0.24 : (isLevel3 ? 0.26 : 0.28)), time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + stepDuration * 0.85);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + stepDuration * 0.85);
        }

        // 2. Lead Channel (L1: Square / L2: Detuned Saw / L3: Virtuoso Pulse+Sub / L4: Bright Ragtime Staccato Pulse)
        let melodyPattern = MELODY_PATTERN;
        if (isLevel2) melodyPattern = MELODY_PATTERN_L2;
        if (isLevel3) melodyPattern = MELODY_PATTERN_L3;
        if (isLevel4) melodyPattern = MELODY_PATTERN_L4;

        const leadFreq = melodyPattern[step];
        if (leadFreq) {
            if (isLevel4) {
                // Level 4 Instrument: Warm Ragtime Synth Lead (Smooth & Non-blippy)
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                // Osc 1: Warm Triangle fundamental for full melodic body
                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(leadFreq, time);

                // Osc 2: Smooth Sawtooth reinforcement with mild detune for vintage texture
                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(leadFreq * 1.002, time);

                // Warm Lowpass Filter: removes blippy high-frequency clicks while keeping melody vibrant
                filter.type = 'lowpass';
                filter.Q.setValueAtTime(2.2, time);
                filter.frequency.setValueAtTime(2200, time);
                filter.frequency.exponentialRampToValueAtTime(750, time + stepDuration * 0.85);

                // Soft 8ms attack and smooth exponential decay to prevent blips on note onset
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
                // Level 3 Instrument: Biting 8-Bit Virtuoso Storm Pulse + Sub-Harmonic Octave
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc1.type = 'square';
                osc1.frequency.setValueAtTime(leadFreq, time);

                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(leadFreq * 0.5, time); // Sub-octave reinforcement

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
                // Level 1 Instrument: Warm Chiptune Lead Wave with Anti-Click Envelope
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

        // 3. Retro Drums: Kick Drum
        // Level 4 uses a classic 2/4 Ragtime stride kick on beats 1 and 3 (steps 0 and 8), avoiding 4-on-the-floor
        const isKickStep = isLevel4 ? (step % 8 === 0) : (step % 4 === 0);
        if (isKickStep) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isLevel4 ? 125 : 140, time);
            osc.frequency.exponentialRampToValueAtTime(32, time + (isLevel4 ? 0.06 : 0.07));

            gain.gain.setValueAtTime(isLevel4 ? 0.32 : 0.35, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + (isLevel4 ? 0.06 : 0.07));

            osc.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(time);
            osc.stop(time + (isLevel4 ? 0.06 : 0.07));
        }

        // 4. Retro Drums: Snare Drum / Rimshot
        // Level 4 hits on beats 2 & 4 (steps 4 and 12), plus a syncopated ragtime rimshot tap on step 14
        const isSnareStep = isLevel4 ? (step % 8 === 4 || step % 16 === 14) : (step % 8 === 4);
        if (isSnareStep && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();

            if (isLevel4) {
                // Crisp Ragtime Rimshot / Woodblock Tap
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

        // 5. Retro Drums: Hi-Hat & Woodblock Ticks
        // Level 4 accents offbeats and offbeat 8ths for that authentic ragtime swing & stride feel
        const isHatStep = isLevel4
            ? (step % 2 === 0 || step % 4 === 1)
            : (step % 2 === 0 || ((isLevel2 || isLevel3) && step % 4 === 1));

        if (isHatStep && this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();

            if (isLevel4) {
                // Crisp Ragtime Woodblock / Choked Hi-Hat Ticks
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
                filter.frequency.setValueAtTime(isLevel3 ? 8000 : (isLevel2 ? 7000 : 6000), time);

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
