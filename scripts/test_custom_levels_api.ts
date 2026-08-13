import assert from "node:assert";
import { app, httpServer } from "../server/index.js";
import { getFirebaseDatabase } from "../server/firebase.js";
import { AddressInfo } from "node:net";

async function runTests(): Promise<void> {
  console.log("🧪 Starting Custom Levels REST API Automated Tests...");

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });

  const address = httpServer.address() as AddressInfo;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`📡 Test server listening at ${baseUrl}`);

  let userA: { id: string; name: string } | null = null;
  let userB: { id: string; name: string } | null = null;
  let levelId: string | null = null;

  try {
    // 1. Register User A
    const userARes = await fetch(`${baseUrl}/api/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `LevelAuthor_${Date.now()}`, password: "password123" }),
    });
    const userAData = (await userARes.json()) as { success: boolean; user?: { id: string; name: string } };
    assert.strictEqual(userAData.success, true, "User A registration failed");
    userA = userAData.user!;
    console.log(`✅ Registered User A: ${userA.name} (${userA.id})`);

    // 2. Register User B
    const userBRes = await fetch(`${baseUrl}/api/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `LevelPlayer_${Date.now()}`, password: "password123" }),
    });
    const userBData = (await userBRes.json()) as { success: boolean; user?: { id: string; name: string } };
    assert.strictEqual(userBData.success, true, "User B registration failed");
    userB = userBData.user!;
    console.log(`✅ Registered User B: ${userB.name} (${userB.id})`);

    // 3. User A creates a new custom level (POST /api/levels)
    const testGrid = new Array(18 * 30).fill(0);
    testGrid[0] = 1; // brick
    testGrid[35] = 16; // spawn

    const createLevelRes = await fetch(`${baseUrl}/api/levels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userA.id}`,
      },
      body: JSON.stringify({
        name: "User A Castle",
        grid: testGrid,
        spawnX: 100,
        spawnY: 100,
      }),
    });
    assert.strictEqual(createLevelRes.status, 201, "Expected 201 Created for level upload");
    const createData = (await createLevelRes.json()) as { success: boolean; level?: any };
    assert.strictEqual(createData.success, true, "Level creation failed");
    levelId = createData.level.id;
    assert.strictEqual(createData.level.authorId, userA.id);
    assert.strictEqual(createData.level.authorName, userA.name);
    assert.strictEqual(createData.level.name, "User A Castle");
    assert.strictEqual(createData.level.isReleased, true, "Level should be released by default");
    console.log(`✅ User A successfully created custom level: ${levelId} (isReleased=true by default)`);

    // 4. User A edits own custom level (PUT /api/levels/:id)
    testGrid[1] = 2; // phase brick
    const updateRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userA.id}`,
      },
      body: JSON.stringify({
        name: "User A Castle Updated",
        grid: testGrid,
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updateData = (await updateRes.json()) as { success: boolean; level?: any };
    assert.strictEqual(updateData.success, true);
    assert.strictEqual(updateData.level.name, "User A Castle Updated");
    console.log(`✅ User A successfully edited own custom level`);

    // 4b. Test Release Flag: User A unreleases level (isReleased: false)
    const unreleaseRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userA.id}`,
      },
      body: JSON.stringify({
        isReleased: false,
      }),
    });
    assert.strictEqual(unreleaseRes.status, 200);
    const unreleaseData = (await unreleaseRes.json()) as { success: boolean; level?: any };
    assert.strictEqual(unreleaseData.level.isReleased, false);
    console.log(`✅ User A successfully unreleased level (isReleased=false)`);

    // 4c. Verify Public cannot see unreleased level in GET /api/levels
    const publicListRes = await fetch(`${baseUrl}/api/levels`);
    const publicListData = (await publicListRes.json()) as { success: boolean; levels?: any[] };
    const publicFound = publicListData.levels?.find((l: any) => l.id === levelId);
    assert.strictEqual(publicFound, undefined, "Unreleased level must not be listed in public GET /api/levels");
    console.log(`✅ Unreleased level hidden from public GET /api/levels`);

    // 4d. Verify Owner CAN see unreleased level in GET /api/levels
    const ownerListRes = await fetch(`${baseUrl}/api/levels`, {
      headers: { "Authorization": `Bearer ${userA.id}` },
    });
    const ownerListData = (await ownerListRes.json()) as { success: boolean; levels?: any[] };
    const ownerFound = ownerListData.levels?.find((l: any) => l.id === levelId);
    assert.ok(ownerFound, "Unreleased level must be listed for owner in GET /api/levels");
    console.log(`✅ Unreleased level visible to owner in GET /api/levels`);

    // 4e. Verify Public direct fetch GET /api/levels/:id returns 404
    const publicGetRes = await fetch(`${baseUrl}/api/levels/${levelId}`);
    assert.strictEqual(publicGetRes.status, 404, "Public GET /api/levels/:id for unreleased level should return 404");
    console.log(`✅ Public direct fetch of unreleased level returned 404`);

    // 4f. Verify Owner direct fetch GET /api/levels/:id returns 200
    const ownerGetRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      headers: { "Authorization": `Bearer ${userA.id}` },
    });
    assert.strictEqual(ownerGetRes.status, 200, "Owner GET /api/levels/:id for unreleased level should return 200");
    console.log(`✅ Owner direct fetch of unreleased level returned 200 OK`);

    // 4g. Re-release level (isReleased: true)
    const reReleaseRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userA.id}`,
      },
      body: JSON.stringify({
        isReleased: true,
      }),
    });
    assert.strictEqual(reReleaseRes.status, 200);
    console.log(`✅ User A re-released level (isReleased=true)`);

    // 5. User B attempts to edit User A's custom level (PUT /api/levels/:id) -> Expect 403 Forbidden
    const forbiddenUpdateRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userB.id}`,
      },
      body: JSON.stringify({
        name: "Hacked by User B",
        grid: testGrid,
      }),
    });
    assert.strictEqual(forbiddenUpdateRes.status, 403, "User B should be forbidden (403) from editing User A's level");
    const forbiddenData = (await forbiddenUpdateRes.json()) as { success: boolean; error?: string };
    assert.strictEqual(forbiddenData.success, false);
    console.log(`✅ Authorization check verified: User B cannot edit User A's level (403 Forbidden)`);

    // 6. User B rates User A's level 5 stars (POST /api/levels/:id/rate)
    const rateRes = await fetch(`${baseUrl}/api/levels/${levelId}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userB.id}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });
    assert.strictEqual(rateRes.status, 200);
    const rateData = (await rateRes.json()) as { success: boolean; level?: any };
    assert.strictEqual(rateData.success, true);
    assert.strictEqual(rateData.level.ratingCount, 1);
    assert.strictEqual(rateData.level.averageRating, 5);
    console.log(`✅ Rating test passed: Level rated 5 stars`);

    // 7. User B submits high score (POST /api/levels/:id/highscore)
    const scoreRes = await fetch(`${baseUrl}/api/levels/${levelId}/highscore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 4500, userName: userB.name }),
    });
    assert.strictEqual(scoreRes.status, 200);
    const scoreData = (await scoreRes.json()) as { success: boolean; level?: any };
    assert.strictEqual(scoreData.success, true);
    assert.strictEqual(scoreData.level.highScore, 4500);
    assert.strictEqual(scoreData.level.highScoreUser, userB.name);
    console.log(`✅ High score test passed: High score 4500 set for ${userB.name}`);

    // 8. List custom levels (GET /api/levels)
    const listRes = await fetch(`${baseUrl}/api/levels`);
    assert.strictEqual(listRes.status, 200);
    const listData = (await listRes.json()) as { success: boolean; levels?: any[] };
    assert.strictEqual(listData.success, true);
    const foundHeader = listData.levels?.find((l: any) => l.id === levelId);
    assert.ok(foundHeader, "Created level header should be present in listing");
    assert.strictEqual(foundHeader.averageRating, 5);
    assert.strictEqual(foundHeader.highScore, 4500);
    assert.strictEqual(foundHeader.highScoreUser, userB.name);
    console.log(`✅ GET /api/levels listed level with correct aggregated metadata`);

    // 9. User B attempts to delete User A's level -> Expect 403 Forbidden
    const deleteForbiddenRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${userB.id}` },
    });
    assert.strictEqual(deleteForbiddenRes.status, 403);
    console.log(`✅ Delete authorization check verified: User B cannot delete User A's level (403 Forbidden)`);

    // 10. User A deletes own level -> Expect 200 OK
    const deleteOkRes = await fetch(`${baseUrl}/api/levels/${levelId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${userA.id}` },
    });
    assert.strictEqual(deleteOkRes.status, 200);
    console.log(`✅ User A deleted own level successfully`);

    // 11. Fetch deleted level -> Expect 404
    const getDeletedRes = await fetch(`${baseUrl}/api/levels/${levelId}`);
    assert.strictEqual(getDeletedRes.status, 404);
    console.log(`✅ GET /api/levels/:id returned 404 for deleted level`);

    console.log("\n🎉 ALL CUSTOM LEVELS REST API TESTS PASSED SUCCESSFULLY!");
  } finally {
    httpServer.close();

    // Clean up test data from Firebase Realtime Database
    const db = getFirebaseDatabase();
    if (db) {
      if (userA) {
        await db.ref(`usernames/${userA.name.toLowerCase()}`).remove();
        await db.ref(`users/${userA.id}`).remove();
      }
      if (userB) {
        await db.ref(`usernames/${userB.name.toLowerCase()}`).remove();
        await db.ref(`users/${userB.id}`).remove();
      }
      if (levelId) {
        await db.ref(`levels/${levelId}`).remove();
      }
      // Also clean up any orphan test usernames starting with levelauthor_ or levelplayer_
      try {
        const usernamesSnap = await db.ref("usernames").get();
        if (usernamesSnap.exists()) {
          const namesMap = usernamesSnap.val() as Record<string, string>;
          for (const [key, uid] of Object.entries(namesMap)) {
            if (key.startsWith("levelauthor_") || key.startsWith("levelplayer_")) {
              await db.ref(`usernames/${key}`).remove();
              await db.ref(`users/${uid}`).remove();
            }
          }
        }
      } catch (e) {}
    }
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });


