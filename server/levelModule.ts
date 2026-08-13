import crypto from "node:crypto";
import { getFirebaseDatabase } from "./firebase.js";
import {
  CustomLevelHeader,
  CustomLevelRecord,
  CustomLevelResult,
} from "../js/shared/payloads.js";

/**
 * Ensures a level object does not contain undefined fields when saving to Firebase RTDB.
 */
function sanitizeRecord(record: CustomLevelRecord): CustomLevelRecord {
  return {
    id: record.id,
    name: record.name,
    authorId: record.authorId,
    authorName: record.authorName || "Anonymous",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    grid: record.grid,
    spawnX: record.spawnX ?? 100,
    spawnY: record.spawnY ?? 100,
    flitzers: record.flitzers || [],
    missiles: record.missiles || [],
    turrets: record.turrets || [],
    bosses: record.bosses || [],
    highScore: record.highScore ?? 0,
    highScoreUser: record.highScoreUser || "None",
    ratingSum: record.ratingSum ?? 0,
    ratingCount: record.ratingCount ?? 0,
    averageRating: record.averageRating ?? 0,
    ratings: record.ratings || {},
    isReleased: record.isReleased !== undefined ? Boolean(record.isReleased) : true,
  };
}

/**
 * Creates a new custom level owned by authorId.
 */
