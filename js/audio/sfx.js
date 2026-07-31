/* ==========================================================================
   SOUND EFFECTS SYNTHESIZER
   ========================================================================== */

export class SoundEffects {
    constructor(audioManager) {
        this.audio = audioManager;
        this.thrustGain = null;
        this.thrustNode = null;
        this.isThrusting = false;
        this.drainGain = null;
        this.drainNodes = null;
        this.isEnergyDraining = false;
    }

    get ctx() {
        return this.audio.ctx;
    }

    get isMuted() {
        return this.audio.isMuted;
    }

    // Play thrust noise
    startThrust() {
        if (this.isMuted || this.isThrusting) return;
        this.audio.init();
        if (!this.ctx) return;

        try {
            this.isThrusting = true;
            // Create white noise buffer for thruster sound
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

    stopThrust() {
        if (!this.isThrusting) return;
        this.isThrusting = false;
        if (this.thrustGain && this.ctx) {
            try {
                this.thrustGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
                setTimeout(() => {
                    if (this.thrustNode) {
                        this.thrustNode.stop();
                        this.thrustNode.disconnect();
                        this.thrustNode = null;
                    }
                }, 90);
            } catch (e) {
                // ignore
            }
        }
    }

    // Laser / Phase Shifter Sound
    playPhaseSound() {
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

    // Emerald Chime
    playEmeraldPickup() {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
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

    // Rewarding fanfare when all diamonds / 4 diamonds are caught
    playAllDiamondsCaught() {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // 1. Rapid ascending arpeggio (C Major 9 flourish)
        const arpNotes = [
            523.25,  // C5
            659.25,  // E5
            783.99,  // G5
            987.77,  // B5
            1046.50, // C6
            1318.51, // E6
            1567.98, // G6
            2093.00  // C7
        ];

        arpNotes.forEach((freq, idx) => {
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

        // 2. Triumphant sustained victory chord & shimmer (at peak of arpeggio)
        const chordTime = now + 0.24;
        const chordFreqs = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6

        chordFreqs.forEach((freq) => {
            // Primary tone
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

            // Detuned chorus tone for rich rewarding sparkle
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
    playFuelPickup() {
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
    playExplosion(isGameOver = false) {
        this.playDramaticDeath(isGameOver);
    }

    // Dramatic Multi-stage Death Synthesizer Sound Effect
    playDramaticDeath(isGameOver = false) {
        if (this.isMuted) return;
        this.audio.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Stage 1: Hit Crunch Transient
        try {
            const crunchOsc = this.ctx.createOscillator();
            const crunchGain = this.ctx.createGain();
            crunchOsc.type = 'sawtooth';
            crunchOsc.frequency.setValueAtTime(1400, now);
            crunchOsc.frequency.exponentialRampToValueAtTime(100, now + 0.08);

            crunchGain.gain.setValueAtTime(0.35, now);
            crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            crunchOsc.connect(crunchGain);
            crunchGain.connect(this.ctx.destination);
            crunchOsc.start(now);
            crunchOsc.stop(now + 0.08);
        } catch (e) {}

        // Stage 2: Speaker-Rumbling Sub-Bass Boom (85Hz -> 18Hz drop)
        try {
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(85, now + 0.01);
            subOsc.frequency.exponentialRampToValueAtTime(18, now + 0.8);

            subGain.gain.setValueAtTime(0.5, now + 0.01);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            subOsc.connect(subGain);
            subGain.connect(this.ctx.destination);
            subOsc.start(now + 0.01);
            subOsc.stop(now + 0.8);
        } catch (e) {}

        // Stage 3: Descending Death Wail / Synth Siren
        try {
            const sirenOsc1 = this.ctx.createOscillator();
            const sirenOsc2 = this.ctx.createOscillator();
            const sirenGain = this.ctx.createGain();

            sirenOsc1.type = 'sawtooth';
            sirenOsc2.type = 'square';

            sirenOsc1.frequency.setValueAtTime(1200, now + 0.05);
            sirenOsc1.frequency.exponentialRampToValueAtTime(80, now + 0.9);

            sirenOsc2.frequency.setValueAtTime(1210, now + 0.05);
            sirenOsc2.frequency.exponentialRampToValueAtTime(75, now + 0.9);

            const sirenFilter = this.ctx.createBiquadFilter();
            sirenFilter.type = 'lowpass';
            sirenFilter.frequency.setValueAtTime(2500, now);
            sirenFilter.frequency.exponentialRampToValueAtTime(200, now + 0.9);

            sirenGain.gain.setValueAtTime(0.22, now + 0.05);
            sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

            sirenOsc1.connect(sirenFilter);
            sirenOsc2.connect(sirenFilter);
            sirenFilter.connect(sirenGain);
            sirenGain.connect(this.ctx.destination);

            sirenOsc1.start(now + 0.05);
            sirenOsc2.start(now + 0.05);
            sirenOsc1.stop(now + 0.9);
            sirenOsc2.stop(now + 0.9);
        } catch (e) {}

        // Stage 4: Debris Crackle & Lowpass Noise Explosion
        try {
            const bufferSize = Math.floor(this.ctx.sampleRate * 1.4);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const decay = Math.pow(1 - i / bufferSize, 1.8);
                const pop = (Math.random() > 0.97 ? (Math.random() * 2 - 1) * 1.5 : 0);
                data[i] = ((Math.random() * 2 - 1) + pop) * decay;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(900, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(40, now + 1.4);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.38, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);

            noise.start(now);
        } catch (e) {}

        // Stage 5: Game Over Tragic Minor Chords (if 0 lives left) or Minor Drop Tone
        try {
            if (isGameOver) {
                const chordTime = now + 0.45;
                const notes = [261.63, 311.13, 392.00, 523.25]; // C4, Eb4, G4, C5 (C Minor)
                notes.forEach((freq) => {
                    const chordOsc = this.ctx.createOscillator();
                    const chordGain = this.ctx.createGain();

                    chordOsc.type = 'sawtooth';
                    chordOsc.frequency.setValueAtTime(freq, chordTime);
                    chordOsc.frequency.exponentialRampToValueAtTime(freq * 0.98, chordTime + 1.2);

                    const chordFilter = this.ctx.createBiquadFilter();
                    chordFilter.type = 'lowpass';
                    chordFilter.frequency.setValueAtTime(1200, chordTime);
                    chordFilter.frequency.exponentialRampToValueAtTime(150, chordTime + 1.2);

                    chordGain.gain.setValueAtTime(0, chordTime);
                    chordGain.gain.linearRampToValueAtTime(0.12, chordTime + 0.08);
                    chordGain.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.2);

                    chordOsc.connect(chordFilter);
                    chordFilter.connect(chordGain);
                    chordGain.connect(this.ctx.destination);

                    chordOsc.start(chordTime);
                    chordOsc.stop(chordTime + 1.2);
                });
            } else {
                const dropTime = now + 0.4;
                const dropOsc = this.ctx.createOscillator();
                const dropGain = this.ctx.createGain();
                dropOsc.type = 'triangle';
                dropOsc.frequency.setValueAtTime(329.63, dropTime);
                dropOsc.frequency.setValueAtTime(261.63, dropTime + 0.15);

                dropGain.gain.setValueAtTime(0.2, dropTime);
                dropGain.gain.exponentialRampToValueAtTime(0.001, dropTime + 0.5);

                dropOsc.connect(dropGain);
                dropGain.connect(this.ctx.destination);
                dropOsc.start(dropTime);
                dropOsc.stop(dropTime + 0.5);
            }
        } catch (e) {}
    }


    // Portal Active / Level Clear Fanfare
    playPortalWarp() {
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
    playTeleport() {
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
    startEnergyDrain() {
        if (this.isMuted || this.isEnergyDraining) return;
        this.audio.init();
        if (!this.ctx) return;

        try {
            this.isEnergyDraining = true;
            const now = this.ctx.currentTime;

            // Low frequency buzzing oscillator
            const osc1 = this.ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(140, now);

            // High frequency zapping oscillator
            const osc2 = this.ctx.createOscillator();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(280, now);

            // LFO for pulsating electric zaps
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sawtooth';
            lfo.frequency.setValueAtTime(16, now); // 16 Hz buzz rhythm

            const lfoGain = this.ctx.createGain();
            lfoGain.gain.setValueAtTime(80, now); // Pitch modulation depth

            lfo.connect(lfoGain);
            lfoGain.connect(osc1.frequency);
            lfoGain.connect(osc2.frequency);

            // Resonant bandpass filter for electrifying sound quality
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

    stopEnergyDrain() {
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
