/* ==========================================================================
   SYSTEM & HEALTH REST API ROUTES
   ========================================================================== */

import { Router, Request, Response } from "express";
import type { Server } from "socket.io";
import type { RoomManager } from "../roomManager.js";
import type { GameLoop } from "../gameLoop.js";

export interface SystemRouterOptions {
  roomManager: RoomManager;
  gameLoop: GameLoop;
  io: Server;
  serverCommitHash: string;
  deployedAt: string;
}

export function createSystemRouter(options: SystemRouterOptions): Router {
  const { roomManager, gameLoop, io, serverCommitHash, deployedAt } = options;
  const router = Router();

  router.get("/api/version", (_req: Request, res: Response): void => {
    res.json({
      commitHash: serverCommitHash,
      deployedAt: deployedAt,
    });
  });

  router.get("/health", (_req: Request, res: Response): void => {
    const mem = process.memoryUsage();
    const roomStats = roomManager.getStats();
    const loopMetrics = gameLoop.getMetrics();
    const connectedSockets = io.sockets.sockets.size;

    res.json({
      status: "ok",
      uptime: Math.round(process.uptime() * 10) / 10,
      timestamp: new Date().toISOString(),
      version: {
        commitHash: serverCommitHash,
        deployedAt: deployedAt,
      },
      activeRooms: roomStats.totalRooms, // Backwards compatible with legacy check
      rooms: roomStats,
      players: {
        connectedSockets,
        totalInRooms: roomStats.totalPlayers,
        inActiveGame: roomStats.inGamePlayers,
      },
      gameLoop: loopMetrics,
      memory: {
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      },
    });
  });

  return router;
}
