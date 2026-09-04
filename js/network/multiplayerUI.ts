/* ==========================================================================
   MULTIPLAYER UI & DOM VIEW CONTROLLER
   ========================================================================== */

import type { Game } from "../game.js";
import { CAMPAIGN_LEVELS } from "../levels/campaign.js";
import { MULTIPLAYER_MODES } from "../shared/constants.js";
import type {
  MultiplayerPlayer,
  MultiplayerRoomInfo,
  PublicRoomInfo,
  MultiplayerLevelData,
} from "../shared/payloads.js";

export class MultiplayerUI {
  game: Game;
  customMapDataPayload: MultiplayerLevelData | null;

  constructor(game: Game) {
    this.game = game;
    this.customMapDataPayload = null;
  }

  bindMultiplayerUI(): void {
    const game = this.game;

    const selectLevel = document.getElementById(
      "selectRoomLevel",
    ) as HTMLSelectElement | null;
    const lobbySelectLevel = document.getElementById(
      "selectLobbyRoomLevel",
    ) as HTMLSelectElement | null;

    if (selectLevel) {
      this.populateLevelDropdown(selectLevel);
      selectLevel.addEventListener("change", () => {
        this.handleLevelSelectChange(selectLevel);
      });
    }

    if (lobbySelectLevel) {
      lobbySelectLevel.addEventListener("change", async () => {
        if (!this.game.network.currentRoom) return;
        const value = lobbySelectLevel.value;
        if (value.startsWith("custom_db_")) {
          const levelId = value.replace("custom_db_", "");
          const record = await this.game.levelManager.fetchCustomLevelById(levelId);
          if (record && Array.isArray(record.grid) && record.grid.length === 540) {
            this.customMapDataPayload = record as MultiplayerLevelData;
            this.game.network.changeLevel({
              customMapData: this.customMapDataPayload,
              mapName: record.name,
            });
          }
        } else {
          const idx = parseInt(value, 10);
          this.game.network.changeLevel({
            levelIndex: idx,
          });
        }
      });
    }

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

        if (levelValue.startsWith("custom_db_")) {
          if (!this.customMapDataPayload) {
            console.error("Custom level data is not ready yet!");
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
        this.showHubView();
        game.network.listRooms();
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

  showHubView(): void {
    const viewLobby = document.getElementById("viewRoomLobby");
    const mainHub = document.getElementById("mpMainHub");
    const profileSetup = document.getElementById("mpProfileSetup");

    viewLobby?.classList.add("hidden");
    mainHub?.classList.remove("hidden");
    profileSetup?.classList.remove("hidden");

    // Legacy support if elements exist
    document.getElementById("mpTabs")?.classList.remove("hidden");
    document.getElementById("viewCreateRoom")?.classList.remove("hidden");

    const selectLevel = document.getElementById(
      "selectRoomLevel",
    ) as HTMLSelectElement | null;
    if (selectLevel) {
      this.populateLevelDropdown(selectLevel);
    }
  }

  showLobbyView(): void {
    const viewLobby = document.getElementById("viewRoomLobby");
    const mainHub = document.getElementById("mpMainHub");
    const profileSetup = document.getElementById("mpProfileSetup");

    mainHub?.classList.add("hidden");
    profileSetup?.classList.add("hidden");
    viewLobby?.classList.remove("hidden");

    // Legacy support if elements exist
    document.getElementById("mpTabs")?.classList.add("hidden");
    document.getElementById("viewCreateRoom")?.classList.add("hidden");
    document.getElementById("viewPublicRooms")?.classList.add("hidden");
  }

  async populateLevelDropdown(selectElement: HTMLSelectElement): Promise<void> {
    const previousValue = selectElement.value;
    selectElement.innerHTML = "";

    const campaignGroup = document.createElement("optgroup");
    campaignGroup.label = "Campaign Levels";
    CAMPAIGN_LEVELS.forEach((level, idx) => {
      const option = document.createElement("option");
      option.value = `${idx}`;
      option.textContent = `Level ${idx + 1} - ${level.name}`;
      campaignGroup.appendChild(option);
    });
    selectElement.appendChild(campaignGroup);

    try {
      const customLevels = await this.game.levelManager.fetchCustomLevels();
      if (customLevels && customLevels.length > 0) {
        const dbGroup = document.createElement("optgroup");
        dbGroup.label = "Saved Custom Levels";
        customLevels.forEach((levelHeader) => {
          const option = document.createElement("option");
          option.value = `custom_db_${levelHeader.id}`;
          const ratingStr = levelHeader.averageRating
            ? ` (${levelHeader.averageRating}★)`
            : "";
          option.textContent = `🛠️ ${levelHeader.name} by ${levelHeader.authorName || "Unknown"}${ratingStr}`;
          dbGroup.appendChild(option);
        });
        selectElement.appendChild(dbGroup);
      }
    } catch (err) {
      console.error("Error fetching custom levels for dropdown:", err);
    }

    if (
      previousValue &&
      Array.from(selectElement.options).some((o) => o.value === previousValue)
    ) {
      selectElement.value = previousValue;
    }
  }

  async handleLevelSelectChange(
    selectElement: HTMLSelectElement,
  ): Promise<void> {
    const value = selectElement.value;
    if (value.startsWith("custom_db_")) {
      const levelId = value.replace("custom_db_", "");
      const record = await this.game.levelManager.fetchCustomLevelById(levelId);
      if (record && Array.isArray(record.grid) && record.grid.length === 540) {
        this.customMapDataPayload = record as MultiplayerLevelData;
      } else {
        console.error("Invalid custom level data loaded from database.");
      }
    } else {
      this.customMapDataPayload = null;
    }
  }

  setSelectDropdownValue(
    selectElement: HTMLSelectElement,
    room: MultiplayerRoomInfo,
  ): void {
    if (room.customMapData) {
      const dbMatch = Array.from(selectElement.options).find((o) =>
        o.text.includes(room.mapName || ""),
      );
      if (dbMatch) {
        selectElement.value = dbMatch.value;
      } else {
        selectElement.value = `${room.levelIndex || 0}`;
      }
    } else {
      selectElement.value = `${room.levelIndex}`;
    }
  }

  updateLobbyUI(room: MultiplayerRoomInfo): void {
    if (!room) return;

    const isHost = this.game.network.socketId === room.hostSocketId;
    const codeElement = document.getElementById("displayRoomCode");
    if (codeElement) codeElement.textContent = room.id;
    const countElement = document.getElementById("lobbyPlayerCount");
    if (countElement) countElement.textContent = `${room.players.length}`;
    const mapNameElement = document.getElementById("displayRoomMapName");
    const lobbySelectLevel = document.getElementById(
      "selectLobbyRoomLevel",
    ) as HTMLSelectElement | null;

    if (lobbySelectLevel) {
      if (isHost) {
        lobbySelectLevel.classList.remove("hidden");
        if (mapNameElement) mapNameElement.classList.add("hidden");
        if (lobbySelectLevel.options.length === 0) {
          this.populateLevelDropdown(lobbySelectLevel).then(() => {
            this.setSelectDropdownValue(lobbySelectLevel, room);
          });
        } else {
          this.setSelectDropdownValue(lobbySelectLevel, room);
        }
      } else {
        lobbySelectLevel.classList.add("hidden");
        if (mapNameElement) {
          mapNameElement.classList.remove("hidden");
          mapNameElement.textContent =
            room.mapName || `Level ${room.levelIndex + 1}`;
        }
      }
    } else if (mapNameElement) {
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
          '<p class="empty-list-note">No active public rooms found. Create one below to start!</p>';
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
}
