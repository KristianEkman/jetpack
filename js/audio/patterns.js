/* ==========================================================================
   BGM MUSIC PATTERNS
   ========================================================================== */

import { NOTES } from './notes.js';

// 192-step Retro Chiptune Adaptation: "In the Hall of the Mountain King" (Edvard Grieg)
export const BASS_PATTERN = [
    // --- Phase 1: Marching Staccato Bass (Steps 0 - 63) ---
    NOTES.A2, null, NOTES.A2, null, NOTES.C3, null, NOTES.A2, null,
    NOTES.E3, null, NOTES.C3, null, NOTES.E2, null, NOTES.G2, null,
    NOTES.E2, null, NOTES.Gs2, null, NOTES.B2, null, NOTES.E2, null,
    NOTES.G2, null, NOTES.C3, null, NOTES.G2, null, NOTES.E2, null,

    NOTES.A2, null, NOTES.A2, null, NOTES.C3, null, NOTES.A2, null,
    NOTES.E3, null, NOTES.C3, null, NOTES.E3, null, NOTES.A2, null,
    NOTES.G2, null, NOTES.E2, null, NOTES.C2, null, NOTES.E2, null,
    NOTES.G2, null, NOTES.B2, null, NOTES.E2, null, NOTES.G2, null,

    // --- Phase 2: Driving Octave Bass (Steps 64 - 127) ---
    NOTES.A2, NOTES.A3, NOTES.A2, NOTES.A3, NOTES.C3, NOTES.C4, NOTES.A2, NOTES.A3,
    NOTES.E3, NOTES.E4, NOTES.C3, NOTES.C4, NOTES.E2, NOTES.E3, NOTES.G2, NOTES.G3,
    NOTES.E2, NOTES.E3, NOTES.Gs2, NOTES.Gs3, NOTES.B2, NOTES.B3, NOTES.E2, NOTES.E3,
    NOTES.G2, NOTES.G3, NOTES.C3, NOTES.C4, NOTES.G2, NOTES.G3, NOTES.E2, NOTES.E3,

    NOTES.A2, NOTES.A3, NOTES.A2, NOTES.A3, NOTES.C3, NOTES.C4, NOTES.A2, NOTES.A3,
    NOTES.E3, NOTES.E4, NOTES.C3, NOTES.C4, NOTES.E3, NOTES.E4, NOTES.A2, NOTES.A3,
    NOTES.G2, NOTES.G3, NOTES.E2, NOTES.E3, NOTES.C2, NOTES.C3, NOTES.E2, NOTES.E3,
    NOTES.G2, NOTES.G3, NOTES.B2, NOTES.B3, NOTES.E2, NOTES.E3, NOTES.G2, NOTES.G3,

    // --- Phase 3: Crescendo Pulse & Finale (Steps 128 - 191) ---
    NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2,
    NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2,
    NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2,
    NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2,

    NOTES.E2, null,     NOTES.E2, null,     NOTES.E2, null,     NOTES.E2, null,
    NOTES.D2, null,     NOTES.D2, null,     NOTES.C2, null,     NOTES.B2, null,
    NOTES.A2, NOTES.C3, NOTES.E3, NOTES.A3, NOTES.E3, NOTES.C3, NOTES.G2, NOTES.E2,
    NOTES.A2, null,     NOTES.A2, null,     NOTES.A2, null,     null,     null
];

export const MELODY_PATTERN = [
    // --- Phase 1: Lower Octave Theme (Steps 0 - 63) ---
    // Bar 1 (Steps 0 - 15)
    NOTES.A4, null,     NOTES.B4, null,     NOTES.C5, null,     NOTES.D5, null,
    NOTES.E5, null,     NOTES.C5, null,     NOTES.E5, null,     null,     null,
    // Bar 2 (Steps 16 - 31)
    NOTES.Gs4, null,    NOTES.E5, null,     NOTES.Gs4, null,    null,     null,
    NOTES.G4, null,     NOTES.Eb5, null,    NOTES.G4, null,     null,     null,
    // Bar 3 (Steps 32 - 47)
    NOTES.A4, null,     NOTES.B4, null,     NOTES.C5, null,     NOTES.D5, null,
    NOTES.E5, null,     NOTES.C5, null,     NOTES.E5, null,     NOTES.A5, null,
    // Bar 4 (Steps 48 - 63)
    NOTES.G5, null,     NOTES.E5, null,     NOTES.C5, null,     NOTES.E5, null,
    NOTES.G5, null,     null,     null,     NOTES.E5, null,     null,     null,

    // --- Phase 2: High Octave Intensity Rise (Steps 64 - 127) ---
    // Bar 5 (Steps 64 - 79)
    NOTES.A5, null,     NOTES.B5, null,     NOTES.C6, null,     NOTES.D6, null,
    NOTES.E6, null,     NOTES.C6, null,     NOTES.E6, null,     null,     null,
    // Bar 6 (Steps 80 - 95)
    NOTES.Gs5, null,    NOTES.E6, null,     NOTES.Gs5, null,    null,     null,
    NOTES.G5, null,     NOTES.Eb5, null,    NOTES.G5, null,     null,     null,
    // Bar 7 (Steps 96 - 111)
    NOTES.A5, null,     NOTES.B5, null,     NOTES.C6, null,     NOTES.D6, null,
    NOTES.E6, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.A5, null,
    // Bar 8 (Steps 112 - 127)
    NOTES.G5, null,     NOTES.E5, null,     NOTES.C5, null,     NOTES.E5, null,
    NOTES.G5, null,     null,     null,     NOTES.E5, null,     null,     null,

    // --- Phase 3: Accelerating Crescendo & Climax (Steps 128 - 191) ---
    // Bar 9 (Steps 128 - 143: Fast 16th Ascending Run)
    NOTES.A4, NOTES.B4, NOTES.C5, NOTES.D5, NOTES.E5, NOTES.F5, NOTES.E5, NOTES.D5,
    NOTES.C5, NOTES.B4, NOTES.A4, NOTES.Gs4, NOTES.A4, NOTES.B4, NOTES.C5, NOTES.D5,
    // Bar 10 (Steps 144 - 159: Fast Octave Run Up)
    NOTES.E5, NOTES.F5, NOTES.Fs5, NOTES.Gs5, NOTES.A5, NOTES.B5, NOTES.C6, NOTES.D6,
    NOTES.E6, NOTES.D6, NOTES.C6, NOTES.B5, NOTES.A5, NOTES.Gs5, NOTES.F5, NOTES.E5,
    // Bar 11 (Steps 160 - 175: Staccato Tutti Hits)
    NOTES.E5, null,     NOTES.E5, null,     NOTES.E5, null,     NOTES.E5, null,
    NOTES.D5, null,     NOTES.D5, null,     NOTES.C5, null,     NOTES.B4, null,
    // Bar 12 (Steps 176 - 191: Grand Finale Cadence)
    NOTES.A4, NOTES.C5, NOTES.E5, NOTES.A5, NOTES.Gs5, NOTES.E5, NOTES.B4, NOTES.Gs4,
    NOTES.A4, null,     NOTES.A4, null,     NOTES.A4, null,     null,     null
];

