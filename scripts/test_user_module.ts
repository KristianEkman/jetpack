import assert from "node:assert/strict";
import { createUser, loginUser, getUserById, hashPassword } from "../server/userModule.js";

console.log("🧪 Starting User Module Integration & Unit Test Suite...\n");

// 1. Test Password Hashing
console.log("1️⃣ Testing password hashing...");
const pass = "secret123";
const hashed1 = hashPassword(pass);
assert.ok(hashed1.hash.length > 0, "Hash should be non-empty");
assert.ok(hashed1.salt.length > 0, "Salt should be non-empty");
const hashed2 = hashPassword(pass, hashed1.salt);
assert.equal(hashed1.hash, hashed2.hash, "Same salt and password should produce identical hash");
console.log("   ✅ Password hashing & salt verification passed.\n");

// 2. Test Input Validation
console.log("2️⃣ Testing input validation for user creation...");
const emptyNameResult = await createUser("", "password");
assert.equal(emptyNameResult.success, false);
assert.ok(emptyNameResult.error?.includes("at least 1 character"), "Should reject empty username");

const emptyPassResult = await createUser("ValidUser", "");
assert.equal(emptyPassResult.success, false);
assert.ok(emptyPassResult.error?.includes("at least 1 character"), "Should reject empty password");
console.log("   ✅ Validation rules for name and password length passed.\n");

// 3. Test Database operations (if Firebase available) or mock
console.log("3️⃣ Testing User creation & uniqueness logic...");
const testUsername = `TestUser_${Date.now()}`;
const res1 = await createUser(testUsername, "pass123");

if (!res1.success && res1.error === "Database service unavailable.") {
  console.log("   ⚠️ Firebase DB offline/unavailable locally. Skipping live DB test.");
} else {
  assert.equal(res1.success, true, `User creation failed: ${res1.error}`);
  assert.ok(res1.user?.id, "User ID should be generated");
  assert.equal(res1.user?.name, testUsername);
  console.log(`   ✅ Created user '${testUsername}' with ID ${res1.user?.id}`);

  // Test Case-Insensitive Uniqueness
  const duplicateUpper = testUsername.toUpperCase();
  const resDup = await createUser(duplicateUpper, "otherPass");
  assert.equal(resDup.success, false);
  assert.equal(resDup.error, "Username is already taken.");
  console.log(`   ✅ Username uniqueness check (case-insensitive for '${duplicateUpper}') passed.`);

  // Test Login
  const loginSuccess = await loginUser(testUsername.toLowerCase(), "pass123");
  assert.equal(loginSuccess.success, true);
  assert.equal(loginSuccess.user?.id, res1.user?.id);
  console.log("   ✅ Login with valid credentials and case-insensitive username passed.");

  const loginWrongPass = await loginUser(testUsername, "wrongPass");
  assert.equal(loginWrongPass.success, false);
  assert.equal(loginWrongPass.error, "Invalid username or password.");
  console.log("   ✅ Login with invalid password rejected correctly.");

  // Test getUserById
  const fetchedUser = await getUserById(res1.user!.id);
  assert.ok(fetchedUser);
  assert.equal(fetchedUser?.id, res1.user!.id);
  assert.equal(fetchedUser?.name, testUsername);
  console.log("   ✅ getUserById retrieved correct profile.");

  // Clean up created test user from DB
  const { getFirebaseDatabase } = await import("../server/firebase.js");
  const db = getFirebaseDatabase();
  if (db && res1.user?.id) {
    const normalizedName = testUsername.toLowerCase();
    await db.ref(`users/${res1.user.id}`).remove();
    await db.ref(`usernames/${normalizedName}`).remove();

    // Also clean up any legacy TestUser_* entries from earlier runs
    const usernamesSnap = await db.ref("usernames").get();
    if (usernamesSnap.exists()) {
      const usernamesObj = usernamesSnap.val() as Record<string, string>;
      for (const [uname, uid] of Object.entries(usernamesObj)) {
        if (uname.startsWith("testuser_")) {
          await db.ref(`usernames/${uname}`).remove();
          await db.ref(`users/${uid}`).remove();
        }
      }
    }

    console.log("   🧹 Cleaned up test user and legacy test entries from Firebase DB.");
  }
}

console.log("\n🎉 All User Module tests completed successfully!\n");
process.exit(0);
