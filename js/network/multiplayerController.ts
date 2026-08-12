/* ==========================================================================
   MULTIPLAYER CONTROLLER
   Handles Socket.IO network event bindings, lobby views, room lists, and multiplayer match lifecycle.
   ========================================================================== */

import { GAME_STATES, type Game } from "../game.js";
import {
  CAMPAIGN_LEVELS,
  type CampaignLevelConfig,
} from "../levels/campaign.js";
import { MULTIPLAYER_MODES } from "../shared/constants.js";
import {
  GameOverPayload,
  GameStartedPayload,
  LevelCompletePayload,
  MultiplayerLevelData,
  MultiplayerPlayer,
  MultiplayerRoomInfo,
  PublicRoomInfo,
} from "../shared/payloads.js";
import { TILE_SIZE, TILES } from "../world/tilemap.js";

type PlayableLevelData = CampaignLevelConfig | MultiplayerLevelData;

export class MultiplayerController {
  game: Game;
  customMapDataPayload: MultiplayerLevelData | null;

  constructor(game: Game) {
    this.game = game;
    this.customMapDataPayload = null;
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

  bindMultiplayerUI(): void {
    const game = this.game;
    const tabCreate = document.getElementById("tabCreateRoom");
    const tabPublic = document.getElementById("tabPublicRooms");
    const viewCreate = document.getElementById("viewCreateRoom");
    const viewPublic = document.getElementById("viewPublicRooms");
    const viewLobby = document.getElementById("viewRoomLobby");

    const switchTab = (
      activeTab: HTMLElement | null,
      activeView: HTMLElement | null,
    ): void => {
      [tabCreate, tabPublic].forEach((tab) => {
        if (tab) {
          tab.classList.remove("active");
          tab.setAttribute("aria-selected", "false");
        }
      });
      [viewCreate, viewPublic, viewLobby].forEach((view) =>
        view?.classList.add("hidden"),
      );

      if (activeTab) {
        activeTab.classList.add("active");
        activeTab.setAttribute("aria-selected", "true");
      }
      activeView?.classList.remove("hidden");
      document.getElementById("mpTabs")?.classList.remove("hidden");
      document.getElementById("mpProfileSetup")?.classList.remove("hidden");
    };

    tabCreate?.addEventListener("click", () =>
      switchTab(tabCreate, viewCreate),
    );
    tabPublic?.addEventListener("click", () => {
      switchTab(tabPublic, viewPublic);
      game.network.listRooms();
    });

    const selectLevel = document.getElementById(
      "selectRoomLevel",
    ) as HTMLSelectElement | null;
    const uploadGroup = document.getElementById("groupCustomMapUpload");
    const fileInput = document.getElementById(
      "inputCustomMapFile",
    ) as HTMLInputElement | null;
    const statusText = document.getElementById("customMapStatusText");

    selectLevel?.addEventListener("change", () => {
      if (selectLevel.value === "custom") {
        uploadGroup?.classList.remove("hidden");
        try {
          if (!this.customMapDataPayload && this.game.editor) {
            this.customMapDataPayload = this.game.editor.getExportData() as MultiplayerLevelData;
            if (statusText) {
              statusText.textContent = `Using Editor map: "${this.customMapDataPayload.name || "Custom Level"}"`;
            }
          }
        } catch {}
      } else {
        uploadGroup?.classList.add("hidden");
      }
    });

    fileInput?.addEventListener("change", (event: Event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent: ProgressEvent<FileReader>) => {
        try {
          if (typeof loadEvent.target?.result !== "string") {
            throw new Error("The selected file could not be read as text.");
          }
          const parsed = JSON.parse(
            loadEvent.target.result,
          ) as Partial<MultiplayerLevelData>;
          if (Array.isArray(parsed.grid) && parsed.grid.length === 540) {
            this.customMapDataPayload = parsed as MultiplayerLevelData;
            if (statusText) {
              statusText.textContent = `Loaded map: "${parsed.name || file.name}" (${parsed.grid.length} tiles)`;
            }
          } else {
            console.error(
              "Invalid level JSON file! Grid must contain 540 tiles (30x18).",
            );
          }
        } catch {
          console.error("Error parsing map JSON file.");
        }
      };
      reader.readAsText(file);
    });

    const hostNameInput = document.getElementById(
      "inputHostName",
    ) as HTMLInputElement | null;
    if (hostNameInput) {
      try {
        const savedName = localStorage.getItem("jetpack_player_name");
        if (savedName) hostNameInput.value = savedName;
      } catch {}

      hostNameInput.addEventListener("input", () => {
        const value = hostNameInput.value.trim();
        if (value) {
          try {
            localStorage.setItem("jetpack_player_name", value);
          } catch {}
        }
      });
    }

    try {
      const savedColor = localStorage.getItem("jetpack_player_color");
      if (savedColor) game.selectedColor = savedColor;
    } catch {}

    const colorChips = document.querySelectorAll<HTMLElement>(".color-chip");
    colorChips.forEach((chip) => {
      const chipColor = chip.dataset.color || "#ff4444";
      chip.classList.toggle("active", chipColor === game.selectedColor);
      chip.addEventListener("click", () => {
        colorChips.forEach((item) => item.classList.remove("active"));
        chip.classList.add("active");
        const color = chip.dataset.color || "#ff4444";
        game.selectedColor = color;
        try {
          localStorage.setItem("jetpack_player_color", color);
        } catch {}
      });
    });

    document
      .getElementById("btnCreateRoomSubmit")
      ?.addEventListener("click", () => {
        const hostName =
          (
            document.getElementById("inputHostName") as HTMLInputElement | null
          )?.value.trim() || "Host Pilot";
        try {
          localStorage.setItem("jetpack_player_name", hostName);
          if (game.selectedColor) {
            localStorage.setItem("jetpack_player_color", game.selectedColor);
          }
        } catch {}

        const levelValue =
          (
            document.getElementById(
              "selectRoomLevel",
            ) as HTMLSelectElement | null
          )?.value || "0";
        const selectedGameMode = document.querySelector<HTMLInputElement>(
          'input[name="mpGameMode"]:checked',
        )?.value;
        const createOptions = {
          playerName: hostName,
          playerColor: game.selectedColor,
          gameMode:
            selectedGameMode === MULTIPLAYER_MODES.COMPETE
              ? MULTIPLAYER_MODES.COMPETE
              : MULTIPLAYER_MODES.COOP,
          levelIndex: undefined as number | undefined,
          customMapData: undefined as MultiplayerLevelData | undefined,
        };

        if (levelValue === "custom") {
          if (!this.customMapDataPayload) {
            try {
              if (this.game.editor) {
                this.customMapDataPayload = this.game.editor.getExportData() as MultiplayerLevelData;
              }
            } catch {}
          }
          if (!this.customMapDataPayload) {
            console.error(
              "Please upload a valid custom map JSON file or build one in the Level Editor!",
            );
            return;
          }
          createOptions.customMapData = this.customMapDataPayload;
        } else {
          createOptions.levelIndex = parseInt(levelValue, 10);
        }

        game.network.createRoom(createOptions);
      });

    document
      .getElementById("btnRefreshRooms")
      ?.addEventListener("click", () => {
        game.network.listRooms();
      });

    document.getElementById("btnLeaveRoom")?.addEventListener("click", () => {
      game.network.leaveRoom(() => {
        switchTab(tabCreate, viewCreate);
        game.uiManager.showBanner("LEFT ROOM");
      });
    });

    document
      .getElementById("btnStartMultiplayerGame")
      ?.addEventListener("click", () => {
        const playerCount = game.network.currentRoom?.players.length || 0;
        if (playerCount < 2) {
          game.uiManager.showBanner("NEED AT LEAST 2 PLAYERS TO START!");
          return;
        }
        game.network.startMatch();
      });

    document
      .getElementById("btnCloseMultiplayer")
      ?.addEventListener("click", () => {
        game.network.leaveRoom();
        game.uiManager.showDialog("dlgMainMenu");
      });
  }

