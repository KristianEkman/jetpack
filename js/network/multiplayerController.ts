/* ==========================================================================
   MULTIPLAYER ORCHESTRATION CONTROLLER
   Handles Socket.IO network event bindings, match orchestration, and delegates DOM UI.
   ========================================================================== */

import { GAME_STATES, type Game } from "../game.js";
import {
  CAMPAIGN_LEVELS,
  type CampaignLevelConfig,
} from "../levels/campaign.js";
import { MULTIPLAYER_MODES } from "../shared/constants.js";
import type {
  GameOverPayload,
  GameStartedPayload,
  LevelCompletePayload,
  MultiplayerLevelData,
  MultiplayerPlayer,
  MultiplayerRoomInfo,
  PublicRoomInfo,
} from "../shared/payloads.js";
import { TILE_SIZE, TILES } from "../world/tilemap.js";
import { MultiplayerUI } from "./multiplayerUI.js";

type PlayableLevelData = CampaignLevelConfig | MultiplayerLevelData;

export class MultiplayerController {
  game: Game;
  ui: MultiplayerUI;

  constructor(game: Game) {
    this.game = game;
    this.ui = new MultiplayerUI(game);
  }

  get customMapDataPayload(): MultiplayerLevelData | null {
    return this.ui.customMapDataPayload;
  }

  set customMapDataPayload(value: MultiplayerLevelData | null) {
    this.ui.customMapDataPayload = value;
  }

