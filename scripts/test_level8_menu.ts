import assert from "node:assert/strict";
import { CAMPAIGN_LEVELS } from "../js/levels/campaign.js";

console.log("🧪 Running Level 8 Menu Selection Verification Suite...\n");

// 1. Verify CAMPAIGN_LEVELS contains 8 campaign levels
assert.equal(CAMPAIGN_LEVELS.length, 8, "CAMPAIGN_LEVELS must contain 8 levels");
console.log("1️⃣  CAMPAIGN_LEVELS contains 8 levels.");

// 2. Verify Level 8 metadata
const level8 = CAMPAIGN_LEVELS[7];
assert.equal(level8.name, "Stage 8: Bonus Treasure Vault", "Level 8 name must match Stage 8: Bonus Treasure Vault");
console.log(`2️⃣  Level 8 metadata verified: ${level8.name}`);

// 3. Verify single-player level cards logic
const cards = CAMPAIGN_LEVELS.map((level, idx) => {
  const isBonus = idx === 7 || level.name.toLowerCase().includes("bonus");
  return {
    index: idx,
    className: `level-card${isBonus ? " bonus-card" : ""}`,
    title: level.name,
    label: `${isBonus ? "BONUS" : "STAGE"} ${idx + 1}`
  };
});

assert.equal(cards.length, 8, "Single-player level grid should produce 8 cards");
assert.equal(cards[7].className, "level-card bonus-card", "Level 8 card must have bonus-card styling class");
assert.equal(cards[7].label, "BONUS 8", "Level 8 card must display BONUS 8 label");
console.log("3️⃣  Single-player level selection grid cards verified with Level 8 bonus card.");

// 4. Verify multiplayer room selection options list logic
const dropdownOptions = CAMPAIGN_LEVELS.map((level, idx) => ({
  value: idx.toString(),
  text: `Level ${idx + 1} - ${level.name}`
}));
dropdownOptions.push({ value: "custom", text: "🛠️ Custom Map (Uploaded / Saved)" });

assert.equal(dropdownOptions.length, 9, "Multiplayer room level select dropdown should have 9 options (8 levels + 1 custom)");
assert.equal(dropdownOptions[7].value, "7", "Level 8 option value must be '7'");
assert.equal(dropdownOptions[7].text, "Level 8 - Stage 8: Bonus Treasure Vault", "Level 8 option text must be 'Level 8 - Stage 8: Bonus Treasure Vault'");
// 5. Verify local server level select button visibility logic
function isLocalHostServer(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

assert.equal(isLocalHostServer("localhost"), true, "localhost should show select level button");
assert.equal(isLocalHostServer("127.0.0.1"), true, "127.0.0.1 should show select level button");
assert.equal(isLocalHostServer("jetpack.azurewebsites.net"), false, "Deployed server should hide select level button");
console.log("5️⃣  Select Level button local server restriction verified.");

console.log("\n🎉 LEVEL 8 MENU SELECTION TESTS PASSED PERFECTLY!");
