/* ==========================================================================
   KONGREGATE BUILD & INTEGRATION TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { KongregateService } from "../js/network/kongregateService.js";

console.log("🧪 Starting Kongregate Build & Integration Test Suite...\n");

// 1. Verify KongregateService Unit Logic
console.log("1️⃣  Testing KongregateService API Mock & Stats Submission...");
const service = new KongregateService();
assert.equal(service.isAvailable(), false, "Service should not be available in headless Node");
assert.equal(service.isGuest(), true, "Service should identify as guest by default");
assert.equal(service.getUsername(), null, "Service should return null username when unavailable");

// Safe execution when not connected
assert.doesNotThrow(() => {
  service.submitScore(5000);
  service.submitLevel(3);
  service.submitCampaignComplete();
}, "Stats submission should be safe when Kongregate API is absent");

// Mocking window.kongregate
let submittedStats: Record<string, number> = {};
const mockKongregate = {
  services: {
    getUsername: () => "AcePilot99",
    getUserId: () => 123456,
    getGameAuthToken: () => "mock-token",
    isGuest: () => false,
    addEventListener: () => {},
  },
  stats: {
    submit: (statName: string, value: number) => {
      submittedStats[statName] = value;
    },
  },
};

(globalThis as unknown as { window: { kongregate?: typeof mockKongregate } }).window = {
  kongregate: mockKongregate,
};

const activeService = new KongregateService();
assert.equal(activeService.isAvailable(), true, "Service should detect active window.kongregate");
assert.equal(activeService.isGuest(), false, "Service should detect non-guest");
assert.equal(activeService.getUsername(), "AcePilot99", "Service should return pilot username");

activeService.submitScore(125000);
assert.equal(submittedStats["Score"], 125000, "Score stat submitted accurately");

activeService.submitLevel(5);
assert.equal(submittedStats["Level"], 5, "Level stat submitted accurately");

activeService.submitCampaignComplete();
assert.equal(submittedStats["CompletedCampaign"], 1, "CompletedCampaign stat submitted accurately");

console.log("   ✅ KongregateService methods & mock integration verified.\n");

// 2. Verify kongregate.zip exists and archive structure
console.log("2️⃣  Testing kongregate.zip Archive Structure...");
const rootDir = process.cwd();
const zipPath = path.join(rootDir, "kongregate.zip");
assert.ok(fs.existsSync(zipPath), "kongregate.zip must exist at root");

const zipList = execSync(`unzip -l "${zipPath}"`).toString();
assert.match(zipList, /index\.html/, "Archive must contain index.html at root");
assert.match(zipList, /assets\//, "Archive must contain assets directory");
assert.match(zipList, /assets\/socket\.io\.min\.js/, "Archive must contain socket.io.min.js");
console.log("   ✅ kongregate.zip structure verified.\n");

// 3. Verify dist/index.html paths and Kongregate API inclusion
console.log("3️⃣  Testing index.html paths and script tags for Kongregate...");
const distHtmlPath = path.join(rootDir, "dist", "index.html");
assert.ok(fs.existsSync(distHtmlPath), "dist/index.html must exist");
const distHtml = fs.readFileSync(distHtmlPath, "utf8");

// Kongregate script tag
assert.ok(
  distHtml.includes("https://cdn1.kongregate.com/javascripts/kongregate_api.js"),
  "dist/index.html must contain Kongregate API script tag",
);

// Relative asset paths
assert.ok(
  distHtml.includes('src="./assets/'),
  "Asset script paths must be relative (./assets/)",
);
assert.ok(
  distHtml.includes('href="./assets/'),
  "Asset style and icon paths must be relative (./assets/)",
);

// No absolute /assets/ paths
assert.ok(
  !distHtml.includes('src="/assets/'),
  "No absolute /assets/ script paths allowed",
);
assert.ok(
  !distHtml.includes('href="/assets/'),
  "No absolute /assets/ link paths allowed",
);

console.log("   ✅ Relative paths and Kongregate API script verified.\n");

console.log("🎉 ALL KONGREGATE BUILD & INTEGRATION TESTS PASSED PERFECTLY!\n");
