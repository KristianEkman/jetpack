/* ==========================================================================
   SOUND EFFECTS SYNTHESIZER
   ========================================================================== */

import { AudioManager } from "./audioManager";
import { NOTES } from "./notes";

export class SoundEffects {
    audio: AudioManager;
    thrustGain: GainNode | null;
    thrustNode: AudioBufferSourceNode | null;
    isThrusting: boolean;
    drainGain: GainNode | null;
    drainNodes: (AudioScheduledSourceNode | AudioNode)[] | null;
    isEnergyDraining: boolean;

    constructor(audioManager: AudioManager) {
        this.audio = audioManager;
        this.thrustGain = null;
        this.thrustNode = null;
        this.isThrusting = false;
        this.drainGain = null;
        this.drainNodes = null;
        this.isEnergyDraining = false;
    }

    get ctx(): AudioContext | null {
        return this.audio.ctx;
    }

    get isMuted(): boolean {
        return this.audio.isSfxMuted;
    }

    // Play thrust noise
    startThrust(): void {
        if (this.isMuted || this.isThrusting) return;
        this.audio.init();
        if (!this.ctx) return;

        try {
            this.isThrusting = true;
            const bufferSize = this.ctx.sampleRate * 0.5;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = buffer;
            noiseNode.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, this.ctx.currentTime);

            this.thrustGain = this.ctx.createGain();
            this.thrustGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

            noiseNode.connect(filter);
            filter.connect(this.thrustGain);
            this.thrustGain.connect(this.ctx.destination);

            noiseNode.start();
            this.thrustNode = noiseNode;
        } catch (e) {
            console.warn('Audio thrust error:', e);
        }
    }

    stopThrust(): void {
        if (!this.isThrusting && !this.thrustNode) return;
        this.isThrusting = false;
        const nodeToStop = this.thrustNode;
        const gainToStop = this.thrustGain;
        this.thrustNode = null;
        this.thrustGain = null;

        if (gainToStop && this.ctx) {
            try {
                gainToStop.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
            } catch (e) {
                // ignore
            }
        }
        if (nodeToStop) {
            setTimeout(() => {
                try {
                    nodeToStop.stop();
                    nodeToStop.disconnect();
                } catch (e) {
                    // ignore
                }
            }, 90);
        }
    }

    // Laser / Phase Shifter Sound
    playPhaseSound(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // Phase brick dissolve / impact sound
    playPhaseImpact(): void {        
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const lowOsc = this.ctx.createOscillator();
        const highOsc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        lowOsc.type = 'square';
        lowOsc.frequency.setValueAtTime(520, now);
        lowOsc.frequency.exponentialRampToValueAtTime(90, now + 0.14);

        highOsc.type = 'sawtooth';
        highOsc.frequency.setValueAtTime(1200, now);
        highOsc.frequency.exponentialRampToValueAtTime(260, now + 0.09);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.14);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        lowOsc.connect(filter);
        highOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        lowOsc.start(now);
        highOsc.start(now);
        lowOsc.stop(now + 0.15);
        highOsc.stop(now + 0.1);
    }

    // Helper: Schedule an arpeggiated melodic tone sequence
    scheduleArpeggio(
        notes: number[],
        options: {
            stepTime?: number;
            duration?: number;
            type?: OscillatorType;
            peakGain?: number;
            getType?: (idx: number, total: number) => OscillatorType;
            startTimeOffset?: number;
        } = {},
    ): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime + (options.startTimeOffset || 0);
        const stepTime = options.stepTime ?? 0.04;
        const duration = options.duration ?? 0.12;
        const peakGain = options.peakGain ?? 0.15;
        const defaultType = options.type ?? 'sine';

        notes.forEach((freq, idx) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = options.getType ? options.getType(idx, notes.length) : defaultType;
            const startTime = now + idx * stepTime;
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Emerald Chime
    playEmeraldPickup(): void {
        this.scheduleArpeggio([523.25, 659.25, 783.99, 1046.50], {
            stepTime: 0.04,
            duration: 0.12,
            peakGain: 0.15,
            type: 'sine',
        });
    }

    // Extra Life 1UP Chime
    playExtraLifePickup(): void {
        this.scheduleArpeggio([NOTES.Fs5, NOTES.As5, NOTES.Cs6, NOTES.Fs6, NOTES.As6], {
            stepTime: 0.05,
            duration: 0.18,
            peakGain: 0.2,
            getType: (idx, len) => (idx === len - 1 ? 'triangle' : 'sine'),
        });
    }

    // Rapid Fire Power-Up Pickup Synth Chime
    playRapidFirePickup(): void {
        this.scheduleArpeggio([NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.E6, NOTES.G6], {
            stepTime: 0.035,
            duration: 0.15,
            peakGain: 0.18,
            type: 'sawtooth',
        });
    }

    // Rewarding fanfare when all diamonds are caught
    playAllDiamondsCaught(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const arpNotes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98, 2093.00];
        this.scheduleArpeggio(arpNotes, {
            stepTime: 0.04,
            duration: 0.18,
            peakGain: 0.2,
            type: 'triangle',
        });


        const chordTime = now + 0.24;
        const chordFreqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];

        chordFreqs.forEach((freq) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, chordTime);

            gain.gain.setValueAtTime(0, chordTime);
            gain.gain.linearRampToValueAtTime(0.12, chordTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(chordTime);
            osc.stop(chordTime + 0.6);

            const detunedOsc = this.ctx.createOscillator();
            const detunedGain = this.ctx.createGain();

            detunedOsc.type = 'triangle';
            detunedOsc.frequency.setValueAtTime(freq * 1.005, chordTime);

            detunedGain.gain.setValueAtTime(0, chordTime);
            detunedGain.gain.linearRampToValueAtTime(0.08, chordTime + 0.03);
            detunedGain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 0.5);

            detunedOsc.connect(detunedGain);
            detunedGain.connect(this.ctx.destination);

            detunedOsc.start(chordTime);
            detunedOsc.stop(chordTime + 0.5);
        });
    }

    // Grand victory fanfare when the entire campaign is completed
    playCampaignFanfare(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Two staggered ascending arpeggios (C major then D major, brighter second voice),
        // slightly delayed so they don't collide with the level's residual sounds
        const arpA = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
        const arpB = [587.33, 739.99, 880.00, 1174.66, 1479.98, 1760.00, 2349.32];
        this.scheduleArpeggio(arpA, {
            stepTime: 0.09,
            duration: 0.3,
            peakGain: 0.25,
            type: 'triangle',
            startTimeOffset: 0.15,
        });
        this.scheduleArpeggio(arpB, {
            stepTime: 0.09,
            duration: 0.3,
            peakGain: 0.15,
            type: 'square',
            startTimeOffset: 0.55,
        });

        // Deep bass root pulse under the finale chord
        const rootTime = now + 1.3;
        [130.81, 196.00].forEach((freq) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, rootTime);

            gain.gain.setValueAtTime(0, rootTime);
            gain.gain.linearRampToValueAtTime(0.22, rootTime + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.0001, rootTime + 2.0);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(rootTime);
            osc.stop(rootTime + 2.0);
        });

        // Long sustained finale chord with detuned shimmer
        const chordTime = now + 1.3;
        const chordFreqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];

        chordFreqs.forEach((freq) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, chordTime);

            gain.gain.setValueAtTime(0, chordTime);
            gain.gain.linearRampToValueAtTime(0.11, chordTime + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 2.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(chordTime);
            osc.stop(chordTime + 2.2);

            const detunedOsc = this.ctx.createOscillator();
            const detunedGain = this.ctx.createGain();

            detunedOsc.type = 'triangle';
            detunedOsc.frequency.setValueAtTime(freq * 1.005, chordTime);

            detunedGain.gain.setValueAtTime(0, chordTime);
            detunedGain.gain.linearRampToValueAtTime(0.07, chordTime + 0.06);
            detunedGain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 1.8);

            detunedOsc.connect(detunedGain);
            detunedGain.connect(this.ctx.destination);

            detunedOsc.start(chordTime);
            detunedOsc.stop(chordTime + 1.8);
        });
    }

    // Fuel Pickup Sound
    playFuelPickup(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(900, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // Explosion / Damage Sound
    playExplosion(isGameOver: boolean = false): void {
        this.playDramaticDeath(isGameOver);
    }

    // Dramatic Multi-stage Death Synthesizer Sound Effect
    playDramaticDeath(isGameOver: boolean = false): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        try {
            const impactOsc = this.ctx.createOscillator();
            const impactGain = this.ctx.createGain();
            const impactFilter = this.ctx.createBiquadFilter();

            impactOsc.type = 'square';
            impactOsc.frequency.setValueAtTime(220, now);
            impactOsc.frequency.exponentialRampToValueAtTime(40, now + 0.16);

            impactFilter.type = 'bandpass';
            impactFilter.frequency.setValueAtTime(1800, now);
            impactFilter.frequency.exponentialRampToValueAtTime(260, now + 0.16);
            impactFilter.Q.setValueAtTime(1.6, now);

            impactGain.gain.setValueAtTime(0.0001, now);
            impactGain.gain.linearRampToValueAtTime(0.75, now + 0.005);
            impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

            impactOsc.connect(impactFilter);
            impactFilter.connect(impactGain);
            impactGain.connect(this.ctx.destination);

            impactOsc.start(now);
            impactOsc.stop(now + 0.16);
        } catch (e) {}

        try {
            const crunchOsc = this.ctx.createOscillator();
            const crunchGain = this.ctx.createGain();
            crunchOsc.type = 'sawtooth';
            crunchOsc.frequency.setValueAtTime(1600, now);
            crunchOsc.frequency.exponentialRampToValueAtTime(90, now + 0.11);

            crunchGain.gain.setValueAtTime(0.6, now);
            crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

            crunchOsc.connect(crunchGain);
            crunchGain.connect(this.ctx.destination);
            crunchOsc.start(now);
            crunchOsc.stop(now + 0.11);
        } catch (e) {}

        try {
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(90, now + 0.01);
            subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.95);

            subGain.gain.setValueAtTime(0.7, now + 0.01);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

            subOsc.connect(subGain);
            subGain.connect(this.ctx.destination);
            subOsc.start(now + 0.01);
            subOsc.stop(now + 0.95);
        } catch (e) {}

        try {
            const sirenOsc1 = this.ctx.createOscillator();
            const sirenOsc2 = this.ctx.createOscillator();
            const sirenGain = this.ctx.createGain();

            sirenOsc1.type = 'sawtooth';
            sirenOsc2.type = 'square';

            sirenOsc1.frequency.setValueAtTime(1400, now + 0.04);
            sirenOsc1.frequency.exponentialRampToValueAtTime(70, now + 1.0);

            sirenOsc2.frequency.setValueAtTime(1420, now + 0.04);
            sirenOsc2.frequency.exponentialRampToValueAtTime(65, now + 1.0);

            const sirenFilter = this.ctx.createBiquadFilter();
            sirenFilter.type = 'lowpass';
            sirenFilter.frequency.setValueAtTime(3200, now);
            sirenFilter.frequency.exponentialRampToValueAtTime(180, now + 1.0);

            sirenGain.gain.setValueAtTime(0.3, now + 0.04);
            sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

            sirenOsc1.connect(sirenFilter);
            sirenOsc2.connect(sirenFilter);
            sirenFilter.connect(sirenGain);
            sirenGain.connect(this.ctx.destination);

            sirenOsc1.start(now + 0.04);
            sirenOsc2.start(now + 0.04);
            sirenOsc1.stop(now + 1.0);
            sirenOsc2.stop(now + 1.0);
        } catch (e) {}

        try {
            const bufferSize = Math.floor(this.ctx.sampleRate * 1.6);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const decay = Math.pow(1 - i / bufferSize, 1.3);
                const pop = (Math.random() > 0.95 ? (Math.random() * 2 - 1) * 2.0 : 0);
                data[i] = ((Math.random() * 2 - 1) + pop) * decay;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(1400, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(60, now + 1.6);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);

            noise.start(now);
        } catch (e) {}

        try {
            if (isGameOver) {
                const chordTime = now + 0.45;
                const notes = [261.63, 311.13, 392.00, 523.25, 587.33];
                notes.forEach((freq) => {
                    if (!this.ctx) return;
                    const chordOsc = this.ctx.createOscillator();
                    const chordGain = this.ctx.createGain();

                    chordOsc.type = 'sawtooth';
                    chordOsc.frequency.setValueAtTime(freq, chordTime);
                    chordOsc.frequency.exponentialRampToValueAtTime(freq * 0.97, chordTime + 1.4);

                    const chordFilter = this.ctx.createBiquadFilter();
                    chordFilter.type = 'lowpass';
                    chordFilter.frequency.setValueAtTime(1600, chordTime);
                    chordFilter.frequency.exponentialRampToValueAtTime(180, chordTime + 1.4);

                    chordGain.gain.setValueAtTime(0, chordTime);
                    chordGain.gain.linearRampToValueAtTime(0.16, chordTime + 0.08);
                    chordGain.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.4);

                    chordOsc.connect(chordFilter);
                    chordFilter.connect(chordGain);
                    chordGain.connect(this.ctx.destination);

                    chordOsc.start(chordTime);
                    chordOsc.stop(chordTime + 1.4);
                });
            } else {
                const dropTime = now + 0.4;
                const dropOsc = this.ctx.createOscillator();
                const dropGain = this.ctx.createGain();
                dropOsc.type = 'triangle';
                dropOsc.frequency.setValueAtTime(392.0, dropTime);
                dropOsc.frequency.exponentialRampToValueAtTime(261.63, dropTime + 0.18);

                dropGain.gain.setValueAtTime(0.28, dropTime);
                dropGain.gain.exponentialRampToValueAtTime(0.001, dropTime + 0.6);

                dropOsc.connect(dropGain);
                dropGain.connect(this.ctx.destination);
                dropOsc.start(dropTime);
                dropOsc.stop(dropTime + 0.6);
            }
        } catch (e) {}
    }

    // Portal Active / Level Clear Fanfare
    playPortalWarp(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.4);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    // Teleporter Warp Sound Effect
    playTeleport(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.25);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.25);
        osc2.stop(this.ctx.currentTime + 0.25);
    }

    // Sci-fi Player Respawn Re-materialization Sound Effect
    playRespawn(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(260, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.3);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(520, now);
        osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.3);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
    }

    // Energy Drain hazard sound loop
    startEnergyDrain(): void {
        if (this.isMuted || this.isEnergyDraining) return;
        this.audio.init();
        if (!this.ctx) return;

        try {
            this.isEnergyDraining = true;
            const now = this.ctx.currentTime;

            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(140, now);

            const osc2 = this.ctx.createOscillator();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(280, now);

            const lfo = this.ctx.createOscillator();
            lfo.type = 'sawtooth';
            lfo.frequency.setValueAtTime(16, now);

            const lfoGain = this.ctx.createGain();
            lfoGain.gain.setValueAtTime(80, now);

            lfo.connect(lfoGain);
            lfoGain.connect(osc1.frequency);
            lfoGain.connect(osc2.frequency);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, now);
            filter.Q.setValueAtTime(3.5, now);

            this.drainGain = this.ctx.createGain();
            this.drainGain.gain.setValueAtTime(0.0001, now);
            this.drainGain.gain.linearRampToValueAtTime(0.12, now + 0.03);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(this.drainGain);
            this.drainGain.connect(this.ctx.destination);

            osc1.start(now);
            osc2.start(now);
            lfo.start(now);

            this.drainNodes = [osc1, osc2, lfo, filter];
        } catch (e) {
            console.warn('Audio energy drain error:', e);
        }
    }

    stopEnergyDrain(): void {
        if (!this.isEnergyDraining) return;
        this.isEnergyDraining = false;
        if (this.drainGain && this.ctx) {
            try {
                const now = this.ctx.currentTime;
                this.drainGain.gain.cancelScheduledValues(now);
                this.drainGain.gain.setValueAtTime(this.drainGain.gain.value, now);
                this.drainGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
                const nodesToStop = this.drainNodes;
                this.drainNodes = null;
                setTimeout(() => {
                    if (nodesToStop) {
                        nodesToStop.forEach(node => {
                            try {
                                if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
                                    (node as AudioScheduledSourceNode).stop();
                                }
                                node.disconnect();
                            } catch (err) {}
                        });
                    }
                }, 60);
            } catch (e) {
                // ignore
            }
        }
    }

    // Spread Cannon (Tri-Beam Energy Burst)
    playSpreadShotSound(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = [740, 980, 1320];

        freqs.forEach((freq, idx) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.25, now + 0.12);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        });
    }

    // Plasma Grenade Launch (Pneumatic Mortar Pop)
    playGrenadeLaunchSound(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.16);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.16);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    // Cluster Grenade / Plasma Blast AoE Explosion
    playClusterExplosionSound(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Sub-bass heavy drop
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(180, now);
        subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

        subGain.gain.setValueAtTime(0.25, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.4);

        // Distorted noise burst
        try {
            const bufferSize = this.ctx.sampleRate * 0.35;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.frequency.exponentialRampToValueAtTime(150, now + 0.35);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.2, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);

            noise.start(now);
        } catch (e) {
            // fallback
        }
    }

    // Seeker Missile Launch (Lock-on Chirp + Rocket Ignition)
    playMissileLaunchSound(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Lock-on double chirp
        const chirpOsc = this.ctx.createOscillator();
        const chirpGain = this.ctx.createGain();
        chirpOsc.type = 'sine';
        chirpOsc.frequency.setValueAtTime(1800, now);
        chirpOsc.frequency.setValueAtTime(2400, now + 0.03);

        chirpGain.gain.setValueAtTime(0.08, now);
        chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        chirpOsc.connect(chirpGain);
        chirpGain.connect(this.ctx.destination);
        chirpOsc.start(now);
        chirpOsc.stop(now + 0.08);

        // Rocket booster thrust sweep
        const rocketOsc = this.ctx.createOscillator();
        const rocketFilter = this.ctx.createBiquadFilter();
        const rocketGain = this.ctx.createGain();

        rocketOsc.type = 'sawtooth';
        rocketOsc.frequency.setValueAtTime(220, now + 0.04);
        rocketOsc.frequency.exponentialRampToValueAtTime(680, now + 0.22);

        rocketFilter.type = 'bandpass';
        rocketFilter.frequency.setValueAtTime(600, now + 0.04);
        rocketFilter.frequency.exponentialRampToValueAtTime(1600, now + 0.22);
        rocketFilter.Q.setValueAtTime(2.0, now + 0.04);

        rocketGain.gain.setValueAtTime(0.001, now);
        rocketGain.gain.linearRampToValueAtTime(0.14, now + 0.06);
        rocketGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        rocketOsc.connect(rocketFilter);
        rocketFilter.connect(rocketGain);
        rocketGain.connect(this.ctx.destination);

        rocketOsc.start(now + 0.04);
        rocketOsc.stop(now + 0.24);
    }

    // Weapon Pickup Jingle (Futuristic Equip Chime)
    playWeaponPickupSound(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            if (!this.ctx) return;
            const t = now + i * 0.05;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.18);
        });
    }
}