// --- LEVEL 2 TRACK: "Hungarian Dance No. 5" (Johannes Brahms - 192-step D Minor Resonant Synth Adaptation) ---
export const BASS_PATTERN_L2 = [
    // --- Phase 1: Marching Dm / A7 Bass Drive (Steps 0 - 63) ---
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.C3, NOTES.A2,
    NOTES.A2, NOTES.A3, NOTES.Cs3, NOTES.A3, NOTES.E3, NOTES.A3, NOTES.G3, NOTES.E3,
    NOTES.A2, NOTES.Cs3, NOTES.E3, NOTES.G3, NOTES.A3, NOTES.G3, NOTES.E3, NOTES.Cs3,

    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.C3, NOTES.A2,
    NOTES.A2, NOTES.A3, NOTES.Cs3, NOTES.A3, NOTES.E3, NOTES.A3, NOTES.G3, NOTES.E3,
    NOTES.D2, NOTES.F2, NOTES.A2, NOTES.D3, NOTES.F3, NOTES.D3, NOTES.A2, NOTES.F2,

    // --- Phase 2: Octave Bouncing Synth Bass (Steps 64 - 127) ---
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.C3,
    NOTES.A2, NOTES.A3, NOTES.Cs3, NOTES.A3, NOTES.E3, NOTES.A3, NOTES.G3, NOTES.E3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.C3, NOTES.A2,
    NOTES.D2, NOTES.F2, NOTES.A2, NOTES.D3, NOTES.F3, NOTES.D3, NOTES.A2, NOTES.F2,

    NOTES.Bb2, NOTES.Bb3, NOTES.D3, NOTES.Bb3, NOTES.F3, NOTES.Bb3, NOTES.D3, NOTES.C3,
    NOTES.C2, NOTES.C3, NOTES.E3, NOTES.C3, NOTES.G3, NOTES.C3, NOTES.E3, NOTES.D3,
    NOTES.A2, NOTES.A3, NOTES.Cs3, NOTES.A3, NOTES.E3, NOTES.A3, NOTES.G3, NOTES.E3,
    NOTES.D2, NOTES.D3, NOTES.F2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.F2, NOTES.D2,

    // --- Phase 3: Virtuoso Crescendo & Fast Bass Drive (Steps 128 - 191) ---
    NOTES.D2, NOTES.D2, NOTES.D2, NOTES.D2, NOTES.D2, NOTES.D2, NOTES.D2, NOTES.D2,
    NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2,
    NOTES.D2, NOTES.D2, NOTES.D2, NOTES.D2, NOTES.F2, NOTES.F2, NOTES.A2, NOTES.A2,
    NOTES.G2, NOTES.G2, NOTES.E2, NOTES.E2, NOTES.A2, NOTES.A2, NOTES.A2, NOTES.A2,

    NOTES.D2, null,     NOTES.D2, null,     NOTES.D2, null,     NOTES.D2, null,
    NOTES.A2, null,     NOTES.A2, null,     NOTES.A2, null,     NOTES.A2, null,
    NOTES.D2, NOTES.F2, NOTES.A2, NOTES.D3, NOTES.F3, NOTES.D3, NOTES.A2, NOTES.F2,
    NOTES.D2, null,     NOTES.D2, null,     NOTES.D2, null,     null,     null
];

