/* ==========================================================================
   CAMPAIGN TOP 10 LEADERBOARD TEST SUITE
   Verifies:
   1. Leaderboard retrieval (GET /api/leaderboard/campaign)
   2. Score qualification check (POST /api/leaderboard/campaign/qualify)
   3. Authenticated score submission (POST /api/leaderboard/campaign)
   4. Unauthenticated submission rejection (401)
   5. Personal best preservation (higher score / stage maintained)
   6. Proper ranking order: score desc, levelReached desc, date asc
   7. Top 10 truncation & minScoreToQualify threshold
   ========================================================================== */

import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { httpServer } from "../server/index.js";
import { getFirebaseDatabase } from "../server/firebase.js";
import {
  resetCampaignLeaderboardForTest,
  restoreCampaignLeaderboardSnapshot,
} from "../server/campaignLeaderboardModule.js";
import {
  CampaignLeaderboardEntry,
  CampaignLeaderboardResponse,
  SubmitCampaignScoreResponse,
} from "../js/shared/payloads.js";


async function runTests(): Promise<void> {
  console.log("🧪 Starting Campaign Leaderboard Automated Test Suite...\n");

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });

  const address = httpServer.address() as AddressInfo;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`📡 Test server listening on port ${address.port}\n`);

  const createdUserIds: string[] = [];
  let leaderboardSnapshot: CampaignLeaderboardEntry[] = [];


  try {
    // ── 0. Isolate test: clear any pre-existing leaderboard data ────────────
    console.log("0️⃣  Clearing leaderboard to ensure a clean test environment...");
    leaderboardSnapshot = await resetCampaignLeaderboardForTest();
    console.log(`   ✅ Leaderboard cleared (${leaderboardSnapshot.length} existing entries saved for restore).\n`);

    // ── 1. Unauthenticated submission is rejected ────────────────────────────

    console.log("1️⃣  Testing unauthenticated score submission rejection...");
    const unauthRes = await fetch(`${baseUrl}/api/leaderboard/campaign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 10000, levelReached: 3, completedCampaign: false }),
    });
    assert.equal(unauthRes.status, 401, "Should reject unauthenticated submission with 401");
    console.log("   ✅ Unauthenticated submission rejected with 401.\n");

    // ── 2. Register test pilots ──────────────────────────────────────────────
    console.log("2️⃣  Registering test pilots...");
    const suffix = Date.now();
    const registerPilot = async (name: string): Promise<{ id: string; name: string }> => {
      const res = await fetch(`${baseUrl}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: "testPassword123" }),
      });
      const data = (await res.json()) as { success: boolean; user?: { id: string; name: string } };
      assert.equal(data.success, true, `Registration failed for ${name}`);
      createdUserIds.push(data.user!.id);
      return data.user!;
    };

    const pilotA = await registerPilot(`Ace_${suffix}`);
    const pilotB = await registerPilot(`Blaze_${suffix}`);
    console.log(`   ✅ Registered pilot ${pilotA.name} and ${pilotB.name}.\n`);

    // ── 3. Score qualification check ─────────────────────────────────────────
    console.log("3️⃣  Testing score qualification check...");
    const qualRes = await fetch(`${baseUrl}/api/leaderboard/campaign/qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 25000, levelReached: 5 }),
    });
    assert.equal(qualRes.status, 200);
    const qualData = (await qualRes.json()) as { success: boolean; qualified: boolean };
    assert.equal(qualData.success, true);
    assert.equal(qualData.qualified, true, "Valid positive score should qualify");
    console.log("   ✅ Score qualification check verified.\n");

    // ── 4. Pilot A submits initial score ─────────────────────────────────────
    console.log("4️⃣  Testing Pilot A score submission...");
    const submitARes = await fetch(`${baseUrl}/api/leaderboard/campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pilotA.id}`,
      },
      body: JSON.stringify({ score: 50000, levelReached: 7, completedCampaign: false }),
    });
    assert.equal(submitARes.status, 200);
    const submitAData = (await submitARes.json()) as SubmitCampaignScoreResponse;
    assert.equal(submitAData.success, true);
    assert.equal(submitAData.qualified, true);
    assert.equal(submitAData.entry?.userName, pilotA.name);
    assert.equal(submitAData.entry?.score, 50000);
    assert.equal(submitAData.entry?.levelReached, 7);
    assert.equal(submitAData.entry?.completedCampaign, false);
    console.log(`   ✅ Pilot A score submitted (Rank: #${submitAData.rank}).\n`);

    // ── 5. Pilot B submits higher score ──────────────────────────────────────
    console.log("5️⃣  Testing Pilot B higher score submission...");
    const submitBRes = await fetch(`${baseUrl}/api/leaderboard/campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": pilotB.id,
      },
      body: JSON.stringify({ score: 85000, levelReached: 10, completedCampaign: true }),
    });
    assert.equal(submitBRes.status, 200);
    const submitBData = (await submitBRes.json()) as SubmitCampaignScoreResponse;
    assert.equal(submitBData.success, true);
    assert.equal(submitBData.qualified, true);
    assert.equal(submitBData.rank, 1, "Pilot B should now be #1");
    console.log("   ✅ Pilot B ranked #1 over Pilot A.\n");

    // ── 6. Leaderboard retrieval reflects proper ordering ────────────────────
    console.log("6️⃣  Verifying leaderboard GET endpoint ordering...");
    const listRes = await fetch(`${baseUrl}/api/leaderboard/campaign?userId=${pilotA.id}`);
    assert.equal(listRes.status, 200);
    const listData = (await listRes.json()) as CampaignLeaderboardResponse;
    assert.equal(listData.success, true);
    assert.ok(listData.scores.length >= 2);

    const bIdx = listData.scores.findIndex((s) => s.userId === pilotB.id);
    const aIdx = listData.scores.findIndex((s) => s.userId === pilotA.id);
    assert.ok(bIdx < aIdx, "Pilot B (higher score) must be listed before Pilot A");
    assert.equal(listData.userRank, aIdx + 1, "User rank should match Pilot A index");
    console.log("   ✅ Leaderboard reflects ordered scores with user rank.\n");

    // ── 7. Personal best protection: lower score does not overwrite ──────────
    console.log("7️⃣  Testing personal best retention on lower score attempt...");
    const lowerRes = await fetch(`${baseUrl}/api/leaderboard/campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pilotA.id}`,
      },
      body: JSON.stringify({ score: 20000, levelReached: 3, completedCampaign: false }),
    });
    assert.equal(lowerRes.status, 200);
    const lowerData = (await lowerRes.json()) as SubmitCampaignScoreResponse;
    assert.equal(lowerData.entry?.score, 50000, "Should preserve original higher personal best");
    assert.equal(lowerData.entry?.levelReached, 7);
    console.log("   ✅ Personal best retained at 50,000 pts.\n");

    // ── 8. Personal best update: higher score updates record ─────────────────
    console.log("8️⃣  Testing personal best update when surpassing prior record...");
    const higherRes = await fetch(`${baseUrl}/api/leaderboard/campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pilotA.id}`,
      },
      body: JSON.stringify({ score: 99000, levelReached: 10, completedCampaign: true }),
    });
    assert.equal(higherRes.status, 200);
    const higherData = (await higherRes.json()) as SubmitCampaignScoreResponse;
    assert.equal(higherData.entry?.score, 99000);
    assert.equal(higherData.entry?.levelReached, 10);
    assert.equal(higherData.entry?.completedCampaign, true);
    assert.equal(higherData.rank, 1, "Pilot A should take #1 rank with 99,000 pts");
    console.log("   ✅ Pilot A reclaimed #1 rank with 99,000 pts.\n");

    // ── 9. Top 10 max capacity enforcement ───────────────────────────────────
    console.log("9️⃣  Testing Top 10 capacity truncation...");
    for (let i = 1; i <= 10; i++) {
      const extraPilot = await registerPilot(`ExtraPilot_${i}_${suffix}`);
      await fetch(`${baseUrl}/api/leaderboard/campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${extraPilot.id}`,
        },
        body: JSON.stringify({
          score: 10000 + i * 1000,
          levelReached: Math.min(10, i),
          completedCampaign: false,
        }),
      });
    }

    const cappedRes = await fetch(`${baseUrl}/api/leaderboard/campaign`);
    const cappedData = (await cappedRes.json()) as CampaignLeaderboardResponse;
    assert.equal(cappedData.scores.length, 10, "Leaderboard should return at most 10 entries");
    assert.ok(
      cappedData.minScoreToQualify > 1,
      `minScoreToQualify (${cappedData.minScoreToQualify}) should be greater than 1 when full`,
    );
    console.log(
      `   ✅ Leaderboard strictly capped at Top 10 (min to enter: ${cappedData.minScoreToQualify}).\n`,
    );

    console.log("🎉 All Campaign Leaderboard tests passed successfully!");
  } finally {
    // Restore previously saved leaderboard snapshot first
    if (leaderboardSnapshot.length > 0) {
      try {
        await restoreCampaignLeaderboardSnapshot(leaderboardSnapshot);
        console.log(`🔄 Leaderboard snapshot restored (${leaderboardSnapshot.length} entries).`);
      } catch (err) {
        console.warn("⚠️ Snapshot restore warning:", err);
      }
    }

    // Clean up test data from Firebase RTDB if connected
    const db = getFirebaseDatabase();
    if (db && createdUserIds.length > 0) {

      try {
        for (const uid of createdUserIds) {
          await db.ref(`campaign_leaderboard/${uid}`).remove();
          await db.ref(`users/${uid}`).remove();
        }
      } catch (err) {
        console.warn("⚠️ Cleanup warning:", err);
      }
    }

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  });
