/* ==========================================================================
   JETPACK RETRO MULTIPLAYER - AUTHORITATIVE GAME SERVER
   ========================================================================== */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { execSync } from "child_process";
import { RoomManager } from "./roomManager.js";
import { GameLoop } from "./gameLoop.js";
import { initFirebaseAdmin } from "./firebase.js";
import { createSystemRouter } from "./routes/systemRoutes.js";
import { createUserRouter } from "./routes/userRoutes.js";
import { createLevelRouter } from "./routes/levelRoutes.js";
import { createLeaderboardRouter } from "./routes/leaderboardRoutes.js";
import { registerSocketHandlers } from "./socket/socketHandlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

let serverCommitHash = "dev";
let deployedAt = new Date().toISOString();

function loadVersionInfo(): void {
  const distVersionFile = path.join(distDir, "version.json");
  const rootVersionFile = path.join(rootDir, "version.json");

  try {
    if (fs.existsSync(distVersionFile)) {
      const data = JSON.parse(fs.readFileSync(distVersionFile, "utf8"));
      serverCommitHash = data.commitHash || serverCommitHash;
      deployedAt = data.deployedAt || deployedAt;
      return;
    }
  } catch (e) {}

  try {
    if (fs.existsSync(rootVersionFile)) {
      const data = JSON.parse(fs.readFileSync(rootVersionFile, "utf8"));
      serverCommitHash = data.commitHash || serverCommitHash;
      deployedAt = data.deployedAt || deployedAt;
      return;
    }
  } catch (e) {}

  try {
    const gitHash = execSync("git rev-parse --short HEAD", { cwd: rootDir })
      .toString()
      .trim();
    if (gitHash) {
      serverCommitHash = gitHash;
    }
  } catch (e) {}
}

loadVersionInfo();
initFirebaseAdmin();

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

export const roomManager = new RoomManager();
export const gameLoop = new GameLoop(roomManager, io, 60);

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.use(express.static(rootDir));

// Mount modular REST routers
app.use(createSystemRouter({ roomManager, gameLoop, io, serverCommitHash, deployedAt }));
app.use(createUserRouter());
app.use(createLevelRouter());
app.use(createLeaderboardRouter());

// Register Socket.IO event handlers
registerSocketHandlers(io, roomManager, gameLoop);

const PORT = process.env.PORT || 3000;

if (
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"))
) {
  gameLoop.start();
  httpServer.listen(PORT, () => {
    console.log(
      `🚀 Jetpack Multiplayer Server listening on http://localhost:${PORT}`,
    );
  });
}

export { app, httpServer, io };