export const MELODY_PATTERN_L2 = [
    // --- Phase 1: Hungarian Dance Main Theme (Steps 0 - 63) ---
    // Bar 1 (Steps 0 - 15)
    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,     null,     null,
    NOTES.F5, null,     NOTES.D5, null,     NOTES.A4, null,     NOTES.F4, null,
    // Bar 2 (Steps 16 - 31)
    NOTES.E4, null,     NOTES.G4, null,     NOTES.Bb4, null,    null,     null,
    NOTES.G4, null,     NOTES.E4, null,     NOTES.Cs4, null,    NOTES.E4, null,
    // Bar 3 (Steps 32 - 47)
    NOTES.D4, null,     NOTES.F4, null,     NOTES.A4, null,     NOTES.D5, null,
    NOTES.F5, null,     null,     null,     NOTES.E5, null,     NOTES.D5, null,
    // Bar 4 (Steps 48 - 63)
    NOTES.Cs5, null,    null,     null,     NOTES.E5, null,     null,     null,
    NOTES.D5, null,     null,     null,     null,     null,     null,     null,

    // --- Phase 2: Octave Jump & High Energy Syncopation (Steps 64 - 127) ---
    // Bar 5 (Steps 64 - 79)
    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,     null,     null,
    NOTES.F5, null,     NOTES.D5, null,     NOTES.A5, null,     NOTES.D6, null,
    // Bar 6 (Steps 80 - 95)
    NOTES.E5, null,     NOTES.G5, null,     NOTES.Bb5, null,    null,     null,
    NOTES.G5, null,     NOTES.E5, null,     NOTES.Cs5, null,    NOTES.E5, null,
    // Bar 7 (Steps 96 - 111)
    NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,     NOTES.D6, null,
    NOTES.F6, null,     NOTES.E6, null,     NOTES.D6, null,     NOTES.Cs6, null,
    // Bar 8 (Steps 112 - 127)
    NOTES.D6, null,     null,     null,     NOTES.A5, null,     NOTES.F5, null,
    NOTES.D5, null,     NOTES.A4, null,     null,     null,     null,     null,

    // --- Phase 3: Virtuoso 16th Run & Climax (Steps 128 - 191) ---
    // Bar 9 (Steps 128 - 143: Fast 16th Ascending Bounce)
    NOTES.D5, NOTES.F5, NOTES.A5, NOTES.D6, NOTES.Cs6, NOTES.D6, NOTES.E6, NOTES.D6,
    NOTES.Bb5, NOTES.G5, NOTES.E5, NOTES.Cs5, NOTES.D5, NOTES.E5, NOTES.F5, NOTES.G5,
    // Bar 10 (Steps 144 - 159: Arpeggio Cascade)
    NOTES.A5, NOTES.D6, NOTES.F6, NOTES.D6, NOTES.A5, NOTES.F5, NOTES.D5, NOTES.A4,
    NOTES.G4, NOTES.Bb4, NOTES.E5, NOTES.G5, NOTES.Bb5, NOTES.A5, NOTES.G5, NOTES.E5,
    // Bar 11 (Steps 160 - 175: Staccato Resonant Hits)
    NOTES.F5, null,     NOTES.D5, null,     NOTES.F5, null,     NOTES.A5, null,
    NOTES.G5, null,     NOTES.E5, null,     NOTES.Cs5, null,    NOTES.A4, null,
    // Bar 12 (Steps 176 - 191: Grand Finale Cadence)
    NOTES.D5, NOTES.E5, NOTES.F5, NOTES.G5, NOTES.A5, NOTES.Bb5, NOTES.Cs6, NOTES.D6,
    NOTES.D6, null,     NOTES.D5, null,     NOTES.D4, null,     null,     null
];

