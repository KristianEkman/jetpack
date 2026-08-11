/* ==========================================================================
   MASTER GAME CONTROLLER
   Coordinates core game loop, state transitions, and sub-managers.
   ========================================================================== */

import { GameLoop } from "./engine/loop.js";
import { InputHandler } from "./engine/input.js";
import { AudioManager } from "./audio/index.js";
import { TileMap, TILE_SIZE, TILES } from "./world/tilemap.js";
import { Player } from "./entities/player.js";
import { EnemyManager } from "./entities/enemy/index.js";
import { LevelEditor } from "./editor/level_editor.js";
import { PlayerManager } from "./entities/playerManager.js";
import { NetworkManager } from "./network/networkManager.js";

import { UIManager } from "./ui/uiManager.js";
import { LevelManager } from "./levels/levelManager.js";
import { MultiplayerController } from "./network/multiplayerController.js";
import { initErrorMonitor } from "./ui/errorMonitor.js";
import {
  MultiplayerRoomInfo,
  PublicRoomInfo,
  GameStartedPayload,
  LevelCompletePayload,
  GameOverPayload,
} from "./shared/payloads.js";

export const GAME_STATES = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  LEVEL_EDITOR: "level_editor",
  GAME_OVER: "game_over",
  LEVEL_COMPLETE: "level_complete",
  SPECTATING: "spectating",
} as const;

