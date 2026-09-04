/* ==========================================================================
   CAMPAIGN LEADERBOARD REST API ROUTES
   ========================================================================== */

import { Router, Request, Response } from "express";
import { getUserById } from "../userModule.js";
import {
  getCampaignLeaderboard,
  isScoreQualifying,
  submitCampaignScore,
} from "../campaignLeaderboardModule.js";
import { getAuthUserId } from "./levelRoutes.js";

export function createLeaderboardRouter(): Router {
  const router = Router();

  // Get Top 10 campaign leaderboard
  router.get("/api/leaderboard/campaign", async (req: Request, res: Response): Promise<void> => {
    const userId = (typeof req.query.userId === "string" ? req.query.userId : null) || getAuthUserId(req);
    const result = await getCampaignLeaderboard(userId || undefined);
    res.json(result);
  });

  // Check if score qualifies for Top 10
  router.post("/api/leaderboard/campaign/qualify", async (req: Request, res: Response): Promise<void> => {
    const score = Number(req.body?.score) || 0;
    const levelReached = Number(req.body?.levelReached) || 1;
    const qualified = await isScoreQualifying(score, levelReached);
    res.json({ success: true, qualified });
  });

  // Submit campaign score (requires user authentication)
  router.post("/api/leaderboard/campaign", async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        qualified: false,
        error: "Authentication required to submit campaign high score.",
      });
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      res.status(401).json({
        success: false,
        qualified: false,
        error: "Invalid user account.",
      });
      return;
    }

    const result = await submitCampaignScore(user.id, user.name, req.body || {});
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  return router;
}
