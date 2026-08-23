import assert from "node:assert/strict";
import { AudioManager } from "../js/audio/audioManager.js";
import { SoundEffects } from "../js/audio/sfx.js";
import { MusicSequencer } from "../js/audio/sequencer.js";

console.log("🧪 Running Audio Toggles Unit Test Suite...\n");

// ---------------------------------------------------------
// 1. Test AudioManager Initial State & Independent Toggles
// ---------------------------------------------------------
console.log("1️⃣  Testing AudioManager Independent SFX & Music State...");

const audio = new AudioManager();
assert.equal(audio.isSfxMuted, false, "SFX should be unmuted by default");
assert.equal(audio.isMusicMuted, false, "Music should be unmuted by default");
assert.equal(audio.isMuted, false, "isMuted should be false by default");

// Toggle SFX independently
const sfxMuted = audio.toggleSfx();
assert.equal(sfxMuted, true, "toggleSfx() should return true when toggled on");
assert.equal(audio.isSfxMuted, true, "isSfxMuted should be true");
assert.equal(audio.isMusicMuted, false, "isMusicMuted should remain false when toggling SFX");

// Toggle Music independently
const musicMuted = audio.toggleMusic();
assert.equal(musicMuted, true, "toggleMusic() should return true when toggled on");
assert.equal(audio.isMusicMuted, true, "isMusicMuted should be true");
assert.equal(audio.isSfxMuted, true, "isSfxMuted should remain true when toggling Music");
assert.equal(audio.isMuted, true, "isMuted should be true when both are muted");

// Untoggle SFX
audio.toggleSfx();
assert.equal(audio.isSfxMuted, false, "SFX should now be unmuted");
assert.equal(audio.isMusicMuted, true, "Music should still be muted");
assert.equal(audio.isMuted, false, "isMuted should be false when only music is muted");

// Untoggle Music
audio.toggleMusic();
assert.equal(audio.isMusicMuted, false, "Music should now be unmuted");
assert.equal(audio.isSfxMuted, false, "SFX should still be unmuted");
assert.equal(audio.isMuted, false, "isMuted should be false when both are unmuted");

console.log("   ✅ Independent SFX and Music state transitions verified.");

// ---------------------------------------------------------
// 2. Test Setters & Backwards Compatibility
// ---------------------------------------------------------
console.log("\n2️⃣  Testing Setters & Backwards Compatibility...");

audio.setSfxMuted(true);
assert.equal(audio.isSfxMuted, true, "setSfxMuted(true) sets SFX to muted");
assert.equal(audio.isMusicMuted, false, "Music remains unchanged");

audio.setMusicMuted(true);
assert.equal(audio.isMusicMuted, true, "setMusicMuted(true) sets Music to muted");

// Test isMuted setter
audio.isMuted = false;
assert.equal(audio.isSfxMuted, false, "isMuted=false unmutes SFX");
assert.equal(audio.isMusicMuted, false, "isMuted=false unmutes Music");

audio.isMuted = true;
assert.equal(audio.isSfxMuted, true, "isMuted=true mutes SFX");
assert.equal(audio.isMusicMuted, true, "isMuted=true mutes Music");

// Test toggleMute()
const masterMute = audio.toggleMute();
assert.equal(masterMute, false, "toggleMute() unmutes when previously all muted");
assert.equal(audio.isSfxMuted, false, "toggleMute() unmuted SFX");
assert.equal(audio.isMusicMuted, false, "toggleMute() unmuted Music");

console.log("   ✅ Audio setters and backwards compatibility verified.");

// ---------------------------------------------------------
// 3. Test SoundEffects and MusicSequencer Getters
// ---------------------------------------------------------
console.log("\n3️⃣  Testing SoundEffects & MusicSequencer Mute References...");

audio.setSfxMuted(false);
audio.setMusicMuted(true);

assert.equal(audio.sfx.isMuted, false, "sfx.isMuted checks audio.isSfxMuted");
assert.equal(audio.sequencer.isMuted, true, "sequencer.isMuted checks audio.isMusicMuted");

audio.setSfxMuted(true);
audio.setMusicMuted(false);

assert.equal(audio.sfx.isMuted, true, "sfx.isMuted is true when isSfxMuted is true");
assert.equal(audio.sequencer.isMuted, false, "sequencer.isMuted is false when isMusicMuted is false");

console.log("   ✅ Submodules correctly query their dedicated mute states.");

// ---------------------------------------------------------
// 4. Test LocalStorage Persistence
// ---------------------------------------------------------
console.log("\n4️⃣  Testing LocalStorage Persistence...");

const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
};

const persistentAudio = new AudioManager();
persistentAudio.toggleSfx(); // mute sfx -> true
persistentAudio.setMusicMuted(true); // mute music -> true

assert.equal(mockStorage["jetpack_sfx_muted"], "true", "jetpack_sfx_muted persisted to localStorage");
assert.equal(mockStorage["jetpack_music_muted"], "true", "jetpack_music_muted persisted to localStorage");

// New audio manager instance should restore persisted states
const restoredAudio = new AudioManager();
assert.equal(restoredAudio.isSfxMuted, true, "New AudioManager restored isSfxMuted=true from localStorage");
assert.equal(restoredAudio.isMusicMuted, true, "New AudioManager restored isMusicMuted=true from localStorage");