// --- LEVEL 3 TRACK: "Storm - Summer Presto" (Antonio Vivaldi - 192-step E Minor Chiptune Storm Adaptation) ---
export const BASS_PATTERN_L3 = [
    // --- Phase 1: Rapid 16th Pulse Bass (Steps 0 - 63) ---
    NOTES.E2, NOTES.E2, NOTES.B2, NOTES.E2, NOTES.G2, NOTES.E2, NOTES.B2, NOTES.E2,
    NOTES.E2, NOTES.E2, NOTES.B2, NOTES.E2, NOTES.G2, NOTES.E2, NOTES.B2, NOTES.E2,
    NOTES.E2, NOTES.E2, NOTES.B2, NOTES.E2, NOTES.G2, NOTES.E2, NOTES.B2, NOTES.E2,
    NOTES.E2, NOTES.E2, NOTES.B2, NOTES.E2, NOTES.G2, NOTES.E2, NOTES.Fs2, NOTES.G2,

    NOTES.A2, NOTES.A2, NOTES.E3, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.E3, NOTES.A2,
    NOTES.A2, NOTES.A2, NOTES.E3, NOTES.A2, NOTES.C3, NOTES.A2, NOTES.E3, NOTES.A2,
    NOTES.B2, NOTES.B2, NOTES.Fs3, NOTES.B2, NOTES.Ds3, NOTES.B2, NOTES.Fs3, NOTES.B2,
    NOTES.E2, NOTES.G2, NOTES.B2, NOTES.E3, NOTES.G3, NOTES.E3, NOTES.B2, NOTES.G2,

    // --- Phase 2: Virtuoso Driving Bass (Steps 64 - 127) ---
    NOTES.E2, NOTES.E3, NOTES.B2, NOTES.E3, NOTES.G2, NOTES.E3, NOTES.B2, NOTES.E3,
    NOTES.D2, NOTES.D3, NOTES.A2, NOTES.D3, NOTES.Fs2, NOTES.D3, NOTES.A2, NOTES.D3,
    NOTES.C2, NOTES.C3, NOTES.G2, NOTES.C3, NOTES.E2, NOTES.C3, NOTES.G2, NOTES.C3,
    NOTES.B2, NOTES.B3, NOTES.Fs3, NOTES.B3, NOTES.Ds3, NOTES.B3, NOTES.Fs3, NOTES.B2,

    NOTES.E2, NOTES.E3, NOTES.B2, NOTES.E3, NOTES.G2, NOTES.E3, NOTES.B2, NOTES.E3,
    NOTES.E2, NOTES.E3, NOTES.B2, NOTES.E3, NOTES.G2, NOTES.E3, NOTES.B2, NOTES.E3,
    NOTES.B2, NOTES.B3, NOTES.Fs3, NOTES.B3, NOTES.Ds3, NOTES.B3, NOTES.Fs3, NOTES.B2,
    NOTES.E2, NOTES.G2, NOTES.B2, NOTES.E3, NOTES.G3, NOTES.E3, NOTES.B2, NOTES.G2,

    // --- Phase 3: Storm Crescendo & Finale (Steps 128 - 191) ---
    NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2,
    NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.B2, NOTES.B2, NOTES.B2, NOTES.B2,
    NOTES.E2, NOTES.E2, NOTES.E2, NOTES.E2, NOTES.G2, NOTES.G2, NOTES.B2, NOTES.B2,
    NOTES.A2, NOTES.A2, NOTES.Fs2, NOTES.Fs2, NOTES.B2, NOTES.B2, NOTES.B2, NOTES.B2,

    NOTES.E2, null,     NOTES.E2, null,     NOTES.E2, null,     NOTES.E2, null,
    NOTES.B2, null,     NOTES.B2, null,     NOTES.B2, null,     NOTES.B2, null,
    NOTES.E2, NOTES.G2, NOTES.B2, NOTES.E3, NOTES.G3, NOTES.E3, NOTES.B2, NOTES.G2,
    NOTES.E2, null,     NOTES.E2, null,     NOTES.E2, null,     null,     null
];