export async function createCustomLevel(
  authorId: string,
  authorName: string,
  levelData: Partial<CustomLevelRecord>,
): Promise<CustomLevelResult> {
  if (!authorId) {
    return { success: false, error: "Authentication required to create custom level." };
  }

  const name = levelData.name ? levelData.name.trim() : "";
  if (name.length < 1) {
    return { success: false, error: "Level name must not be empty." };
  }

  if (!levelData.grid || !Array.isArray(levelData.grid) || levelData.grid.length === 0) {
    return { success: false, error: "Invalid level grid data." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const levelId = `lvl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = Date.now();

  const record: CustomLevelRecord = sanitizeRecord({
    id: levelId,
    name,
    authorId,
    authorName: authorName || "Anonymous",
    createdAt: now,
    updatedAt: now,
    grid: levelData.grid,
    spawnX: levelData.spawnX,
    spawnY: levelData.spawnY,
    flitzers: levelData.flitzers,
    missiles: levelData.missiles,
    turrets: levelData.turrets,
    bosses: levelData.bosses,
    highScore: 0,
    highScoreUser: "None",
    ratingSum: 0,
    ratingCount: 0,
    averageRating: 0,
    ratings: {},
    isReleased: levelData.isReleased !== undefined ? Boolean(levelData.isReleased) : true,
  });

  try {
    await db.ref(`levels/${levelId}`).set(record);
    return { success: true, level: record };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create custom level.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates an existing custom level. Only the author can update their level.
 */
export async function updateCustomLevel(
  levelId: string,
  authorId: string,
  levelData: Partial<CustomLevelRecord>,
): Promise<CustomLevelResult> {
  if (!levelId || !authorId) {
    return { success: false, error: "Level ID and authentication are required." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const levelRef = db.ref(`levels/${levelId}`);
  const snap = await levelRef.get();
  if (!snap.exists()) {
    return { success: false, error: "Custom level not found." };
  }

  const existing = snap.val() as CustomLevelRecord;
  if (existing.authorId !== authorId) {
    return { success: false, error: "Unauthorized: You can only edit your own custom levels." };
  }

  const updatedName = levelData.name ? levelData.name.trim() : existing.name;
  if (updatedName.length < 1) {
    return { success: false, error: "Level name must not be empty." };
  }

  const updatedRecord: CustomLevelRecord = sanitizeRecord({
    ...existing,
    name: updatedName,
    grid: levelData.grid || existing.grid,
    spawnX: levelData.spawnX ?? existing.spawnX,
    spawnY: levelData.spawnY ?? existing.spawnY,
    flitzers: levelData.flitzers ?? existing.flitzers,
    missiles: levelData.missiles ?? existing.missiles,
    turrets: levelData.turrets ?? existing.turrets,
    bosses: levelData.bosses ?? existing.bosses,
    isReleased: levelData.isReleased !== undefined ? Boolean(levelData.isReleased) : existing.isReleased ?? true,
    updatedAt: Date.now(),
  });

  try {
    await levelRef.set(updatedRecord);
    return { success: true, level: updatedRecord };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update custom level.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Retrieves a custom level by ID.
 */
export async function getCustomLevelById(levelId: string, requestingUserId?: string): Promise<CustomLevelResult> {
  if (!levelId) {
    return { success: false, error: "Level ID is required." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  try {
    const snap = await db.ref(`levels/${levelId}`).get();
    if (!snap.exists()) {
      return { success: false, error: "Custom level not found." };
    }
    const level = sanitizeRecord(snap.val() as CustomLevelRecord);
    if (level.isReleased === false && level.authorId !== requestingUserId) {
      return { success: false, error: "Custom level not found." };
    }
    return { success: true, level };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to get custom level.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Lists all custom levels (returns summary headers).
 */
export async function listCustomLevels(requestingUserId?: string): Promise<{ success: boolean; levels?: CustomLevelHeader[]; error?: string }> {
  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  try {
    const snap = await db.ref("levels").get();
    if (!snap.exists()) {
      return { success: true, levels: [] };
    }

    const rawData = snap.val() as Record<string, CustomLevelRecord>;
    const headers: CustomLevelHeader[] = Object.values(rawData)
      .map((lvl) => sanitizeRecord(lvl))
      .filter((sanitized) => sanitized.isReleased !== false || (requestingUserId && sanitized.authorId === requestingUserId))
      .map((sanitized) => ({
        id: sanitized.id,
        name: sanitized.name,
        authorId: sanitized.authorId,
        authorName: sanitized.authorName,
        createdAt: sanitized.createdAt,
        updatedAt: sanitized.updatedAt,
        highScore: sanitized.highScore,
        highScoreUser: sanitized.highScoreUser,
        averageRating: sanitized.averageRating,
        ratingCount: sanitized.ratingCount,
        isReleased: sanitized.isReleased,
      }));

    headers.sort((a, b) => b.createdAt - a.createdAt);

    return { success: true, levels: headers };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to list custom levels.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Deletes a custom level. Only the author can delete their level.
 */
export async function deleteCustomLevel(levelId: string, authorId: string): Promise<CustomLevelResult> {
  if (!levelId || !authorId) {
    return { success: false, error: "Level ID and authentication are required." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const levelRef = db.ref(`levels/${levelId}`);
  const snap = await levelRef.get();
  if (!snap.exists()) {
    return { success: false, error: "Custom level not found." };
  }

  const existing = snap.val() as CustomLevelRecord;
  if (existing.authorId !== authorId) {
    return { success: false, error: "Unauthorized: You can only delete your own custom levels." };
  }

  try {
    await levelRef.remove();
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete custom level.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Grades/rates a custom level (1 to 5 stars). Anyone can grade.
 */
export async function rateCustomLevel(
  levelId: string,
  raterId: string,
  rating: number,
): Promise<CustomLevelResult> {
  if (!levelId) {
    return { success: false, error: "Level ID is required." };
  }

  const validRating = Math.round(rating);
  if (isNaN(validRating) || validRating < 1 || validRating > 5) {
    return { success: false, error: "Rating must be an integer between 1 and 5." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const levelRef = db.ref(`levels/${levelId}`);
  const snap = await levelRef.get();
  if (!snap.exists()) {
    return { success: false, error: "Custom level not found." };
  }

  const existing = sanitizeRecord(snap.val() as CustomLevelRecord);
  const ratings = { ...(existing.ratings || {}) };
  const effectiveRaterId = raterId ? raterId.trim() : `anon_${crypto.randomBytes(4).toString("hex")}`;

  ratings[effectiveRaterId] = validRating;

  const ratingValues = Object.values(ratings);
  const ratingSum = ratingValues.reduce((sum, val) => sum + val, 0);
  const ratingCount = ratingValues.length;
  const averageRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

  const updatedRecord: CustomLevelRecord = sanitizeRecord({
    ...existing,
    ratings,
    ratingSum,
    ratingCount,
    averageRating,
  });

  try {
    await levelRef.set(updatedRecord);
    return { success: true, level: updatedRecord };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to rate custom level.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Submits a high score for a custom level. Updates if score is higher than current high score.
 */
export async function submitCustomLevelHighScore(
  levelId: string,
  score: number,
  userName: string,
): Promise<CustomLevelResult> {
  if (!levelId) {
    return { success: false, error: "Level ID is required." };
  }

  if (typeof score !== "number" || isNaN(score) || score < 0) {
    return { success: false, error: "Valid score is required." };
  }

  const db = getFirebaseDatabase();
  if (!db) {
    return { success: false, error: "Database service unavailable." };
  }

  const levelRef = db.ref(`levels/${levelId}`);
  const snap = await levelRef.get();
  if (!snap.exists()) {
    return { success: false, error: "Custom level not found." };
  }

  const existing = sanitizeRecord(snap.val() as CustomLevelRecord);
  const currentHighScore = existing.highScore || 0;

  if (score <= currentHighScore) {
    return {
      success: true,
      level: existing,
    };
  }

  const effectiveUserName = userName ? userName.trim() : "Anonymous";
  const updatedRecord: CustomLevelRecord = sanitizeRecord({
    ...existing,
    highScore: score,
    highScoreUser: effectiveUserName,
  });

  try {
    await levelRef.set(updatedRecord);
    return { success: true, level: updatedRecord };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to submit high score.";
    return { success: false, error: errorMsg };
  }
}
