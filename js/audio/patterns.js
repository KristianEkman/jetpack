/* ==========================================================================
   BGM MUSIC PATTERNS
   ========================================================================== */

import { NOTES } from './notes.js';

// 192-step 3-Chord Retro Progression (Changes every 2 cycles / 64 steps: i (Am) -> iv (Dm) -> V7 (E7))
export const BASS_PATTERN = [
    // --- CHORD 1: Am (i) - 2 cycles (steps 0 - 63) ---
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.D3, NOTES.A2, NOTES.C3, NOTES.G2,
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.E3, NOTES.D3, NOTES.C3, NOTES.G2,
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.D3, NOTES.A2, NOTES.C3, NOTES.G2,
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.E3, NOTES.D3, NOTES.C3, NOTES.G2,

    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.D3, NOTES.A2, NOTES.C3, NOTES.G2,
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.E3, NOTES.D3, NOTES.C3, NOTES.G2,
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.D3, NOTES.A2, NOTES.C3, NOTES.G2,
    NOTES.A2, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.E3, NOTES.G3, NOTES.A3, NOTES.G2,

    // --- CHORD 2: Dm (iv) - 2 cycles (steps 64 - 127) ---
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.G2, NOTES.D2, NOTES.F2, NOTES.C2,
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.A2, NOTES.G2, NOTES.F2, NOTES.C2,
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.G2, NOTES.D2, NOTES.F2, NOTES.C2,
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.A2, NOTES.G2, NOTES.F2, NOTES.C2,

    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.G2, NOTES.D2, NOTES.F2, NOTES.C2,
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.A2, NOTES.G2, NOTES.F2, NOTES.C2,
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.G2, NOTES.D2, NOTES.F2, NOTES.C2,
    NOTES.D2, NOTES.D2, NOTES.F2, NOTES.D2, NOTES.A2, NOTES.C3, NOTES.D3, NOTES.C2,

    // --- CHORD 3: E7 (V) - 2 cycles (steps 128 - 191) ---
    NOTES.E2, NOTES.E2, NOTES.Gs2, NOTES.E2, NOTES.B2, NOTES.E2, NOTES.Gs2, NOTES.D2,
    NOTES.E2, NOTES.E2, NOTES.Gs2, NOTES.E2, NOTES.E3, NOTES.D3, NOTES.B2, NOTES.Gs2,
    NOTES.E2, NOTES.E2, NOTES.Gs2, NOTES.E2, NOTES.B2, NOTES.E2, NOTES.Gs2, NOTES.D2,
    NOTES.E2, NOTES.E2, NOTES.Gs2, NOTES.E2, NOTES.E3, NOTES.D3, NOTES.B2, NOTES.Gs2,

    NOTES.E2, NOTES.E2, NOTES.Gs2, NOTES.B2, NOTES.E3, NOTES.B2, NOTES.Gs2, NOTES.E2,
    NOTES.E2, NOTES.Gs2, NOTES.B2, NOTES.E3, NOTES.Gs3, NOTES.E3, NOTES.B2, NOTES.Gs2,
    NOTES.E2, NOTES.E2, NOTES.Gs2, NOTES.Gs2, NOTES.A2, NOTES.A2, NOTES.B2, NOTES.B2,
    NOTES.C3, NOTES.C3, NOTES.D3, NOTES.E3, NOTES.Gs3, NOTES.E2, NOTES.G2, NOTES.Gs2
];