export const MELODY_PATTERN_L3 = [
    // --- Phase 1: Storm Warning & Repeated Note Drop (Steps 0 - 63) ---
    // Bar 1 (Steps 0 - 15)
    NOTES.E5, NOTES.E5, NOTES.E5, NOTES.E5, NOTES.B4, NOTES.B4, NOTES.B4, NOTES.B4,
    NOTES.G4, NOTES.G4, NOTES.E4, NOTES.E4, NOTES.B3, null,     NOTES.E4, null,
    // Bar 2 (Steps 16 - 31)
    NOTES.G5, NOTES.G5, NOTES.G5, NOTES.G5, NOTES.E5, NOTES.E5, NOTES.E5, NOTES.E5,
    NOTES.B4, NOTES.B4, NOTES.G4, NOTES.G4, NOTES.E4, null,     NOTES.G4, null,
    // Bar 3 (Steps 32 - 47)
    NOTES.B5, NOTES.G5, NOTES.E5, NOTES.B4, NOTES.G5, NOTES.E5, NOTES.B4, NOTES.G4,
    NOTES.E5, NOTES.B4, NOTES.G4, NOTES.E4, NOTES.Fs4, NOTES.G4, NOTES.A4, NOTES.B4,
    // Bar 4 (Steps 48 - 63)
    NOTES.C5, NOTES.B4, NOTES.A4, NOTES.G4, NOTES.Fs4, NOTES.E4, NOTES.Ds4, NOTES.Fs4,
    NOTES.E4, null,     NOTES.E5, null,     NOTES.E4, null,     null,     null,

    // --- Phase 2: Virtuoso Storm Arpeggios (Steps 64 - 127) ---
    // Bar 5 (Steps 64 - 79)
    NOTES.E5, NOTES.B5, NOTES.G5, NOTES.B5, NOTES.E5, NOTES.B5, NOTES.G5, NOTES.B5,
    NOTES.E5, NOTES.B5, NOTES.G5, NOTES.B5, NOTES.E5, NOTES.B5, NOTES.G5, NOTES.B5,
    // Bar 6 (Steps 80 - 95)
    NOTES.D5, NOTES.B5, NOTES.Fs5, NOTES.B5, NOTES.D5, NOTES.B5, NOTES.Fs5, NOTES.B5,
    NOTES.D5, NOTES.B5, NOTES.Fs5, NOTES.B5, NOTES.D5, NOTES.B5, NOTES.Fs5, NOTES.B5,
    // Bar 7 (Steps 96 - 111)
    NOTES.C5, NOTES.A5, NOTES.E5, NOTES.A5, NOTES.C5, NOTES.A5, NOTES.E5, NOTES.A5,
    NOTES.B4, NOTES.G5, NOTES.E5, NOTES.G5, NOTES.A4, NOTES.Fs5, NOTES.Ds5, NOTES.Fs5,
    // Bar 8 (Steps 112 - 127)
    NOTES.E5, NOTES.B4, NOTES.G4, NOTES.B4, NOTES.E5, NOTES.B4, NOTES.G4, NOTES.B4,
    NOTES.E5, null,     NOTES.B4, null,     NOTES.E5, null,     null,     null,

    // --- Phase 3: Fast Chromatic Lightning Run & Climax (Steps 128 - 191) ---
    // Bar 9 (Steps 128 - 143: Descending Cascade Run)
    NOTES.E6, NOTES.Ds6, NOTES.E6, NOTES.B5, NOTES.G5, NOTES.E5, NOTES.Ds5, NOTES.E5,
    NOTES.B4, NOTES.G4, NOTES.Fs4, NOTES.G4, NOTES.E4, NOTES.Ds4, NOTES.E4, NOTES.Fs4,
    // Bar 10 (Steps 144 - 159: Chromatic Storm Rise)
    NOTES.G4, NOTES.Gs4, NOTES.A4, NOTES.As4, NOTES.B4, NOTES.C5, NOTES.Cs5, NOTES.D5,
    NOTES.Ds5, NOTES.E5, NOTES.Fs5, NOTES.G5, NOTES.A5, NOTES.B5, NOTES.C6, NOTES.Ds6,
    // Bar 11 (Steps 160 - 175: Heavy Staccato Chords)
    NOTES.E6, null,     NOTES.E6, null,     NOTES.B5, null,     NOTES.B5, null,
    NOTES.G5, null,     NOTES.G5, null,     NOTES.E5, null,     NOTES.E5, null,
    // Bar 12 (Steps 176 - 191: Grand Finale Cadence into Loop)
    NOTES.E5, NOTES.G5, NOTES.B5, NOTES.E6, NOTES.B5, NOTES.G5, NOTES.E5, NOTES.B4,
    NOTES.E5, null,     NOTES.E5, null,     NOTES.E5, null,     null,     null
];

// --- LEVEL 4 TRACK: "Maple Leaf Rag" (Scott Joplin - 192-step C Major Retro Chiptune Ragtime Adaptation) ---
export const BASS_PATTERN_L4 = [
    // --- Phase 1: Clean Ragtime Stride Bass (Steps 0 - 63) ---
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.G2, null, NOTES.G2, null, NOTES.D2, null, NOTES.D2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,

    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.F2, null, NOTES.F2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.E2, null, NOTES.G2, null, NOTES.C2, null,

    // --- Phase 2: Steady Bouncing Ragtime Bass (Steps 64 - 127) ---
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.G2, null, NOTES.G2, null, NOTES.D2, null, NOTES.D2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,

    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.F2, null, NOTES.F2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.E2, null, NOTES.G2, null, NOTES.C2, null,

    // --- Phase 3: Virtuoso Ragtime Bass Finale (Steps 128 - 191) ---
    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.F2, null, NOTES.F2, null, NOTES.F2, null, NOTES.F2, null,
    NOTES.G2, null, NOTES.G2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.E2, null, NOTES.G2, null, NOTES.C2, null,

    NOTES.C2, null, NOTES.C2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.G2, null, NOTES.G2, null, NOTES.G2, null, NOTES.G2, null,
    NOTES.C2, null, NOTES.E2, null, NOTES.G2, null, NOTES.E2, null,
    NOTES.C2, null, NOTES.C2, null, NOTES.C2, null, null,     null
];