  initNetwork(): void {
    const game = this.game;

    game.network.onRoomCreatedCb = (data) => {
      game.playerManager.setLocalSocketId(game.network.socketId!);
      this.updateLobbyUI(data.room);
      this.showLobbyView();
      game.uiManager.showBanner(`ROOM ${data.roomId} CREATED!`);
    };

    game.network.onRoomJoinedCb = (data) => {
      game.playerManager.setLocalSocketId(game.network.socketId!);
      this.updateLobbyUI(data.room);
      this.showLobbyView();
      game.uiManager.showBanner(`JOINED ROOM ${data.room.id}!`);
    };

    game.network.onPlayerJoinedCb = (data) => {
      if (data.room) this.updateLobbyUI(data.room);
      if (data.player) {
        game.uiManager.showBanner(`${data.player.name.toUpperCase()} JOINED!`);
      }
    };

    game.network.onPlayerLeftCb = (data) => {
      if (data.room) this.updateLobbyUI(data.room);
      if (data.leavingPlayer) {
        game.uiManager.showBanner(
          `${data.leavingPlayer.name.toUpperCase()} LEFT`,
        );
      }
      if (game.gameState === GAME_STATES.LEVEL_COMPLETE && game.isMultiplayer) {
        this.updateLevelCompleteHostState(data.room);
      }
    };

    game.network.onRoomUpdatedCb = (data) => {
      if (data.room) {
        this.updateLobbyUI(data.room);
        game.uiManager.showBanner(
          `MAP UPDATED TO ${data.room.mapName?.toUpperCase() || "NEW LEVEL"}!`,
        );
      }
    };

    game.network.onGameStartedCb = (payload) => {
      this.startMultiplayerMatch(payload);
    };

    game.network.onTilePhasedCb = (data) => {
      if (game.isMultiplayer && game.tileMap && data) {
        game.tileMap.phaseTile(data.col, data.row);
        if (game.audio?.playPhaseImpact) {
          game.audio.playPhaseImpact();
        } else {
          game.audio?.playExplosion?.();
        }
      }
    };

    game.network.onTileRestoredCb = (data) => {
      if (game.isMultiplayer && game.tileMap && data) {
        game.tileMap.restoreTile(data.col, data.row);
      }
    };

    game.network.onItemCollectedCb = (data) => {
      if (game.isMultiplayer && game.tileMap && data) {
        game.tileMap.setTile(data.col, data.row, TILES.AIR);
        game.tileMap.collectedEmeralds = data.collectedEmeralds;
        if (data.tileType === TILES.EMERALD) {
          if (data.isAllCaught) {
            game.audio?.playAllDiamondsCaught?.();
            game.tileMap.addSparkles(
              data.col * TILE_SIZE + 16,
              data.row * TILE_SIZE + 16,
              "#00e5ff",
              25,
            );
            game.tileMap.addSparkles(
              data.col * TILE_SIZE + 16,
              data.row * TILE_SIZE + 16,
              "#00ff77",
              25,
            );
          } else {
            game.audio?.playEmeraldPickup?.();
            game.tileMap.addSparkles(
              data.col * TILE_SIZE + 16,
              data.row * TILE_SIZE + 16,
              "#00e5ff",
              12,
            );
          }
        } else if (data.tileType === TILES.FUEL) {
          game.audio?.playFuelPickup?.();
          game.tileMap.addSparkles(
            data.col * TILE_SIZE + 16,
            data.row * TILE_SIZE + 16,
            "#ffaa00",
            14,
          );
        } else if (data.tileType === TILES.GOLD) {
          game.audio?.playEmeraldPickup?.();
          game.tileMap.addSparkles(
            data.col * TILE_SIZE + 16,
            data.row * TILE_SIZE + 16,
            "#f1c40f",
            10,
          );
        } else if (data.tileType === TILES.EXTRA_LIFE) {
          game.audio?.playExtraLifePickup?.();
          game.tileMap.addSparkles(
            data.col * TILE_SIZE + 16,
            data.row * TILE_SIZE + 16,
            "#ff2d55",
            15,
          );
          game.tileMap.addSparkles(
            data.col * TILE_SIZE + 16,
            data.row * TILE_SIZE + 16,
            "#ff88a5",
            12,
          );
        } else if (data.tileType === TILES.RAPID_FIRE) {
          game.audio?.playRapidFirePickup?.();
          game.tileMap.addSparkles(
            data.col * TILE_SIZE + 16,
            data.row * TILE_SIZE + 16,
            "#ffaa00",
            15,
          );
          game.tileMap.addSparkles(
            data.col * TILE_SIZE + 16,
            data.row * TILE_SIZE + 16,
            "#00f0ff",
            15,
          );
        }
      }
    };

    game.network.onEnemyDestroyedCb = (data) => {
      if (!game.isMultiplayer || !data.enemyId) return;

      const enemy = game.enemyManager.removeEnemyById(data.enemyId);
      if (!enemy) return;

      game.tileMap.addSparkles(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        "#ff0055",
        25,
      );
      game.audio?.playExplosion?.();
    };

    game.network.onLevelCompleteCb = (data) => {
      if (game.isMultiplayer) this.triggerMultiplayerLevelComplete(data);
    };

    game.network.onGameOverCb = (data) => {
      if (game.isMultiplayer) this.triggerMultiplayerGameOver(data);
    };

    game.network.onWorldSnapshotCb = (snapshot) => {
      if (
        game.isMultiplayer &&
        (game.gameState === GAME_STATES.PLAYING ||
          game.gameState === GAME_STATES.SPECTATING)
      ) {
        if (game.network.interpolationDelay) {
          game.playerManager.interpolationDelay =
            game.network.interpolationDelay;
        }
        game.playerManager.updateFromSnapshot(snapshot);
        if (snapshot.enemies) {
          game.enemyManager.applyEnemySnapshot(
            snapshot.enemies,
            snapshot.projectiles,
          );
        }
        const localPlayer = game.playerManager.getLocalPlayer();
        if (localPlayer) game.player = localPlayer;
      }
    };

    game.network.onRoomListCb = (list) => {
      this.renderPublicRoomsList(list);
    };

    game.network.onErrorCb = (errMsg: string) => {
      console.error(`Multiplayer Error: ${errMsg}`);
    };
  }