console.log("   ✅ Audio preferences persistence verified.");

// ---------------------------------------------------------
// 5. Test UIManager Button Integration
// ---------------------------------------------------------
console.log("\n5️⃣  Testing UIManager HUD Buttons Integration...");

class MockElement {
  id: string;
  textContent: string = "";
  title: string = "";
  attributes: Record<string, string> = {};
  classList = {
    classes: new Set<string>(),
    add: (c: string) => MockElement.prototype.classList.classes.add(c),
    remove: (c: string) => MockElement.prototype.classList.classes.delete(c),
    toggle: (c: string, force?: boolean) => {
      const has = MockElement.prototype.classList.classes.has(c);
      const res = force !== undefined ? force : !has;
      if (res) MockElement.prototype.classList.classes.add(c);
      else MockElement.prototype.classList.classes.delete(c);
      return res;
    },
    contains: (c: string) => MockElement.prototype.classList.classes.has(c),
  };
  eventListeners: Record<string, Function[]> = {};

  constructor(id: string) {
    this.id = id;
    this.classList = {
      classes: new Set<string>(),
      add: (c: string) => this.classList.classes.add(c),
      remove: (c: string) => this.classList.classes.delete(c),
      toggle: (c: string, force?: boolean) => {
        const has = this.classList.classes.has(c);
        const res = force !== undefined ? force : !has;
        if (res) this.classList.classes.add(c);
        else this.classList.classes.delete(c);
        return res;
      },
      contains: (c: string) => this.classList.classes.has(c),
    };
  }

  setAttribute(name: string, val: string): void {
    this.attributes[name] = val;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  addEventListener(event: string, handler: Function): void {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(handler);
  }

  click(): void {
    if (this.eventListeners["click"]) {
      this.eventListeners["click"].forEach((cb) => cb({ stopPropagation: () => {} }));
    }
  }

  appendChild(child: any): void {}
}

const mockElements = new Map<string, MockElement>();
["btnSound", "btnMusic", "btnPause", "btnCRT", "btnHudToggle", "gameHud", "btnUserAuth"].forEach((id) => {
  mockElements.set(id, new MockElement(id));
});

(globalThis as any).document = {
  getElementById: (id: string) => mockElements.get(id) || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};

(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false }),
};

// Reset storage
mockStorage["jetpack_sfx_muted"] = "false";
mockStorage["jetpack_music_muted"] = "false";

const testAudio = new AudioManager();
const mockGame: any = {
  audio: testAudio,
  loop: { stop: () => {}, start: () => {} },
  input: { onPausePress: null },
  player: { score: 0, lives: 3, fuel: 100, rapidFireTimer: 0 },
  tileMap: { collectedEmeralds: 0, totalEmeralds: 5 },
  currentLevelIndex: 0,
  isCustomLevel: false,
  togglePause: () => {},
  levelManager: { startLevel: () => {} },
  network: { connect: () => {}, listRooms: () => {} },
};

const { UIManager } = await import("../js/ui/uiManager.js");
const ui = new UIManager(mockGame);
ui.bindUI();

const btnSound = mockElements.get("btnSound")!;
const btnMusic = mockElements.get("btnMusic")!;

// Initially unmuted
assert.equal(btnSound.textContent, "🔊", "btnSound displays 🔊 when unmuted");
assert.equal(btnMusic.textContent, "🎵", "btnMusic displays 🎵 when unmuted");
assert.equal(btnSound.classList.contains("muted"), false, "btnSound does not have muted class");
assert.equal(btnMusic.classList.contains("muted"), false, "btnMusic does not have muted class");

// Click btnSound to toggle SFX
btnSound.click();
assert.equal(testAudio.isSfxMuted, true, "Clicking btnSound muted SFX");
assert.equal(testAudio.isMusicMuted, false, "Clicking btnSound did not mute Music");
assert.equal(btnSound.textContent, "🔇", "btnSound displays 🔇 when SFX muted");
assert.equal(btnSound.classList.contains("muted"), true, "btnSound has muted class");
assert.equal(btnMusic.textContent, "🎵", "btnMusic still displays 🎵");

// Click btnMusic to toggle Music
btnMusic.click();
assert.equal(testAudio.isMusicMuted, true, "Clicking btnMusic muted Music");
assert.equal(btnMusic.textContent, "🔕", "btnMusic displays 🔕 when Music muted");
assert.equal(btnMusic.classList.contains("muted"), true, "btnMusic has muted class");

// Click btnSound again to unmute SFX
btnSound.click();
assert.equal(testAudio.isSfxMuted, false, "Clicking btnSound again unmuted SFX");
assert.equal(testAudio.isMusicMuted, true, "Music remains muted");
assert.equal(btnSound.textContent, "🔊", "btnSound restored 🔊");
assert.equal(btnSound.classList.contains("muted"), false, "btnSound removed muted class");
assert.equal(btnMusic.textContent, "🔕", "btnMusic still 🔕");

console.log("   ✅ UI buttons and HUD interaction verified.");

console.log("\n🎉 ALL AUDIO TOGGLES UNIT TESTS PASSED CLEANLY!");