export const MELODY_PATTERN_L4 = [
    // --- Phase 1: Main Ragtime Theme (Steps 0 - 63) ---
    // Bar 1 (Steps 0 - 15)
    NOTES.C5, null,     NOTES.E5, null,     NOTES.G5, null,     NOTES.C6, null,
    NOTES.E6, null,     null,     NOTES.C6, null,     NOTES.E6, null,     null,
    // Bar 2 (Steps 16 - 31)
    NOTES.G5, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.G6, null,
    NOTES.E6, null,     null,     NOTES.C6, null,     NOTES.G5, null,     null,
    // Bar 3 (Steps 32 - 47)
    NOTES.A5, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.G5, null,
    NOTES.A5, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.D6, null,
    // Bar 4 (Steps 48 - 63)
    NOTES.C6, null,     null,     null,     NOTES.G5, null,     null,     null,
    NOTES.C5, null,     null,     null,     null,     null,     null,     null,

    // --- Phase 2: Second Ragtime Strain & Staccato Jump (Steps 64 - 127) ---
    // Bar 5 (Steps 64 - 79)
    NOTES.G5, NOTES.A5, NOTES.Bb5, NOTES.B5, NOTES.C6, NOTES.E6, NOTES.G6, NOTES.E6,
    NOTES.C6, NOTES.A5, NOTES.F5, NOTES.D5, NOTES.C5, NOTES.E5, NOTES.G5, null,
    // Bar 6 (Steps 80 - 95)
    NOTES.G5, NOTES.A5, NOTES.Bb5, NOTES.B5, NOTES.C6, NOTES.E6, NOTES.G6, NOTES.E6,
    NOTES.D6, NOTES.C6, NOTES.B5, NOTES.A5, NOTES.G5, null,     NOTES.B5, null,
    // Bar 7 (Steps 96 - 111)
    NOTES.E6, NOTES.D6, NOTES.C6, NOTES.A5, NOTES.G5, NOTES.E5, NOTES.C5, NOTES.G4,
    NOTES.A4, NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.D6, NOTES.E6, NOTES.F6,
    // Bar 8 (Steps 112 - 127)
    NOTES.G6, null,     NOTES.E6, null,     NOTES.C6, null,     NOTES.G5, null,
    NOTES.C6, null,     null,     null,     null,     null,     null,     null,

    // --- Phase 3: Virtuoso Ragtime Flourish & High Finale (Steps 128 - 191) ---
    // Bar 9 (Steps 128 - 143: 16th Ragtime Run)
    NOTES.C5, NOTES.Ds5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.Ds6, NOTES.E6, NOTES.G6,
    NOTES.A6, NOTES.G6, NOTES.E6, NOTES.C6, NOTES.A5, NOTES.G5, NOTES.E5, NOTES.C5,
    // Bar 10 (Steps 144 - 159: Bouncy Ascent)
    NOTES.D5, NOTES.F5, NOTES.A5, NOTES.C6, NOTES.D6, NOTES.F6, NOTES.A6, NOTES.F6,
    NOTES.D6, NOTES.C6, NOTES.B5, NOTES.A5, NOTES.G5, NOTES.F5, NOTES.E5, NOTES.D5,
    // Bar 11 (Steps 160 - 175: Jubilant Chords)
    NOTES.C6, null,     NOTES.E6, null,     NOTES.G6, null,     NOTES.C6, null,
    NOTES.B5, null,     NOTES.D6, null,     NOTES.G6, null,     NOTES.B5, null,
    // Bar 12 (Steps 176 - 191: Grand Finale Cadence into Loop)
    NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.E6, NOTES.G6, NOTES.C6, NOTES.E6,
    NOTES.C6, null,     NOTES.C6, null,     NOTES.C6, null,     null,     null
];

