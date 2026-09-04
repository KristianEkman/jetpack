/* ==========================================================================
   CAMPAIGN LEADERBOARD SERVICE
   Handles API communication for fetching and submitting campaign Top 10 scores.
   ========================================================================== */

import {
  CampaignLeaderboardResponse,
  SubmitCampaignScoreRequest,
  SubmitCampaignScoreResponse,
} from "../shared/payloads.js";
import { userService } from "./userService.js";

export class LeaderboardService {
  private static instance: LeaderboardService | null = null;

  public static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  public async getLeaderboard(): Promise<CampaignLeaderboardResponse> {
    const userId = userService.getLoggedInUserId();
    const url = userId
      ? `/api/leaderboard/campaign?userId=${encodeURIComponent(userId)}`
      : "/api/leaderboard/campaign";

    try {
      const res = await fetch(url);
      if (!res.ok) {
        return {
          success: false,
          scores: [],
          minScoreToQualify: 1,
          error: `HTTP ${res.status}`,
        };
      }
      return (await res.json()) as CampaignLeaderboardResponse;
    } catch (err) {
      return {
        success: false,
        scores: [],
        minScoreToQualify: 1,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  public async checkIfScoreQualifies(score: number, levelReached: number = 1): Promise<boolean> {
    if (score <= 0) return false;
    try {
      const res = await fetch("/api/leaderboard/campaign/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, levelReached }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { success: boolean; qualified: boolean };
      return Boolean(data.qualified);
    } catch {
      return false;
    }
  }

  public async submitScore(req: SubmitCampaignScoreRequest): Promise<SubmitCampaignScoreResponse> {
    const userId = userService.getLoggedInUserId();
    if (!userId) {
      return {
        success: false,
        qualified: false,
        error: "Pilot must be logged in to record high score.",
      };
    }

    try {
      const res = await fetch("/api/leaderboard/campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(req),
      });
      return (await res.json()) as SubmitCampaignScoreResponse;
    } catch (err) {
      return {
        success: false,
        qualified: false,
        error: err instanceof Error ? err.message : "Network error submitting score",
      };
    }
  }
}

export const leaderboardService = LeaderboardService.getInstance();
