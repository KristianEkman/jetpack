import assert from "node:assert/strict";
import { TileMap } from "../js/world/tilemap.js";
import { Player } from "../js/entities/player/playerClass.js";

class MockAudio {
  phaseSoundsPlayed = 0;
  phaseImpactsPlayed = 0;
  explosionsPlayed = 0;
  thrustStarted = 0;
  thrustStopped = 0;

  playPhaseSound(): void {
    this.phaseSoundsPlayed++;
  }
  playPhaseImpact(): void {
    this.phaseImpactsPlayed++;
  }
  playExplosion(): void {
    this.explosionsPlayed++;
  }
  startThrust(): void {
    this.thrustStarted++;
  }
  stopThrust(): void {
    this.thrustStopped++;
  }
}

console.log("🧪 Testing Solo Player Laser Sound Effects...\n");

{
  console.log("1️⃣  Testing Solo Campaign Laser Fire Sound (playPhaseSound)...");
  const audio = new MockAudio();
  const tileMap = new TileMap();
  const player = new Player(audio as any, tileMap);

  assert.equal(audio.phaseSoundsPlayed, 0, "No phase sounds played initially");

  // Simulate updating player with input.phase = true
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    thrust: false,
    phase: true,
    suicide: false,
    sequenceId: 1,
  };

  player.update(0.016, input, null as any);

  assert.equal(
    audio.phaseSoundsPlayed,
    1,
    "Firing laser in solo campaign triggered playPhaseSound()",
  );

  // Subsequent frame while holding phase button shouldn't re-trigger sound due to cooldown
  player.update(0.016, input, null as any);
  assert.equal(
    audio.phaseSoundsPlayed,
    1,
    "Holding laser button did not spam playPhaseSound()",
  );

  console.log("   ✅ Solo campaign laser fire sound test passed!");
}
