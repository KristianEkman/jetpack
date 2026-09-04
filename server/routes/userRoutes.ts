/* ==========================================================================
   USER AUTH REST API ROUTES
   ========================================================================== */

import { Router, Request, Response } from "express";
import { createUser, loginUser, getUserById } from "../userModule.js";

export function createUserRouter(): Router {
  const router = Router();

  router.post("/api/users/register", async (req: Request, res: Response): Promise<void> => {
    const { name, password } = req.body || {};
    const result = await createUser(name, password);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  router.post("/api/users/login", async (req: Request, res: Response): Promise<void> => {
    const { name, password } = req.body || {};
    const result = await loginUser(name, password);
    if (!result.success) {
      res.status(401).json(result);
      return;
    }
    res.json(result);
  });

  router.get("/api/users/me/:id", async (req: Request, res: Response): Promise<void> => {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, user });
  });

  return router;
}
