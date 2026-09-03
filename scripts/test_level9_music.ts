import assert from "node:assert/strict";
import { AudioManager } from "../js/audio/audioManager.js";
import { MusicSequencer } from "../js/audio/sequencer.js";
import { BASS_PATTERN_L9, MELODY_PATTERN_L9 } from "../js/audio/patterns.js";

console.log("🧪 Running Level 9 Music (Quantum Horizon) Unit Test Suite...\n");

// ---------------------------------------------------------
// 1. Test Pattern Lengths
// ---------------------------------------------------------
console.log("1️⃣  Testing L9 Pattern Lengths...");

assert.equal(BASS_PATTERN_L9.length, 192, "BASS_PATTERN_L9 should have exactly 192 steps");
assert.equal(MELODY_PATTERN_L9.length, 192, "MELODY_PATTERN_L9 should have exactly 192 steps");

console.log("   ✅ Both L9 patterns have 192 steps.");

// ---------------------------------------------------------
// 2. Test Note Validity (no missing NOTES keys, sane range)
// ---------------------------------------------------------
console.log("\n2️⃣  Testing L9 Note Frequencies...");

for (const [name, pattern] of [["bass", BASS_PATTERN_L9], ["melody", MELODY_PATTERN_L9]] as const) {
    pattern.forEach((freq, step) => {
        if (freq === null) return;
        assert.equal(typeof freq, "number", `${name} step ${step} should be a number (missing NOTES key?)`);
        assert.ok(Number.isFinite(freq), `${name} step ${step} should be finite`);
        assert.ok(freq >= 65 && freq <= 1900, `${name} step ${step} frequency ${freq} outside 65-1900 Hz`);
    });
}

console.log("   ✅ All L9 notes are finite numbers within 65-1900 Hz.");

// ---------------------------------------------------------
// 3. Test Pattern Density (rests present, not empty)
// ---------------------------------------------------------
console.log("\n3️⃣  Testing L9 Pattern Density...");

for (const [name, pattern] of [["bass", BASS_PATTERN_L9], ["melody", MELODY_PATTERN_L9]] as const) {
    const rests = pattern.filter((step) => step === null).length;
    const sounding = pattern.length - rests;
    assert.ok(rests > 0, `${name} pattern should contain rests (null)`);
    assert.ok(sounding >= 40, `${name} pattern should have at least 40 sounding steps, got ${sounding}`);
    console.log(`   🎵 ${name}: ${sounding} sounding steps, ${rests} rests.`);
}

console.log("   ✅ Both L9 patterns have rests and sufficient sounding steps.");

// ---------------------------------------------------------
// 4. Test Full Step-Through with Mocked AudioContext
// ---------------------------------------------------------
console.log("\n4️⃣  Testing Full 192-Step Playback of Stage 9 Track...");

const createdOscTypes: string[] = [];
let oscCount = 0;
let oscsThisStep = 0;
let maxOscsInOneStep = 0;
let bufferSourceCount = 0;

const mockParam = () => ({
    setValueAtTime: (_value: number, _time: number) => {},
    linearRampToValueAtTime: (_value: number, _time: number) => {},
    exponentialRampToValueAtTime: (_value: number, _time: number) => {},
});

const mockCtx = {
    currentTime: 0,
    createOscillator: () => {
        let oscType = "";
        oscCount++;
        oscsThisStep++;
        return {
            get type() { return oscType; },
            set type(value: string) { oscType = value; createdOscTypes.push(value); },
            frequency: mockParam(),
            connect: (_dest: any) => {},
            start: (_time: number) => {},
            stop: (_time: number) => {},
        };
    },
    createGain: () => ({
        gain: mockParam(),
        connect: (_dest: any) => {},
    }),
    createBiquadFilter: () => ({
        type: "",
        frequency: mockParam(),
        Q: mockParam(),
        connect: (_dest: any) => {},
    }),
    createBufferSource: () => {
        bufferSourceCount++;
        return {
            buffer: null,
            connect: (_dest: any) => {},
            start: (_time: number) => {},
            stop: (_time: number) => {},
        };
    },
};

const audio = new AudioManager();
audio.ctx = mockCtx as any;
audio.noiseBuffer = {} as any;

const sequencer = new MusicSequencer(audio);
sequencer.bgmGain = { connect: (_dest: any) => {}, gain: mockParam() } as any;
sequencer.currentTrack = "game_8";
sequencer.currentLevel = 8;
sequencer.isPlayingMusic = true;

const stepDuration = (60 / 100) / 4; // Stage 9 runs at 100 BPM
for (let step = 0; step < 192; step++) {
    oscsThisStep = 0;
    sequencer.playGameStep(step, step * stepDuration, stepDuration);
    maxOscsInOneStep = Math.max(maxOscsInOneStep, oscsThisStep);
}

assert.ok(oscCount > 0, "Oscillators should be created while stepping through the track");
const triangleCount = createdOscTypes.filter((type) => type === "triangle").length;
const sineCount = createdOscTypes.filter((type) => type === "sine").length;
assert.ok(triangleCount > 0, "Bass voice (triangle) should sound during the L9 track");
assert.ok(sineCount > 0, "Melody voice (sine) should sound during the L9 track");
assert.ok(bufferSourceCount > 0, "Noise-based drums (snare/hats) should sound during the L9 track");
assert.ok(maxOscsInOneStep >= 3, "L9 glass pad voice should create 3 oscillators for a single melody step");

console.log(`   🎹 Stepped through 192 steps: ${oscCount} oscillators (${triangleCount} triangle, ${sineCount} sine), ${bufferSourceCount} noise hits, max ${maxOscsInOneStep} oscs in one step.`);
console.log("   ✅ Full L9 playback completed without throwing.");

console.log("\n🎉 ALL LEVEL 9 MUSIC UNIT TESTS PASSED CLEANLY!");
