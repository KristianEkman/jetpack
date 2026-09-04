/* ==========================================================================
   CUSTOM LEVELS REST API ROUTES
   ========================================================================== */

import { Router, Request, Response } from "express";
import { getUserById } from "../userModule.js";
import {
  createCustomLevel,
  listCustomLevels,
  getCustomLevelById,
  updateCustomLevel,
  deleteCustomLevel,
  rateCustomLevel,
  submitCustomLevelHighScore,
} from "../levelModule.js";

/**
 * Helper to extract user ID from auth header or request body
 */
export function getAuthUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers["x-user-id"];
  if (typeof customHeader === "string" && customHeader.trim().length > 0) {
    return customHeader.trim();
  }
  if (req.body && typeof req.body.userId === "string" && req.body.userId.trim().length > 0) {
    return req.body.userId.trim();
  }
  return null;
}

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export function createLevelRouter(): Router {
  const router = Router();

  // Create a custom level (requires auth)
  router.post("/api/levels", async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required to upload level." });
      return;
    }
    const user = await getUserById(userId);
    if (!user) {
      res.status(401).json({ success: false, error: "Invalid user account." });
      return;
    }

    const result = await createCustomLevel(user.id, user.name, req.body);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.status(201).json(result);
  });

  // List custom levels (unreleased levels shown only to owner)
  router.get("/api/levels", async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthUserId(req);
    const result = await listCustomLevels(userId || undefined);
    if (!result.success) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  });

  // Get custom level by ID (unreleased levels allowed only for owner)
  router.get("/api/levels/:id", async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthUserId(req);
    const levelId = getParamId(req);
    const result = await getCustomLevelById(levelId, userId || undefined);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  });

  // Update custom level (author only)
  router.put("/api/levels/:id", async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required to update level." });
      return;
    }
    const levelId = getParamId(req);
    const result = await updateCustomLevel(levelId, userId, req.body);
    if (!result.success) {
      const status = result.error?.includes("Unauthorized") ? 403 : result.error?.includes("not found") ? 404 : 400;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  });

  // Delete custom level (author only)
  router.delete("/api/levels/:id", async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required to delete level." });
      return;
    }
    const levelId = getParamId(req);
    const result = await deleteCustomLevel(levelId, userId);
    if (!result.success) {
      const status = result.error?.includes("Unauthorized") ? 403 : result.error?.includes("not found") ? 404 : 400;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  });

  // Rate custom level 1-5 stars (anyone)
  router.post("/api/levels/:id/rate", async (req: Request, res: Response): Promise<void> => {
    const raterId = getAuthUserId(req) || req.ip || "anonymous";
    const { rating } = req.body || {};
    const levelId = getParamId(req);
    const result = await rateCustomLevel(levelId, raterId, rating);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  // Submit high score for custom level (anyone)
  router.post("/api/levels/:id/highscore", async (req: Request, res: Response): Promise<void> => {
    const { score, userName } = req.body || {};
    const levelId = getParamId(req);
    const result = await submitCustomLevelHighScore(levelId, score, userName);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  return router;
}