// --- MENU TRACK: "Jetpack Hero - Arcade Title Theme" (Original Retro Game 8-Bit Composition) ---
// Chord Progression: [Bar 1: C Major] [Bar 2: G Major] [Bar 3: A Minor] [Bar 4: F Major]
//                    [Bar 5: C Major] [Bar 6: F Major] [Bar 7: G Dominant 7] [Bar 8: C Major Cadence]
export const MENU_BASS_PATTERN = [
    // Phrase 1 (Steps 0 - 31): C -> G -> Am -> F
    NOTES.C2, NOTES.C3, NOTES.G2, NOTES.C3, NOTES.C2, NOTES.C3, NOTES.G2, NOTES.C3, // Bar 1: C Major
    NOTES.G2, NOTES.G3, NOTES.D2, NOTES.G3, NOTES.G2, NOTES.G3, NOTES.D2, NOTES.G3, // Bar 2: G Major
    NOTES.A2, NOTES.A3, NOTES.E2, NOTES.A3, NOTES.A2, NOTES.A3, NOTES.E2, NOTES.A3, // Bar 3: A Minor
    NOTES.F2, NOTES.F3, NOTES.C2, NOTES.F3, NOTES.F2, NOTES.F3, NOTES.C2, NOTES.F3, // Bar 4: F Major

    // Phrase 2 (Steps 32 - 63): C -> F -> G7 -> C
    NOTES.C2, NOTES.C3, NOTES.G2, NOTES.C3, NOTES.C2, NOTES.C3, NOTES.G2, NOTES.C3, // Bar 5: C Major
    NOTES.F2, NOTES.F3, NOTES.C2, NOTES.F3, NOTES.F2, NOTES.F3, NOTES.C2, NOTES.F3, // Bar 6: F Major
    NOTES.G2, NOTES.G3, NOTES.D2, NOTES.G3, NOTES.G2, NOTES.G3, NOTES.D2, NOTES.G3, // Bar 7: G7
    NOTES.C2, NOTES.C3, NOTES.G2, NOTES.C3, NOTES.C2, null,     NOTES.C2, null      // Bar 8: C Major Resolution
];

export const MENU_CHIME_PATTERN = [
    // Phrase 1 (Steps 0 - 31): C -> G -> Am -> F
    NOTES.C5, null,     NOTES.E5, null,     NOTES.G5, null,     NOTES.C6, null,     // Bar 1: C Major Arpeggio
    NOTES.B5, null,     NOTES.D6, null,     NOTES.G5, null,     NOTES.B5, null,     // Bar 2: G Major Arpeggio
    NOTES.A5, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.A5, null,     // Bar 3: A Minor Triad
    NOTES.F5, null,     NOTES.A5, null,     NOTES.C6, null,     NOTES.F6, null,     // Bar 4: F Major Triad

    // Phrase 2 (Steps 32 - 63): C -> F -> G7 -> C
    NOTES.G5, null,     NOTES.C6, null,     NOTES.E6, null,     NOTES.G6, null,     // Bar 5: High C Climax
    NOTES.A5, null,     NOTES.C6, null,     NOTES.F6, null,     NOTES.E6, null,     // Bar 6: F Major Drop
    NOTES.D5, NOTES.F5, NOTES.G5, NOTES.B5, NOTES.D6, NOTES.F6, NOTES.D6, NOTES.B5, // Bar 7: G7 Run
    NOTES.C6, null,     NOTES.G5, null,     NOTES.E5, null,     NOTES.C5, null      // Bar 8: C Major Resolution
];