  showLobbyView(): void {
    const viewCreate = document.getElementById("viewCreateRoom");
    const viewPublic = document.getElementById("viewPublicRooms");
    const viewLobby = document.getElementById("viewRoomLobby");
    [viewCreate, viewPublic].forEach((view) => view?.classList.add("hidden"));
    viewLobby?.classList.remove("hidden");
    document.getElementById("mpTabs")?.classList.add("hidden");
    document.getElementById("mpProfileSetup")?.classList.add("hidden");
  }

  updateLobbyUI(room: MultiplayerRoomInfo): void {
    if (!room) return;

    const codeElement = document.getElementById("displayRoomCode");
    if (codeElement) codeElement.textContent = room.id;
    const countElement = document.getElementById("lobbyPlayerCount");
    if (countElement) countElement.textContent = `${room.players.length}`;
    const mapNameElement = document.getElementById("displayRoomMapName");
    if (mapNameElement) {
      mapNameElement.textContent =
        room.mapName || `Level ${room.levelIndex + 1}`;
    }
    const gameModeElement = document.getElementById("displayRoomGameMode");
    if (gameModeElement) {
      const isCompeteMatch = room.gameMode === MULTIPLAYER_MODES.COMPETE;
      gameModeElement.textContent = isCompeteMatch ? "⚔️ COMPETE" : "🤝 CO-OP";
      gameModeElement.style.color = isCompeteMatch ? "#ff2a5f" : "#00ffcc";
    }

    const listElement = document.getElementById("lobbyPlayerList");
    if (!listElement) return;
    listElement.innerHTML = "";

    const isHost = this.game.network.socketId === room.hostSocketId;
    const startButton = document.getElementById(
      "btnStartMultiplayerGame",
    ) as HTMLButtonElement | null;
    if (startButton) {
      if (!isHost) {
        startButton.classList.add("hidden");
        startButton.disabled = true;
        startButton.textContent = "🚀 START MULTIPLAYER";
        startButton.title = "";
      } else {
        startButton.classList.remove("hidden");
        const canStart = room.players.length >= 2;
        startButton.disabled = !canStart;
        startButton.textContent = canStart
          ? "🚀 START MULTIPLAYER"
          : "⌛ WAITING FOR PLAYERS";
        startButton.title = canStart
          ? ""
          : "At least 2 players are required to start";
      }
    }

    room.players.forEach((player: MultiplayerPlayer) => {
      const card = document.createElement("div");
      card.className = "lobby-player-card";
      card.innerHTML = `
        <div class="player-info-group">
          <div class="player-color-dot" style="background: ${player.color};"></div>
          <span class="player-name-text">${player.name} ${player.isHost ? '<span class="host-badge">HOST</span>' : ""}</span>
        </div>
        <span style="font-size: 0.8rem; color: #00ffcc;">READY</span>
      `;
      listElement.appendChild(card);
    });
  }