  startMultiplayerMatch(payload: GameStartedPayload | null = null): void {
    const game = this.game;
    game.isMultiplayer = true;
    const room = payload?.room || game.network.currentRoom;

    let levelData: PlayableLevelData = CAMPAIGN_LEVELS[0];
    if (payload?.customMapData) {
      levelData = payload.customMapData;
      game.isCustomLevel = true;
    } else if (room?.customMapData) {
      levelData = room.customMapData;
      game.isCustomLevel = true;
    } else if (payload?.levelIndex !== undefined) {
      game.currentLevelIndex = payload.levelIndex;
      levelData = CAMPAIGN_LEVELS[payload.levelIndex] || CAMPAIGN_LEVELS[0];
      game.isCustomLevel = false;
    } else if (room?.levelIndex !== undefined) {
      game.currentLevelIndex = room.levelIndex;
      levelData = CAMPAIGN_LEVELS[room.levelIndex] || CAMPAIGN_LEVELS[0];
      game.isCustomLevel = false;
    }

    game.tileMap.loadLevelData(levelData);
    game.enemyManager.clear();
    levelData.flitzers?.forEach((enemy) =>
      game.enemyManager.addFlitzer(enemy.x, enemy.y, enemy.vx, enemy.vy),
    );
    levelData.missiles?.forEach((enemy) =>
      game.enemyManager.addHomingMissile(enemy.x, enemy.y),
    );
    levelData.turrets?.forEach((enemy) =>
      game.enemyManager.addTurret(enemy.x, enemy.y, enemy.fireInterval),
    );
    game.levelManager.spawnEnemiesFromGrid();

    const destroyedEnemyIds =
      payload?.destroyedEnemyIds ?? room?.destroyedEnemyIds ?? [];
    for (const enemyId of destroyedEnemyIds) {
      game.enemyManager.removeEnemyById(enemyId);
    }

    game.playerManager.clear();
    game.playerManager.setLocalSocketId(game.network.socketId!);
    const spawns =
      game.tileMap.spawnPoints && game.tileMap.spawnPoints.length > 0
        ? game.tileMap.spawnPoints
        : [game.tileMap.getPrimarySpawnPoint()];

    let pIdx = 0;
    room?.players.forEach((player) => {
      const defaultSpawn = spawns[pIdx % spawns.length] || spawns[0];
      game.playerManager.addPlayer(player.socketId, {
        id: player.id,
        name: player.name,
        color: player.color,
        isLocal: player.socketId === game.network.socketId,
        showNameTag: true,
        x: player.x ?? defaultSpawn.x,
        y: player.y ?? defaultSpawn.y,
      });
      pIdx++;
    });

    const localPlayer = game.playerManager.getLocalPlayer();
    if (localPlayer) game.player = localPlayer;

    game.gameState = GAME_STATES.PLAYING;
    game.audio.startGameMusic(game.currentLevelIndex || 0);
    game.uiManager.closeAllDialogs();
    game.uiManager.showBanner(
      room?.gameMode === MULTIPLAYER_MODES.COMPETE
        ? "COMPETE MATCH STARTED - LAST PILOT STANDING!"
        : "CO-OP MATCH STARTED!",
    );
  }

  triggerMultiplayerLevelComplete(data: LevelCompletePayload): void {
    const game = this.game;
    game.gameState = GAME_STATES.LEVEL_COMPLETE;
    game.audio.stopThrust();
    if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
    game.audio.stopMusic();
    game.audio.playPortalWarp();

    const fuelBonus = Math.floor((game.player ? game.player.fuel : 0) * 10);
    const levelScore = 1000 + fuelBonus;
    const statLevelScore = document.getElementById("statLevelScore");
    const statFuelBonus = document.getElementById("statFuelBonus");
    const statTotalScore = document.getElementById("statTotalScore");
    if (statLevelScore) statLevelScore.textContent = "1000";
    if (statFuelBonus) statFuelBonus.textContent = `${fuelBonus}`;
    if (statTotalScore) {
      statTotalScore.textContent = `${(game.player ? game.player.score : 0) + levelScore}`;
    }

    document.getElementById("levelCompleteStats")?.classList.add("hidden");
    const players =
      data.players ??
      data.room?.players ??
      game.network.currentRoom?.players ??
      [];
    this.ui.renderMultiplayerResults(
      "multiplayerLevelResults",
      "levelResultsBody",
      players,
    );

    const subtitle = document.getElementById("dialogLevelCompleteSub");
    if (subtitle) {
      subtitle.textContent = `MATCH CLEARED BY ${data.clearedBy ? data.clearedBy.toUpperCase() : "TEAM"}!`;
    }

    this.ui.updateLevelCompleteHostState(data.room || game.network.currentRoom);
    game.uiManager.showDialog("dlgLevelComplete");
  }