export type GameState = (typeof GAME_STATES)[keyof typeof GAME_STATES];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  audio: AudioManager;
  input: InputHandler;
  tileMap: TileMap;
  player: Player;
  enemyManager: EnemyManager;

  playerManager: PlayerManager;
  network: NetworkManager;

  isMultiplayer: boolean;
  selectedColor: string;
  currentLevelIndex: number;
  gameState: GameState;
  isCustomLevel: boolean;
  isCanvasRenderedForState: boolean;

  deathSequenceTimer: number;
  isDeathHandled: boolean;

  uiManager: UIManager;
  levelManager: LevelManager;
  multiplayerController: MultiplayerController;
  editor: LevelEditor;
  loop: GameLoop;

  constructor() {
    initErrorMonitor();

    this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;

    this.audio = new AudioManager();
    this.input = new InputHandler();
    this.tileMap = new TileMap();
    this.player = new Player(this.audio, this.tileMap, { showNameTag: false });
    this.enemyManager = new EnemyManager(this.tileMap, this.audio);

    this.playerManager = new PlayerManager(this.audio, this.tileMap);
    this.network = new NetworkManager();

    this.enemyManager.onEnemyDestroyed = ({ enemyId }: { enemyId: string }) => {
      if (this.isMultiplayer) {
        this.network.sendEnemyDestroyed(enemyId);
      }
    };

    this.isMultiplayer = false;
    try {
      this.selectedColor =
        localStorage.getItem("jetpack_player_color") || "#ff4444";
    } catch (e) {
      this.selectedColor = "#ff4444";
    }

    this.currentLevelIndex = 0;
    this.gameState = GAME_STATES.MENU;
    this.isCustomLevel = false;
    this.isCanvasRenderedForState = false;

    this.deathSequenceTimer = 0;
    this.isDeathHandled = false;

    this.uiManager = new UIManager(this);
    this.levelManager = new LevelManager(this);
    this.multiplayerController = new MultiplayerController(this);

    this.editor = new LevelEditor(
      this.canvas,
      this.tileMap,
      () => this.levelManager.playtestCustomLevel(),
      () => this.gameState === GAME_STATES.LEVEL_EDITOR,
    );

    this.loop = new GameLoop(
      (dt: number) => this.update(dt),
      (dt: number) => this.render(dt),
    );

    this.uiManager.bindUI();
    this.multiplayerController.initNetwork();
    this.multiplayerController.bindMultiplayerUI();
    this.audio.setupUserUnlock();
    this.uiManager.showDialog("dlgMainMenu");
    this.loop.start();
  }

  togglePause(): void {
    if (this.gameState === GAME_STATES.PLAYING) {
      this.gameState = GAME_STATES.PAUSED;
      this.audio.stopThrust();
      if (this.audio.stopEnergyDrain) this.audio.stopEnergyDrain();
      this.audio.stopMusic();
      this.uiManager.showDialog("dlgPause");
    }
  }

  resumeGame(): void {
    if (this.gameState === GAME_STATES.PAUSED) {
      this.gameState = GAME_STATES.PLAYING;
      this.audio.startGameMusic(this.currentLevelIndex);
      this.uiManager.closeAllDialogs();
    }
  }

  showDialog(dialogId: string): void {
    this.uiManager.showDialog(dialogId);
  }
  closeAllDialogs(): void {
    this.uiManager.closeAllDialogs();
  }
  showBanner(text: string): void {
    this.uiManager.showBanner(text);
  }
  updateHUD(): void {
    this.uiManager.updateHUD();
  }

  startLevel(index: number, isRestart: boolean = false): void {
    this.levelManager.startLevel(index, isRestart);
  }
  openLevelSelect(): void {
    this.levelManager.openLevelSelect();
  }
  openLevelEditor(): void {
    this.levelManager.openLevelEditor();
  }
  playtestCustomLevel(): void {
    this.levelManager.playtestCustomLevel();
  }
  spawnEnemiesFromGrid(): void {
    this.levelManager.spawnEnemiesFromGrid();
  }
  triggerLevelComplete(): void {
    this.levelManager.triggerLevelComplete();
  }
  exportLevelJSON(): void {
    this.levelManager.exportLevelJSON();
  }

  initNetwork(): void {
    this.multiplayerController.initNetwork();
  }
  bindMultiplayerUI(): void {
    this.multiplayerController.bindMultiplayerUI();
  }
  showLobbyView(): void {
    this.multiplayerController.showLobbyView();
  }
  updateLobbyUI(room: MultiplayerRoomInfo): void {
    this.multiplayerController.updateLobbyUI(room);
  }
  renderPublicRoomsList(list: PublicRoomInfo[]): void {
    this.multiplayerController.renderPublicRoomsList(list);
  }
  startMultiplayerMatch(payload?: GameStartedPayload): void {
    this.multiplayerController.startMultiplayerMatch(payload);
  }
  triggerMultiplayerLevelComplete(data?: LevelCompletePayload): void {
    if (data) this.multiplayerController.triggerMultiplayerLevelComplete(data);
  }
  triggerMultiplayerGameOver(data?: GameOverPayload): void {
    this.multiplayerController.triggerMultiplayerGameOver(data);
  }

  update(dt: number): void {
    if (
      this.gameState !== GAME_STATES.PLAYING &&
      this.gameState !== GAME_STATES.SPECTATING
    )
      return;

    let effectiveDt = dt;

    if (this.isMultiplayer) {
      this.enemyManager.interpolateEnemies(effectiveDt);
    }

    if (this.player.isDead) {
      this.deathSequenceTimer += dt;
      if (this.deathSequenceTimer < 0.25) {
        effectiveDt = dt * 0.15;
      } else if (this.deathSequenceTimer < 0.6) {
        effectiveDt = dt * 0.5;
      }

      this.audio.stopThrust();
      if (this.audio.stopEnergyDrain) this.audio.stopEnergyDrain();

      if (this.deathSequenceTimer >= 1.8 && !this.isDeathHandled) {
        this.isDeathHandled = true;
        if (this.player.lives <= 0) {
          if (this.isMultiplayer) {
            this.gameState = GAME_STATES.SPECTATING;
            this.uiManager.showBanner("OUT OF LIVES - SPECTATING");
          } else {
            this.gameState = GAME_STATES.GAME_OVER;
            const title = document.getElementById("gameOverTitle");
            if (title) title.textContent = "GAME OVER";
            const message = document.getElementById("gameOverMessage");
            if (message) {
              message.classList.add("hidden");
              message.textContent = "";
            }
            const stats = document.getElementById("gameOverStats");
            if (stats) {
              stats.classList.remove("hidden");
              stats.textContent = `Final Score: ${String(this.player.score).padStart(6, "0")}`;
            }
            document
              .getElementById("multiplayerGameOverResults")
              ?.classList.add("hidden");
            this.uiManager.showDialog("dlgGameOver");
          }
        } else if (this.isMultiplayer) {
          this.deathSequenceTimer = 0;
        } else {
          this.levelManager.startLevel(this.currentLevelIndex, true);
        }
      }
    } else if (this.isDeathHandled) {
      this.deathSequenceTimer = 0;
      this.isDeathHandled = false;
    }

    if (this.gameState === GAME_STATES.SPECTATING) {
      this.tileMap.update(effectiveDt, this.player, this.enemyManager);
      this.uiManager.updateHUD();
      return;
    }

    const wasAlive = !this.player.isDead;
    const currentInput = this.input.serializeInputState();

    this.tileMap.update(effectiveDt, this.player, this.enemyManager);
    this.player.update(effectiveDt, currentInput, this.enemyManager);

    if (this.isMultiplayer) {
      const netInput = this.input.serializeInputState(null, this.player);
      this.network.sendInput(netInput);
      this.playerManager.update(effectiveDt);
    } else {
      this.enemyManager.update(effectiveDt, [this.player]);
    }

    if (this.isMultiplayer && wasAlive && this.player.isDead) {
      this.network.sendPlayerDied("local_damage");
    }

    if (
      !this.player.isDead &&
      this.tileMap.isExitUnlocked(this.enemyManager)
    ) {
      const playerCol = Math.floor(
        (this.player.x + this.player.width / 2) / TILE_SIZE,
      );
      const playerRow = Math.floor(
        (this.player.y + this.player.height / 2) / TILE_SIZE,
      );

      if (
        this.tileMap.getTile(playerCol, playerRow) === TILES.EXIT_PORTAL
      ) {
        if (this.isMultiplayer) {
          this.gameState = GAME_STATES.LEVEL_COMPLETE;
          this.network.completeLevel();
        } else {
          this.levelManager.triggerLevelComplete();
        }
      }
    }

    this.uiManager.updateHUD();
  }

  render(dt: number, alpha: number = 1): void {
    if (
      this.gameState === GAME_STATES.PAUSED ||
      this.gameState === GAME_STATES.MENU ||
      this.gameState === GAME_STATES.GAME_OVER ||
      this.gameState === GAME_STATES.LEVEL_COMPLETE
    ) {
      if (this.isCanvasRenderedForState) return;
      this.isCanvasRenderedForState = true;
    } else {
      this.isCanvasRenderedForState = false;
    }

    this.ctx.fillStyle = "#05070c";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.tileMap.render(
      this.ctx,
      this.gameState === GAME_STATES.LEVEL_EDITOR,
      this.enemyManager,
    );
    this.enemyManager.render(this.ctx, this.player);

    if (this.isMultiplayer) {
      this.playerManager.render(this.ctx);
    } else {
      this.player.render(this.ctx);
    }

    if (this.gameState === GAME_STATES.LEVEL_EDITOR) {
      this.editor.renderHoverPreview(this.ctx);
    }

    if (this.gameState === GAME_STATES.SPECTATING) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255, 0, 85, 0.25)";
      this.ctx.fillRect(0, 0, this.canvas.width, 28);
      this.ctx.font = "bold 12px Orbitron, sans-serif";
      this.ctx.fillStyle = "#ff0055";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        "💀 OUT OF LIVES - SPECTATING MATCH",
        this.canvas.width / 2,
        18,
      );
      this.ctx.restore();
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    if (!(window as any).gameInstance) {
      (window as any).gameInstance = new Game();
    }
  });
}