  renderPublicRoomsList(list: PublicRoomInfo[]): void {
    try {
      const container = document.getElementById("publicRoomsList");
      if (!container) {
        console.warn("publicRoomsList element not found in DOM");
        return;
      }
      container.innerHTML = "";

      if (list.length === 0) {
        container.innerHTML =
          '<p class="empty-list-note">No active public rooms found. Create one!</p>';
        return;
      }

      list.forEach((room) => {
        const row = document.createElement("div");
        row.className = "lobby-player-card";
        row.style.cursor = "pointer";
        const statusBadge =
          room.status === "playing"
            ? '<span style="font-size: 0.75rem; color: #ffaa00; background: rgba(255,170,0,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">[PLAYING]</span>'
            : '<span style="font-size: 0.75rem; color: #00ffcc; background: rgba(0,255,204,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">[LOBBY]</span>';
        const modeBadge =
          room.gameMode === MULTIPLAYER_MODES.COMPETE
            ? '<span style="font-size: 0.75rem; color: #ff6b8a;">[COMPETE]</span>'
            : '<span style="font-size: 0.75rem; color: #00ffcc;">[CO-OP]</span>';

        row.innerHTML = `
          <div class="player-info-group">
            <strong style="color: #00f0ff; letter-spacing: 2px;">${room.id}</strong>
            <span style="font-size: 0.85rem; color: #aaa;">(${room.playerCount}/${room.maxPlayers} Pilots)</span>
            <span style="font-size: 0.8rem; color: #ffee55;">[${room.mapName || "Map"}]</span>
            ${modeBadge}
            ${statusBadge}
          </div>
          <button class="btn-editor primary">JOIN</button>
        `;

        row.addEventListener("click", () => {
          const joinName =
            (
              document.getElementById(
                "inputHostName",
              ) as HTMLInputElement | null
            )?.value.trim() || "Wingman";
          try {
            localStorage.setItem("jetpack_player_name", joinName);
            if (this.game.selectedColor) {
              localStorage.setItem(
                "jetpack_player_color",
                this.game.selectedColor,
              );
            }
          } catch {}
          this.game.network.joinRoom(room.id, {
            playerName: joinName,
            playerColor: this.game.selectedColor,
          });
        });

        container.appendChild(row);
      });
    } catch (error: unknown) {
      console.error("❌ Error rendering public rooms list:", error);
    }
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
    room?.players.forEach((player) => {
      game.playerManager.addPlayer(player.socketId, {
        id: player.id,
        name: player.name,
        color: player.color,
        isLocal: player.socketId === game.network.socketId,
        showNameTag: true,
        x: player.x ?? 128,
        y: player.y ?? 100,
      });
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

  updateLevelCompleteHostState(
    room: MultiplayerRoomInfo | null | undefined = this.game.network
      .currentRoom,
  ): void {
    const game = this.game;
    const isHost = room ? game.network.socketId === room.hostSocketId : false;
    const nextButton = document.getElementById(
      "btnNextLevel",
    ) as HTMLButtonElement | null;
    if (!nextButton) return;

    if (isHost) {
      nextButton.disabled = false;
      nextButton.textContent = "🚀 NEXT LEVEL";
    } else {
      nextButton.disabled = true;
      nextButton.textContent = "⌛ WAITING FOR HOST...";
    }
  }

  renderMultiplayerResults(
    containerId: string,
    tableBodyId: string,
    players: MultiplayerPlayer[],
  ): void {
    const container = document.getElementById(containerId);
    const tableBody = document.getElementById(tableBodyId);
    if (!container || !tableBody) return;

    container.classList.remove("hidden");
    tableBody.replaceChildren();

    const rankedPlayers = [...players].sort((left, right) => {
      const scoreDifference = (right.score ?? 0) - (left.score ?? 0);
      return scoreDifference || left.name.localeCompare(right.name);
    });

    if (rankedPlayers.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "empty-results";
      cell.textContent = "No player results available";
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    rankedPlayers.forEach((player, index) => {
      const row = document.createElement("tr");
      if (player.socketId === this.game.network.socketId) {
        row.classList.add("local-player");
      }

      const values = [
        `${index + 1}`,
        player.name || "Player",
        `${Math.round(player.score ?? 0)}`,
        `${Math.round(player.fuel ?? 0)}%`,
        `${Math.max(0, player.lives ?? 0)}`,
      ];

      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
      tableBody.appendChild(row);
    });
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
    this.renderMultiplayerResults(
      "multiplayerLevelResults",
      "levelResultsBody",
      players,
    );

    const subtitle = document.getElementById("dialogLevelCompleteSub");
    if (subtitle) {
      subtitle.textContent = `MATCH CLEARED BY ${data.clearedBy ? data.clearedBy.toUpperCase() : "TEAM"}!`;
    }

    this.updateLevelCompleteHostState(data.room || game.network.currentRoom);
    game.uiManager.showDialog("dlgLevelComplete");
  }

  updateGameOverHostState(
    room: MultiplayerRoomInfo | null | undefined = this.game.network
      .currentRoom,
  ): void {
    const game = this.game;
    const retryButton = document.getElementById(
      "btnRetryLevel",
    ) as HTMLButtonElement | null;
    if (!retryButton) return;

    if (game.isMultiplayer) {
      const isHost = room ? game.network.socketId === room.hostSocketId : false;
      if (isHost) {
        retryButton.disabled = false;
        retryButton.textContent = "🔄 RETRY MATCH";
      } else {
        retryButton.disabled = true;
        retryButton.textContent = "⌛ WAITING FOR HOST TO RETRY...";
      }
    } else {
      retryButton.disabled = false;
      retryButton.textContent = "🔄 RETRY LEVEL";
    }
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
    this.renderMultiplayerResults(
      "multiplayerGameOverResults",
      "gameOverResultsBody",
      players,
    );

    this.updateGameOverHostState(data.room || game.network.currentRoom);
    game.uiManager.showBanner(
      isCompeteMatch
        ? data.winnerName
          ? `${data.winnerName.toUpperCase()} WINS THE MATCH!`
          : "MATCH ENDED IN A DRAW"
        : "ALL PLAYERS ELIMINATED - GAME OVER",
    );
    game.uiManager.showDialog("dlgGameOver");
  }
}
