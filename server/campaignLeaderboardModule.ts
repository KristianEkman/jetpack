/* ==========================================================================
   CAMPAIGN LEADERBOARD MODULE
   Manages Top 10 High Scores for Single-Player Campaign with Firebase RTDB
   and In-Memory Fallback.
   ========================================================================== */

import { getFirebaseDatabase } from "./firebase.js";
import {
  CampaignLeaderboardEntry,
  CampaignLeaderboardResponse,
  SubmitCampaignScoreRequest,
  SubmitCampaignScoreResponse,
} from "../js/shared/payloads.js";

const LEADERBOARD_LIMIT = 10;
const RTDB_PATH = "campaign_leaderboard";

/**
 * In-memory store fallback for offline play, local dev, or testing.
 */
const inMemoryScores: Map<string, CampaignLeaderboardEntry> = new Map();

/**
 * Sort comparator for leaderboard entries:
 * 1. Score descending
 * 2. Level reached descending
 * 3. Timestamp ascending (earlier record achieved gets precedence)
 */
function sortEntries(a: CampaignLeaderboardEntry, b: CampaignLeaderboardEntry): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (b.levelReached !== a.levelReached) {
    return b.levelReached - a.levelReached;
  }
  return a.timestamp - b.timestamp;
}

/**
 * Fetches all leaderboard entries either from Firebase RTDB or in-memory fallback.
 */
async function getAllEntries(): Promise<CampaignLeaderboardEntry[]> {
  const db = getFirebaseDatabase();
  if (db) {
    try {
      const snap = await db.ref(RTDB_PATH).get();
      if (snap.exists()) {
        const val = snap.val() as Record<string, CampaignLeaderboardEntry>;
        const entries: CampaignLeaderboardEntry[] = [];
        for (const key of Object.keys(val)) {
          const item = val[key];
          if (item && typeof item.score === "number" && item.userId) {
            entries.push({
              userId: String(item.userId),
              userName: String(item.userName || "Unknown Pilot"),
              score: Math.floor(item.score),
              levelReached: Math.floor(item.levelReached || 1),
              completedCampaign: Boolean(item.completedCampaign),
              timestamp: Number(item.timestamp || Date.now()),
            });
          }
        }
        return entries;
      }
      return [];
    } catch (err) {
      console.warn("⚠️ Failed to load leaderboard from Firebase RTDB, falling back to memory:", err);
    }
  }

  return Array.from(inMemoryScores.values());
}

/**
 * Retrieves the Top 10 campaign leaderboard scores and qualification threshold.
 */
export async function getCampaignLeaderboard(
  currentUserId?: string,
): Promise<CampaignLeaderboardResponse> {
  const all = await getAllEntries();
  all.sort(sortEntries);

  const topScores = all.slice(0, LEADERBOARD_LIMIT);

  // Determine minimum score required to enter Top 10
  let minScoreToQualify = 1;
  if (topScores.length >= LEADERBOARD_LIMIT) {
    minScoreToQualify = topScores[LEADERBOARD_LIMIT - 1].score + 1;
  }

  let userRank: number | null = null;
  if (currentUserId) {
    const userIndex = all.findIndex((entry) => entry.userId === currentUserId);
    if (userIndex !== -1) {
      userRank = userIndex + 1;
    }
  }

  return {
    success: true,
    scores: topScores,
    minScoreToQualify,
    userRank,
  };
}

/**
 * Checks whether a given score would qualify for the Top 10.
 */
export async function isScoreQualifying(score: number, levelReached: number = 1): Promise<boolean> {
  if (score <= 0) return false;
  const leaderboard = await getCampaignLeaderboard();
  if (leaderboard.scores.length < LEADERBOARD_LIMIT) {
    return true;
  }
  const tenth = leaderboard.scores[LEADERBOARD_LIMIT - 1];
  if (score > tenth.score) return true;
  if (score === tenth.score && levelReached > tenth.levelReached) return true;
  return false;
}

/**
 * Submits a campaign run score for a authenticated user.
 * Preserves personal best (higher score or higher level if equal score).
 */
export async function submitCampaignScore(
  userId: string,
  userName: string,
  req: SubmitCampaignScoreRequest,
): Promise<SubmitCampaignScoreResponse> {
  if (!userId || !userName) {
    return { success: false, qualified: false, error: "Authentication required." };
  }

  const score = Math.floor(req.score);
  const levelReached = Math.max(1, Math.min(10, Math.floor(req.levelReached || 1)));
  const completedCampaign = Boolean(req.completedCampaign);

  if (score <= 0) {
    return { success: false, qualified: false, error: "Score must be greater than 0." };
  }

  const db = getFirebaseDatabase();
  let existing: CampaignLeaderboardEntry | null = null;

  if (db) {
    try {
      const snap = await db.ref(`${RTDB_PATH}/${userId}`).get();
      if (snap.exists()) {
        existing = snap.val() as CampaignLeaderboardEntry;
      }
    } catch (err) {
      console.warn("⚠️ Failed reading existing score from Firebase:", err);
    }
  } else {
    existing = inMemoryScores.get(userId) || null;
  }

  // Check if existing record is better than or equal to current attempt
  let newEntry: CampaignLeaderboardEntry;
  if (
    existing &&
    (existing.score > score ||
      (existing.score === score && existing.levelReached >= levelReached))
  ) {
    // Keep existing best
    newEntry = existing;
  } else {
    newEntry = {
      userId,
      userName,
      score,
      levelReached,
      completedCampaign,
      timestamp: Date.now(),
    };

    if (db) {
      try {
        await db.ref(`${RTDB_PATH}/${userId}`).set(newEntry);
      } catch (err) {
        console.warn("⚠️ Failed persisting score to Firebase RTDB:", err);
      }
    }
    inMemoryScores.set(userId, newEntry);
  }

  // Calculate new rank in overall leaderboard
  const all = await getAllEntries();
  all.sort(sortEntries);

  const rankIndex = all.findIndex((e) => e.userId === userId);
  const rank = rankIndex !== -1 ? rankIndex + 1 : null;
  const qualified = rank !== null && rank <= LEADERBOARD_LIMIT;
  const top10 = all.slice(0, LEADERBOARD_LIMIT);

  return {
    success: true,
    qualified,
    rank,
    entry: newEntry,
    scores: top10,
  };
}

/**
 * Resets in-memory store and optionally wipes Firebase RTDB path for automated tests.
 * Returns the snapshot of all existing entries so the caller can restore them after the test.
 */
export async function resetCampaignLeaderboardForTest(): Promise<CampaignLeaderboardEntry[]> {
  const snapshot = await getAllEntries();
  inMemoryScores.clear();
  const db = getFirebaseDatabase();
  if (db) {
    try {
      await db.ref(RTDB_PATH).remove();
    } catch (err) {
      console.warn("⚠️ Failed to clear leaderboard RTDB for test:", err);
    }
  }
  return snapshot;
}

/**
 * Restores a previously saved snapshot of leaderboard entries into Firebase RTDB
 * and in-memory store. Used by tests to undo their side-effects.
 */
export async function restoreCampaignLeaderboardSnapshot(
  entries: CampaignLeaderboardEntry[],
): Promise<void> {
  inMemoryScores.clear();
  const db = getFirebaseDatabase();
  for (const entry of entries) {
    inMemoryScores.set(entry.userId, entry);
    if (db) {
      try {
        await db.ref(`${RTDB_PATH}/${entry.userId}`).set(entry);
      } catch (err) {
        console.warn("⚠️ Failed to restore leaderboard entry in RTDB:", err);
      }
    }
  }
}
