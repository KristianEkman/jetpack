import assert from "node:assert/strict";
import { AudioManager } from "../js/audio/audioManager.js";
import { MusicSequencer } from "../js/audio/sequencer.js";
import { BASS_PATTERN_L10, MELODY_PATTERN_L10 } from "../js/audio/patterns.js";
import { NOTES } from "../js/audio/notes.js";

console.log("🧪 Running Level 10 Music (Omega Core Blues) Unit Test Suite...\n");

// ---------------------------------------------------------
// 1. Test Pattern Lengths
// ---------------------------------------------------------
console.log("1️⃣  Testing L10 Pattern Lengths...");

assert.equal(BASS_PATTERN_L10.length, 192, "BASS_PATTERN_L10 should have exactly 192 steps");
assert.equal(MELODY_PATTERN_L10.length, 192, "MELODY_PATTERN_L10 should have exactly 192 steps");

console.log("   ✅ Both L10 patterns have 192 steps.");

// ---------------------------------------------------------
// 2. Test Note Validity (no missing NOTES keys, sane range)
// ---------------------------------------------------------
console.log("\n2️⃣  Testing L10 Note Frequencies...");

for (const [name, pattern] of [["bass", BASS_PATTERN_L10], ["melody", MELODY_PATTERN_L10]] as const) {
    pattern.forEach((freq, step) => {
        if (freq === null) return;
        assert.equal(typeof freq, "number", `${name} step ${step} should be a number (missing NOTES key?)`);
        assert.ok(Number.isFinite(freq), `${name} step ${step} should be finite`);
        assert.ok(freq >= 65 && freq <= 1900, `${name} step ${step} frequency ${freq} outside 65-1900 Hz`);
    });
}

console.log("   ✅ All L10 notes are finite numbers within 65-1900 Hz.");

// ---------------------------------------------------------
// 3. Test 12-Bar Blues Form (I-I-I-I, IV-IV-I-I, V-IV-I-V)
// ---------------------------------------------------------
console.log("\n3️⃣  Testing L10 12-Bar Blues Structure...");

const barRoots = [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176]
    .map((step) => BASS_PATTERN_L10[step]);
const expectedRoots = [
    NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2,   // bars 1-4: I (A7)
    NOTES.D3, NOTES.D3,                        // bars 5-6: IV (D7)
    NOTES.A2, NOTES.A2,                        // bars 7-8: I (A7)
    NOTES.E2,                                  // bar 9: V (E7)
    NOTES.D3,                                  // bar 10: IV (D7)
    NOTES.A2,                                  // bar 11: I (A7)
    NOTES.E2,                                  // bar 12: V (E7) turnaround
];
assert.deepEqual(barRoots, expectedRoots, "Bass bar roots should follow the 12-bar blues form in A");

const bluesScaleTones = new Set([
    NOTES.A4, NOTES.C5, NOTES.D5, NOTES.Ds5, NOTES.E5, NOTES.G5,
    NOTES.A5, NOTES.C6, NOTES.D6, NOTES.Ds6, NOTES.E6, NOTES.G6,
    NOTES.G4, NOTES.B4, NOTES.B5, // passing/turnaround color tones
]);
MELODY_PATTERN_L10.forEach((freq, step) => {
    if (freq === null) return;
    assert.ok(bluesScaleTones.has(freq), `melody step ${step} frequency ${freq} outside the A blues palette`);
});

console.log("   ✅ Bass follows the I-IV-V 12-bar blues form and melody stays in the A blues scale.");

// ---------------------------------------------------------
// 4. Test Pattern Density (rests present, not empty)
// ---------------------------------------------------------
console.log("\n4️⃣  Testing L10 Pattern Density...");

for (const [name, pattern] of [["bass", BASS_PATTERN_L10], ["melody", MELODY_PATTERN_L10]] as const) {
    const rests = pattern.filter((step) => step === null).length;
    const sounding = pattern.length - rests;
    assert.ok(rests > 0, `${name} pattern should contain rests (null)`);
    assert.ok(sounding >= 40, `${name} pattern should have at least 40 sounding steps, got ${sounding}`);
    console.log(`   🎵 ${name}: ${sounding} sounding steps, ${rests} rests.`);
}

console.log("   ✅ Both L10 patterns have rests and sufficient sounding steps.");

// ---------------------------------------------------------
// 5. Test Full Step-Through with Mocked AudioContext
// ---------------------------------------------------------
console.log("\n5️⃣  Testing Full 192-Step Playback of Stage 10 Track...");

const createdOscTypes: string[] = [];
let oscCount = 0;
let oscsThisStep = 0;
let maxOscsInOneStep = 0;
let bufferSourceCount = 0;
const bentLeadScoops: Array<{ start: number; end: number }> = [];

const mockParam = () => ({
    setValueAtTime: (_value: number, _time: number) => {},
    linearRampToValueAtTime: (_value: number, _time: number) => {},
    exponentialRampToValueAtTime: (_value: number, _time: number) => {},
});

const mockCtx = {
    currentTime: 0,
    createOscillator: () => {
        let oscType = "";
        let startFreq = 0;
        let endFreq = 0;
        oscCount++;
        oscsThisStep++;
        return {
            get type() { return oscType; },
            set type(value: string) { oscType = value; createdOscTypes.push(value); },
            frequency: {
                ...mockParam(),
                setValueAtTime: (value: number, _time: number) => { startFreq = value; },
                exponentialRampToValueAtTime: (value: number, _time: number) => {
                    endFreq = value;
                    if (startFreq > 100 && endFreq > startFreq * 1.05) {
                        bentLeadScoops.push({ start: startFreq, end: endFreq });
                    }
                },
            },
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
sequencer.currentTrack = "game_9";
sequencer.currentLevel = 9;
sequencer.isPlayingMusic = true;

const stepDuration = (60 / 96) / 4; // Stage 10 blues runs at 96 BPM
for (let step = 0; step < 192; step++) {
    oscsThisStep = 0;
    sequencer.playGameStep(step, step * stepDuration, stepDuration);
    maxOscsInOneStep = Math.max(maxOscsInOneStep, oscsThisStep);
}

assert.ok(oscCount > 0, "Oscillators should be created while stepping through the track");
const triangleCount = createdOscTypes.filter((type) => type === "triangle").length;
const squareCount = createdOscTypes.filter((type) => type === "square").length;
assert.ok(triangleCount > 0, "Bass voice (triangle) should sound during the L10 track");
assert.ok(squareCount > 0, "Blues lead voice (square) should sound during the L10 track");
assert.ok(bufferSourceCount > 0, "Noise-based drums (snare/hats) should sound during the L10 track");
assert.ok(maxOscsInOneStep >= 2, "L10 blues lead voice should create 2 oscillators for a single melody step");
assert.ok(bentLeadScoops.length > 0, "L10 blues lead should scoop up into its notes (blues bend)");

console.log(`   🎹 Stepped through 192 steps: ${oscCount} oscillators (${triangleCount} triangle, ${squareCount} square), ${bufferSourceCount} noise hits, ${bentLeadScoops.length} blues bends, max ${maxOscsInOneStep} oscs in one step.`);
console.log("   ✅ Full L10 playback completed without throwing.");

console.log("\n🎉 ALL LEVEL 10 MUSIC UNIT TESTS PASSED CLEANLY!");
