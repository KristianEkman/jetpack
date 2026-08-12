import crypto from "node:crypto";
import { getFirebaseDatabase } from "./firebase.js";

export interface UserProfile {
  id: string;
  name: string;
}

export interface UserAuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

/**
 * Hashes password using PBKDF2 with SHA-256 and a random salt.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const saltHex = salt || crypto.randomBytes(16).toString("hex");
  const hashHex = crypto
    .pbkdf2Sync(password, saltHex, 1000, 64, "sha256")
    .toString("hex");
  return { hash: hashHex, salt: saltHex };
}

/**
 * Creates a user with a unique name and hashed password in Firebase RTDB.
 * Enforces case-insensitive uniqueness check for usernames.
 */
export async function createUser(name: string, password: string): Promise<UserAuthResult> {
  const trimmedName = name ? name.trim() : "";
  if (trimmedName.length < 1) {
    return { success: false, error: "Username must be at least 1 character long." };
  }
  if (!password || password.length < 1) {
    return { success: false, error: "Password must be at least 1 character long." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const normalizedName = trimmedName.toLowerCase();
  const usernameRef = db.ref(`usernames/${normalizedName}`);

  // Check if username already exists
  const existingUserSnap = await usernameRef.get();
  if (existingUserSnap.exists()) {
    return { success: false, error: "Username is already taken." };
  }

  const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const { hash, salt } = hashPassword(password);

  const updates: Record<string, unknown> = {};
  updates[`usernames/${normalizedName}`] = userId;
  updates[`users/${userId}`] = {
    id: userId,
    username: trimmedName,
    passwordHash: hash,
    salt: salt,
    createdAt: Date.now(),
  };

  try {
    await db.ref().update(updates);
    return {
      success: true,
      user: {
        id: userId,
        name: trimmedName,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user.";
    return { success: false, error: message };
  }
}

/**
 * Logs in a user by verifying name and password against Firebase RTDB.
 */
export async function loginUser(name: string, password: string): Promise<UserAuthResult> {
  const trimmedName = name ? name.trim() : "";
  if (trimmedName.length < 1 || !password || password.length < 1) {
    return { success: false, error: "Username and password are required." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const normalizedName = trimmedName.toLowerCase();
  const usernameSnap = await db.ref(`usernames/${normalizedName}`).get();

  if (!usernameSnap.exists()) {
    return { success: false, error: "Invalid username or password." };
  }

  const userId = usernameSnap.val() as string;
  const userSnap = await db.ref(`users/${userId}`).get();

  if (!userSnap.exists()) {
    return { success: false, error: "Invalid username or password." };
  }

  const userData = userSnap.val() as {
    id: string;
    username: string;
    passwordHash: string;
    salt: string;
  };

  const { hash } = hashPassword(password, userData.salt);
  if (hash !== userData.passwordHash) {
    return { success: false, error: "Invalid username or password." };
  }

  return {
    success: true,
    user: {
      id: userData.id,
      name: userData.username,
    },
  };
}

/**
 * Retrieves public user profile by unique user ID.
 */
export async function getUserById(id: string): Promise<UserProfile | null> {
  if (!id) return null;
  const db = getFirebaseDatabase();
  if (!db) return null;

  try {
    const userSnap = await db.ref(`users/${id}`).get();
    if (!userSnap.exists()) return null;
    const userData = userSnap.val() as { id: string; username: string };
    return {
      id: userData.id,
      name: userData.username,
    };
  } catch {
    return null;
  }
}