export const MELODY_PATTERN = [
    // --- CHORD 1: Am (i) ---
    NOTES.A4, null,     NOTES.C5, null,     NOTES.E5, null,     NOTES.D5, NOTES.C5,
    NOTES.A4, null,     NOTES.G4, NOTES.A4, NOTES.C5, null,     NOTES.B4, null,
    NOTES.F5, null,     NOTES.E5, null,     NOTES.D5, NOTES.C5, NOTES.D5, null,
    NOTES.E5, null,     NOTES.C5, null,     NOTES.A4, null,     null,     null,

    NOTES.A4, null,     NOTES.C5, null,     NOTES.E5, null,     NOTES.G5, NOTES.E5,
    NOTES.A5, null,     NOTES.G5, NOTES.A5, NOTES.E5, null,     NOTES.D5, null,
    NOTES.C5, null,     NOTES.D5, null,     NOTES.E5, NOTES.D5, NOTES.C5, null,
    NOTES.B4, null,     NOTES.C5, null,     NOTES.A4, null,     null,     null,

    // --- CHORD 2: Dm (iv) ---
    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,     NOTES.G5, NOTES.F5,
    NOTES.D5, null,     NOTES.C5, NOTES.D5, NOTES.F5, null,     NOTES.E5, null,
    NOTES.Bb4, null,    NOTES.A4, null,     NOTES.G4, NOTES.F4, NOTES.G4, null,
    NOTES.A4, null,     NOTES.F4, null,     NOTES.D4, null,     null,     null,

    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,     NOTES.C6, NOTES.A5,
    NOTES.D6, null,     NOTES.C6, NOTES.D6, NOTES.A5, null,     NOTES.G5, null,
    NOTES.F5, null,     NOTES.G5, null,     NOTES.A5, NOTES.G5, NOTES.F5, null,
    NOTES.E5, null,     NOTES.F5, null,     NOTES.D5, null,     null,     null,

    // --- CHORD 3: E7 (V) ---
    NOTES.E5, null,     NOTES.Gs5, null,    NOTES.B5, null,     NOTES.D6, NOTES.C6,
    NOTES.B5, null,     NOTES.A5, NOTES.Gs5, NOTES.A5, null,    NOTES.B5, null,
    NOTES.C6, null,     NOTES.B5, null,     NOTES.A5, NOTES.Gs5, NOTES.F5, null,
    NOTES.E5, null,     NOTES.D5, null,     NOTES.E5, null,     null,     null,

    NOTES.E5, null,     NOTES.Gs5, null,    NOTES.B5, null,     NOTES.D6, NOTES.C6,
    NOTES.B5, null,     NOTES.A5, NOTES.Gs5, NOTES.A5, null,    NOTES.B5, null,
    NOTES.C6, NOTES.B5, NOTES.A5, NOTES.Gs5, NOTES.F5, NOTES.E5, NOTES.D5, NOTES.C5,
    NOTES.B4, NOTES.A4, NOTES.Gs4, NOTES.B4, NOTES.A4, null,   null,     null
];

// --- LEVEL 2 TRACK: "Phase Shift Caverns" (192-step D Minor Phase Synthwave BGM) ---
export const BASS_PATTERN_L2 = [
    // --- Bar 1-4: Dm (Steps 0 - 63) ---
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.C3, NOTES.A2,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.C3, NOTES.D3, NOTES.C3,

    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.C3, NOTES.A2,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.D2, NOTES.F2, NOTES.A2, NOTES.D3, NOTES.F3, NOTES.D3, NOTES.A2, NOTES.F2,

    // --- Bar 5-8: Bb (Steps 64 - 127) ---
    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.D3, NOTES.C3,
    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.C3, NOTES.Bb2,
    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.D3, NOTES.C3,
    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.D3, NOTES.Bb2, NOTES.F2,

    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.D3, NOTES.C3,
    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.C3, NOTES.Bb2,
    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.D3, NOTES.C3,
    NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.Bb3, NOTES.D4, NOTES.Bb3, NOTES.F3, NOTES.D3,

    // --- Bar 9-10: C (Steps 128 - 159) ---
    NOTES.C2, NOTES.C3, NOTES.E3, NOTES.C3, NOTES.G3, NOTES.C3, NOTES.E3, NOTES.D3,
    NOTES.C2, NOTES.C3, NOTES.E3, NOTES.C3, NOTES.G3, NOTES.C3, NOTES.D3, NOTES.C3,
    NOTES.C2, NOTES.C3, NOTES.E3, NOTES.C3, NOTES.G3, NOTES.C3, NOTES.E3, NOTES.D3,
    NOTES.C2, NOTES.E3, NOTES.G3, NOTES.C4, NOTES.E4, NOTES.C4, NOTES.G3, NOTES.E3,

    // --- Bar 11-12: A7 (Steps 160 - 191) ---
    NOTES.A2, NOTES.A3, NOTES.Cs3, NOTES.A3, NOTES.E3, NOTES.A3, NOTES.Cs3, NOTES.B2,
    NOTES.A2, NOTES.A3, NOTES.Cs3, NOTES.A3, NOTES.E3, NOTES.A3, NOTES.G3, NOTES.E3,
    NOTES.A2, NOTES.Cs3, NOTES.E3, NOTES.G3, NOTES.A3, NOTES.G3, NOTES.E3, NOTES.Cs3,
    NOTES.A2, NOTES.A2, NOTES.B2, NOTES.Cs3, NOTES.D3, NOTES.E3, NOTES.F3, NOTES.G3
];

