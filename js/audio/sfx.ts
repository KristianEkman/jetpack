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
    drainNodes: any[] | null;
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
        return this.audio.isMuted;
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

    // Emerald Chime
    playEmeraldPickup(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.04);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.04);
            gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + idx * 0.04 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.04 + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + idx * 0.04);
            osc.stop(this.ctx.currentTime + idx * 0.04 + 0.12);
        });
    }

    // Extra Life 1UP Chime
    playExtraLifePickup(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const notes = [NOTES.Fs5, NOTES.As5, NOTES.Cs6, NOTES.Fs6, NOTES.As6]; // Fs5, As5, Cs6, Fs6, As6 (F# Major arpeggio, 6 notes up from C5)
        notes.forEach((freq, idx) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.05);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.05);
            gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + idx * 0.05 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.05 + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + idx * 0.05);
            osc.stop(this.ctx.currentTime + idx * 0.05 + 0.18);
        });
    }

    // Rewarding fanfare when all diamonds are caught
    playAllDiamondsCaught(): void {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        const arpNotes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98, 2093.00];

        arpNotes.forEach((freq, idx) => {
            if (!this.ctx) return;
            const startTime = now + idx * 0.04;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.18);
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
                                if (node.stop) node.stop();
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
}