  triggerMultiplayerGameOver(data: GameOverPayload = {}): void {
    const game = this.game;
    game.gameState = GAME_STATES.GAME_OVER;
    game.audio?.stopThrust?.();
    if (game.audio?.stopEnergyDrain) game.audio.stopEnergyDrain();

    const isCompeteMatch = data.reason === "compete_match_complete";
    const title = document.getElementById("gameOverTitle");
    if (title) title.textContent = isCompeteMatch ? "MATCH OVER" : "GAME OVER";
    const message = document.getElementById("gameOverMessage");
    if (message) {
      if (isCompeteMatch) {
        message.classList.remove("hidden");
        message.textContent = data.winnerName
          ? `🏆 ${data.winnerName.toUpperCase()} WINS!`
          : "DRAW - NO PILOTS REMAIN";
      } else {
        message.classList.add("hidden");
        message.textContent = "";
      }
    }

    const stats = document.getElementById("gameOverStats");
    if (stats) {
      stats.classList.add("hidden");
    }

    const players =
      data.players ??
      data.room?.players ??
      game.network.currentRoom?.players ??
      [];
    this.ui.renderMultiplayerResults(
      "multiplayerGameOverResults",
      "gameOverResultsBody",
      players,
    );

    this.ui.updateGameOverHostState(data.room || game.network.currentRoom);
    game.uiManager.showBanner(
      isCompeteMatch
        ? data.winnerName
          ? `${data.winnerName.toUpperCase()} WINS THE MATCH!`
          : "MATCH ENDED IN A DRAW"
        : "ALL PLAYERS ELIMINATED - GAME OVER",
    );
    game.uiManager.showDialog("dlgGameOver");
  }

  // --- UI Delegation Methods for 100% Backwards Compatibility ---

  bindMultiplayerUI(): void {
    this.ui.bindMultiplayerUI();
  }

  showHubView(): void {
    this.ui.showHubView();
  }

  showLobbyView(): void {
    this.ui.showLobbyView();
  }

  async populateLevelDropdown(selectElement: HTMLSelectElement): Promise<void> {
    return this.ui.populateLevelDropdown(selectElement);
  }

  async handleLevelSelectChange(selectElement: HTMLSelectElement): Promise<void> {
    return this.ui.handleLevelSelectChange(selectElement);
  }

  updateLobbyUI(room: MultiplayerRoomInfo): void {
    this.ui.updateLobbyUI(room);
  }

  renderPublicRoomsList(list: PublicRoomInfo[]): void {
    this.ui.renderPublicRoomsList(list);
  }

  renderMultiplayerResults(
    containerId: string,
    tableBodyId: string,
    players: MultiplayerPlayer[],
  ): void {
    this.ui.renderMultiplayerResults(containerId, tableBodyId, players);
  }

  updateLevelCompleteHostState(
    room: MultiplayerRoomInfo | null | undefined = this.game.network.currentRoom,
  ): void {
    this.ui.updateLevelCompleteHostState(room);
  }

  updateGameOverHostState(
    room: MultiplayerRoomInfo | null | undefined = this.game.network.currentRoom,
  ): void {
    this.ui.updateGameOverHostState(room);
  }
}