export const MELODY_PATTERN_L2 = [
    // --- Bar 1-4: Dm (Steps 0 - 63) - Phase Shift Lead Theme ---
    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, NOTES.F5, NOTES.D5, null,
    NOTES.F5, null,     NOTES.E5, NOTES.D5, NOTES.E5, null,     NOTES.C5, null,
    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,     NOTES.C6, NOTES.A5,
    NOTES.D6, null,     NOTES.C6, null,     NOTES.A5, null,     null,     null,

    NOTES.D5, NOTES.F5, NOTES.A5, null,     NOTES.D6, null,     NOTES.C6, NOTES.A5,
    NOTES.F5, null,     NOTES.G5, NOTES.A5, NOTES.F5, null,     NOTES.E5, null,
    NOTES.D5, null,     NOTES.E5, null,     NOTES.F5, NOTES.E5, NOTES.D5, null,
    NOTES.C5, null,     NOTES.E5, null,     NOTES.D5, null,     null,     null,

    // --- Bar 5-8: Bb (Steps 64 - 127) - Pulsing Crystal Rise ---
    NOTES.F5, null,     NOTES.Bb5, null,    NOTES.D6, NOTES.Bb5, NOTES.F5, null,
    NOTES.Bb5, null,    NOTES.A5, NOTES.G5, NOTES.A5, null,     NOTES.F5, null,
    NOTES.G5, null,     NOTES.Bb5, null,    NOTES.D6, null,     NOTES.F6, NOTES.D6,
    NOTES.F6, null,     NOTES.E6, null,     NOTES.D6, null,     null,     null,

    NOTES.Bb5, null,    NOTES.D6, null,     NOTES.F6, null,     NOTES.D6, NOTES.Bb5,
    NOTES.C6, null,     NOTES.Bb5, NOTES.C6, NOTES.D6, null,    NOTES.Bb5, null,
    NOTES.A5, null,     NOTES.Bb5, null,    NOTES.C6, NOTES.Bb5, NOTES.A5, null,
    NOTES.G5, null,     NOTES.A5, null,     NOTES.F5, null,     null,     null,

    // --- Bar 9-10: C (Steps 128 - 159) - Ascending Phase Drive ---
    NOTES.G5, null,     NOTES.C6, null,     NOTES.E6, NOTES.C6, NOTES.G5, null,
    NOTES.C6, null,     NOTES.B5, NOTES.A5, NOTES.B5, null,     NOTES.G5, null,
    NOTES.A5, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.G6, NOTES.E6,
    NOTES.G6, null,     NOTES.F6, null,     NOTES.E6, null,     null,     null,

    // --- Bar 11-12: A7 (Steps 160 - 191) - Harmonic Climax Run & Transition ---
    NOTES.E5, null,     NOTES.A5, null,     NOTES.Cs6, null,    NOTES.E6, NOTES.D6,
    NOTES.Cs6, null,    NOTES.B5, NOTES.A5, NOTES.B5, null,     NOTES.Cs6, null,
    NOTES.D6, NOTES.Cs6, NOTES.B5, NOTES.A5, NOTES.G5, NOTES.F5, NOTES.E5, NOTES.D5,
    NOTES.Cs5, NOTES.D5, NOTES.E5, NOTES.F5, NOTES.G5, NOTES.A5, NOTES.Cs6, null
];

// --- MENU TRACK (30 BPM, Dark Ambient Sci-Fi Beat) ---
export const MENU_BASS_PATTERN = [
    NOTES.C2, null, NOTES.G2, null, NOTES.C2, null, NOTES.Eb2, null,
    NOTES.Ab2, null, NOTES.C3, null, NOTES.Ab2, null, NOTES.Eb2, null,
    NOTES.F2, null, NOTES.C3, null, NOTES.F2, null, NOTES.Ab2, null,
    NOTES.G2, null, NOTES.D3, null, NOTES.G2, null, NOTES.F2, null
];

export const MENU_CHIME_PATTERN = [
    NOTES.C3, NOTES.Eb3, NOTES.G3, NOTES.C4, NOTES.Eb4, NOTES.C4, NOTES.G3, NOTES.Eb3,
    NOTES.Ab3, NOTES.C4, NOTES.Eb4, NOTES.Ab4, NOTES.C5, NOTES.Ab4, NOTES.Eb4, NOTES.C4,
    NOTES.F3, NOTES.Ab3, NOTES.C4, NOTES.F4, NOTES.Ab4, NOTES.F4, NOTES.C4, NOTES.Ab3,
    NOTES.G3, NOTES.B3, NOTES.D4, NOTES.F4, NOTES.G4, NOTES.F4, NOTES.D4, NOTES.B3
];
