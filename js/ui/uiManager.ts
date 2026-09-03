/* ==========================================================================
   UI MANAGER
   Handles HUD rendering, modal dialogs, banner notifications, and UI event listeners.
   ========================================================================== */

import { Game, GAME_STATES } from "../game.js";
import { CAMPAIGN_LEVELS } from "../levels/campaign.js";
import { TILES } from "../world/tilemap.js";
import { userService } from "../network/userService.js";
import { userAuthUI } from "./userAuthUI.js";
import { serverHealthUI } from "./serverHealthUI.js";

export interface HUDState {
  level: string | null;
  score: number | null;
  lives: number | null;
  emeralds: string | null;
  fuel: number | null;
  powerupTime: string | null;
  activeWeapon: string | null;
  ammoSpread: number | null;
  ammoGrenade: number | null;
  ammoMissile: number | null;
}

export class UIManager {
  game: Game;

  hudLevelEl: HTMLElement | null;
  hudScoreEl: HTMLElement | null;
  hudLivesEl: HTMLElement | null;
  hudEmeraldsEl: HTMLElement | null;
  fuelBarFillEl: HTMLElement | null;
  fuelTextEl: HTMLElement | null;
  hudPowerupEl: HTMLElement | null;
  hudPowerupTextEl: HTMLElement | null;

  slotPhaseEl: HTMLElement | null;
  slotSpreadEl: HTMLElement | null;
  slotGrenadeEl: HTMLElement | null;
  slotMissileEl: HTMLElement | null;
  ammoSpreadEl: HTMLElement | null;
  ammoGrenadeEl: HTMLElement | null;
  ammoMissileEl: HTMLElement | null;

  hudState: HUDState;

  constructor(game: Game) {
    this.game = game;

    this.hudLevelEl = document.getElementById("hudLevel");
    this.hudScoreEl = document.getElementById("hudScore");
    this.hudLivesEl = document.getElementById("hudLives");
    this.hudEmeraldsEl = document.getElementById("hudEmeralds");
    this.fuelBarFillEl = document.getElementById("fuelBarFill");
    this.fuelTextEl = document.getElementById("fuelText");
    this.hudPowerupEl = document.getElementById("hudPowerup");
    this.hudPowerupTextEl = document.getElementById("hudPowerupText");

    this.slotPhaseEl = document.getElementById("weaponSlotPhase");
    this.slotSpreadEl = document.getElementById("weaponSlotSpread");
    this.slotGrenadeEl = document.getElementById("weaponSlotGrenade");
    this.slotMissileEl = document.getElementById("weaponSlotMissile");
    this.ammoSpreadEl = document.getElementById("ammoSpread");
    this.ammoGrenadeEl = document.getElementById("ammoGrenade");
    this.ammoMissileEl = document.getElementById("ammoMissile");

    this.hudState = {
      level: null,
      score: null,
      lives: null,
      emeralds: null,
      fuel: null,
      powerupTime: null,
      activeWeapon: null,
      ammoSpread: null,
      ammoGrenade: null,
      ammoMissile: null,
    };

    this.setupVisibilityHandler();
    this.initVersionBadge();
  }

  bindUI(): void {
    const game = this.game;

    this.initVersionBadge();
    serverHealthUI.init();

    const btnHudToggle = document.getElementById("btnHudToggle");
    const gameHud = document.getElementById("gameHud");

    btnHudToggle?.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      const isOpen = gameHud?.classList.toggle("hud-open");
      if (btnHudToggle) {
        btnHudToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        const toggleText = btnHudToggle.querySelector(".hud-toggle-text");
        if (toggleText) {
          toggleText.textContent = isOpen ? "HUD ▴" : "HUD ▾";
        }
      }
    });

    // Close HUD dropdown when clicking outside
    window.addEventListener("click", (e: MouseEvent) => {
      if (gameHud?.classList.contains("hud-open") && !(e.target as HTMLElement).closest("#gameHud")) {
        gameHud.classList.remove("hud-open");
        if (btnHudToggle) {
          btnHudToggle.setAttribute("aria-expanded", "false");
          const toggleText = btnHudToggle.querySelector(".hud-toggle-text");
          if (toggleText) toggleText.textContent = "HUD ▾";
        }
      }
    });

    document.getElementById("btnServerHealth")?.addEventListener("click", () => {
      serverHealthUI.openModal();
    });

    document
      .getElementById("btnPause")
      ?.addEventListener("click", () => game.togglePause());
    document.getElementById("btnSound")?.addEventListener("click", () => {
      if (typeof game.audio.toggleSfx === "function") {
        game.audio.toggleSfx();
      } else if (typeof game.audio.toggleMute === "function") {
        game.audio.toggleMute();
      }
      this.updateAudioButtons();
    });
    document.getElementById("btnMusic")?.addEventListener("click", () => {
      if (typeof game.audio.toggleMusic === "function") {
        game.audio.toggleMusic();
      }
      this.updateAudioButtons();
    });
    this.updateAudioButtons();
    this.slotPhaseEl?.addEventListener("click", () => {
      game.player.setWeapon("phase_beam");
      this.updateHUD();
    });
    this.slotSpreadEl?.addEventListener("click", () => {
      game.player.setWeapon("spread_cannon");
      this.updateHUD();
    });
    this.slotGrenadeEl?.addEventListener("click", () => {
      game.player.setWeapon("plasma_grenade");
      this.updateHUD();
    });
    this.slotMissileEl?.addEventListener("click", () => {
      game.player.setWeapon("seeker_missile");
      this.updateHUD();
    });

    document.getElementById("btnCRT")?.addEventListener("click", () => {
      document.getElementById("crtOverlay")?.classList.toggle("active");
    });

    document.getElementById("btnStartGame")?.addEventListener("click", () => {
      game.isMultiplayer = false;
      game.currentLevelIndex = 0;
      game.levelManager.startLevel(0);
    });

    document.getElementById("btnMultiplayer")?.addEventListener("click", () => {
      if (!userService.isLoggedIn()) {
        this.showBanner("PLEASE LOG IN TO PLAY MULTIPLAYER");
        userAuthUI.openModal();
        return;
      }
      this.showDialog("dlgMultiplayer");
      game.multiplayerController.showHubView();
      game.network.connect();
      game.network.listRooms();
    });

    document.getElementById("btnLevelSelect")?.addEventListener("click", () => {
      game.levelManager.openLevelSelect();
    });

    document.getElementById("btnCommunityLevels")?.addEventListener("click", () => {
      this.loadCommunityLevelsUI();
      this.showDialog("dlgCommunityLevels");
    });

    document.getElementById("btnRefreshCommunityLevels")?.addEventListener("click", () => {
      this.loadCommunityLevelsUI();
    });

    document.getElementById("btnCloseCommunityLevels")?.addEventListener("click", () => {
      this.showDialog("dlgMainMenu");
    });

    window.addEventListener("click", (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".community-level-dropdown")) {
        document.querySelectorAll(".community-level-dropdown-menu").forEach((el) => el.classList.add("hidden"));
        document.querySelectorAll(".community-level-card").forEach((el) => el.classList.remove("dropdown-open"));
      }
    });

    document.getElementById("btnOpenEditor")?.addEventListener("click", () => {
      game.levelManager.openLevelEditor();
    });

    document.getElementById("btnControls")?.addEventListener("click", () => {
      this.showDialog("dlgControls");
    });

    document
      .getElementById("btnCloseControls")
      ?.addEventListener("click", () => {
        if (game.gameState === GAME_STATES.PAUSED) {
          this.showDialog("dlgPause");
        } else {
          this.showDialog("dlgMainMenu");
        }
      });

    document
      .getElementById("btnResume")
      ?.addEventListener("click", () => game.resumeGame());
    document
      .getElementById("btnRestartLevel")
      ?.addEventListener("click", () => {
        this.closeAllDialogs();
        game.levelManager.restartCurrentLevel(true);
      });
    document
      .getElementById("btnPauseControls")
      ?.addEventListener("click", () => {
        this.showDialog("dlgControls");
      });
    document.getElementById("btnQuitToMenu")?.addEventListener("click", () => {
      if (game.isMultiplayer || game.network.currentRoom) {
        game.network.leaveRoom();
        game.isMultiplayer = false;
      }
      game.audio.stopThrust();
      if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
      game.audio.stopMusic();
      game.gameState = GAME_STATES.MENU;
      this.showDialog("dlgMainMenu");
    });

    document.getElementById("btnRetryLevel")?.addEventListener("click", () => {
      if (game.isMultiplayer) {
        game.network.startMatch();
      } else {
        this.closeAllDialogs();
        game.levelManager.restartCurrentLevel(false);
      }
    });
    document
      .getElementById("btnGameOverMenu")
      ?.addEventListener("click", () => {
        if (game.isMultiplayer || game.network.currentRoom) {
          game.network.leaveRoom();
          game.isMultiplayer = false;
        }
        game.audio.stopMusic();
        this.showDialog("dlgMainMenu");
      });

    document.getElementById("btnNextLevel")?.addEventListener("click", () => {
      if (game.isMultiplayer) {
        game.network.nextLevel();
        return;
      }
      this.closeAllDialogs();
      if (game.isCustomLevel) {
        game.levelManager.openLevelEditor();
      } else {
        game.currentLevelIndex++;
        if (game.currentLevelIndex >= CAMPAIGN_LEVELS.length) {
          game.audio.stopMusic();
          this.showBanner("CONGRATULATIONS! YOU BEAT THE CAMPAIGN!");
          setTimeout(() => this.showDialog("dlgMainMenu"), 2000);
        } else {
          game.levelManager.startLevel(game.currentLevelIndex, false, true);
        }
      }
    });
    document
      .getElementById("btnCompleteMenu")
      ?.addEventListener("click", () => {
        if (game.isMultiplayer || game.network.currentRoom) {
          game.network.leaveRoom();
          game.isMultiplayer = false;
        }
        game.audio.stopMusic();
        this.showDialog("dlgMainMenu");
      });

    document
      .getElementById("btnCloseLevelSelect")
      ?.addEventListener("click", () => {
        this.showDialog("dlgMainMenu");
      });

    document
      .getElementById("btnEditorPlay")
      ?.addEventListener("click", () =>
        game.levelManager.playtestCustomLevel(),
      );
    document.getElementById("btnEditorUpload")?.addEventListener("click", async () => {
      const loggedInUser = userService.getLoggedInUser();
      if (!loggedInUser) {
        this.showBanner("PLEASE LOG IN TO UPLOAD CUSTOM LEVELS");
        userAuthUI.openModal();
        return;
      }


      const validation = game.editor.validateLevel();
      if (!validation.valid) {
        this.showBanner(validation.error || "INVALID LEVEL FORMAT");
        return;
      }

      let name = game.editor.levelName;
      if (!name || name === "Custom Level") {
        const inputName = prompt("Enter a name for your custom level:", "My Custom Level");
        if (inputName && inputName.trim().length > 0) {
          name = inputName.trim();
          game.editor.levelName = name;
        } else {
          return;
        }
      }

      const chkRelease = document.getElementById("chkEditorIsReleased") as HTMLInputElement | null;
      const isReleased = chkRelease ? chkRelease.checked : true;
      game.editor.isReleased = isReleased;

      const exportData = game.editor.getExportData();
      const levelPayload = {
        name,
        grid: exportData.grid,
        isReleased,
      };

      if (game.editor.currentLevelId) {
        const res = await game.levelManager.updateCustomLevel(game.editor.currentLevelId, levelPayload);
        if (res.success && res.level) {
          this.showBanner(`LEVEL "${res.level.name.toUpperCase()}" UPDATED!`);
        } else {
          this.showBanner(res.error || "FAILED TO UPDATE LEVEL");
        }
      } else {
        const res = await game.levelManager.uploadCustomLevel(levelPayload);
        if (res.success && res.level) {
          game.editor.currentLevelId = res.level.id;
          this.showBanner(`LEVEL "${res.level.name.toUpperCase()}" UPLOADED!`);
        } else {
          this.showBanner(res.error || "FAILED TO UPLOAD LEVEL");
        }
      }
    });
    document.getElementById("btnEditorClear")?.addEventListener("click", () => {
      game.tileMap.grid.fill(TILES.AIR);
      this.showBanner("CANVAS CLEARED");
    });
    document.getElementById("btnEditorExit")?.addEventListener("click", () => {
      game.audio.stopMusic();
      document.getElementById("editorToolbar")?.classList.add("hidden");
      this.showDialog("dlgMainMenu");
    });

    game.input.onPausePress = () => {
      if (game.gameState === GAME_STATES.PLAYING) {
        game.togglePause();
      } else if (game.gameState === GAME_STATES.PAUSED) {
        game.resumeGame();
      }
    };
  }

  async loadCommunityLevelsUI(): Promise<void> {
    const listContainer = document.getElementById("communityLevelList");
    if (!listContainer) return;
    listContainer.innerHTML = `<div style="text-align:center; color: #00ffcc; padding: 20px;">Loading custom levels...</div>`;

    const levels = await this.game.levelManager.fetchCustomLevels();
    const currentUserId = userService.getLoggedInUserId();

    if (levels.length === 0) {
      listContainer.innerHTML = `<div style="text-align:center; color: rgba(255,255,255,0.7); padding: 20px;">No community custom levels found yet. Create and upload one!</div>`;
      return;
    }

    listContainer.innerHTML = "";
    levels.forEach((lvl) => {
      const card = document.createElement("div");
      card.className = "community-level-card";

      const ratingText = lvl.ratingCount > 0 ? `${lvl.averageRating}★ (${lvl.ratingCount} votes)` : "No ratings yet";
      const highScoreText = lvl.highScore > 0 ? `High Score: ${lvl.highScore} by ${lvl.highScoreUser}` : "High Score: 0";
      const isOwner = currentUserId && lvl.authorId === currentUserId;
      const releaseBadge = isOwner && lvl.isReleased === false ? ' <span style="color:#ffcc00; font-size:0.75rem; font-weight:bold;">[🔒 DRAFT]</span>' : '';

      card.innerHTML = `
        <div class="community-level-info">
          <div class="community-level-title">${lvl.name} by ${lvl.authorName}${releaseBadge}</div>
          <div class="community-level-meta">${highScoreText}</div>
          <div class="community-level-rating">Rating: ${ratingText}</div>
        </div>
        <div class="community-level-actions">
          <button class="btn-editor primary btn-play-custom" data-id="${lvl.id}">▶️ PLAY</button>
          ${
            isOwner
              ? `
            <div class="community-level-dropdown">
              <button class="btn-editor btn-more-custom" data-id="${lvl.id}" title="More options">...</button>
              <div class="community-level-dropdown-menu hidden">
                <button class="btn-editor btn-toggle-release-custom" data-id="${lvl.id}">${
                  lvl.isReleased !== false ? "🔒 UNRELEASE" : "🌐 RELEASE"
                }</button>
                <button class="btn-editor btn-edit-custom" data-id="${lvl.id}">✏️ EDIT</button>
                <button class="btn-editor danger btn-delete-custom" data-id="${lvl.id}">🗑️ DELETE</button>
              </div>
            </div>
          `
              : ""
          }
        </div>
      `;

      card.querySelector(".btn-play-custom")?.addEventListener("click", async () => {
        const levelRecord = await this.game.levelManager.fetchCustomLevelById(lvl.id);
        if (levelRecord) {
          this.game.levelManager.startCustomLevelRecord(levelRecord);
        } else {
          this.showBanner("Failed to load custom level!");
        }
      });

      if (isOwner) {
        const moreBtn = card.querySelector(".btn-more-custom");
        const dropdownMenu = card.querySelector(".community-level-dropdown-menu");

        moreBtn?.addEventListener("click", (e: Event) => {
          e.stopPropagation();
          const isCurrentlyHidden = dropdownMenu?.classList.contains("hidden");
          document.querySelectorAll(".community-level-dropdown-menu").forEach((el) => el.classList.add("hidden"));
          document.querySelectorAll(".community-level-card").forEach((el) => el.classList.remove("dropdown-open"));

          if (isCurrentlyHidden) {
            dropdownMenu?.classList.remove("hidden");
            card.classList.add("dropdown-open");
          }
        });

        card.querySelector(".btn-toggle-release-custom")?.addEventListener("click", async () => {
          dropdownMenu?.classList.add("hidden");
          card.classList.remove("dropdown-open");
          const newStatus = lvl.isReleased === false;
          const res = await this.game.levelManager.updateCustomLevel(lvl.id, { isReleased: newStatus });
          if (res.success) {
            this.showBanner(`Level is now ${newStatus ? "PUBLIC" : "PRIVATE (UNRELEASED)"}`);
            this.loadCommunityLevelsUI();
          } else {
            this.showBanner(res.error || "Failed to update release status.");
          }
        });

        card.querySelector(".btn-edit-custom")?.addEventListener("click", async () => {
          dropdownMenu?.classList.add("hidden");
          card.classList.remove("dropdown-open");
          const levelRecord = await this.game.levelManager.fetchCustomLevelById(lvl.id);
          if (levelRecord) {
            this.game.editor.currentLevelId = levelRecord.id;
            this.game.editor.levelName = levelRecord.name;
            this.game.editor.isReleased = levelRecord.isReleased !== false;
            const chkRelease = document.getElementById("chkEditorIsReleased") as HTMLInputElement | null;
            if (chkRelease) chkRelease.checked = levelRecord.isReleased !== false;
            this.game.tileMap.loadLevelData(levelRecord);
            this.game.levelManager.openLevelEditor();
            this.showBanner(`EDITING "${levelRecord.name.toUpperCase()}"`);
          } else {
            this.showBanner("Failed to load custom level!");
          }
        });

        card.querySelector(".btn-delete-custom")?.addEventListener("click", async () => {
          dropdownMenu?.classList.add("hidden");
          card.classList.remove("dropdown-open");
          if (confirm(`Are you sure you want to delete "${lvl.name}"?`)) {
            const res = await this.game.levelManager.deleteCustomLevel(lvl.id);
            if (res.success) {
              this.showBanner("Level deleted.");
              this.loadCommunityLevelsUI();
            } else {
              this.showBanner(res.error || "Failed to delete level.");
            }
          }
        });
      }

      listContainer.appendChild(card);
    });
  }


  showDialog(dialogId: string): void {
    this.game.isCanvasRenderedForState = false;
    this.closeAllDialogs();
    const dlg = document.getElementById(dialogId) as HTMLDialogElement | null;
    if (dlg) {
      const badge = document.getElementById("gameVersionBadge");
      if (badge) {
        dlg.appendChild(badge);
      }
      dlg.showModal();
    }
    if (dialogId === "dlgMainMenu" || dialogId === "dlgLevelSelect") {
      this.game.audio.startMenuMusic();
    }
  }

  closeAllDialogs(): void {
    const gameHud = document.getElementById("gameHud");
    if (gameHud?.classList.contains("hud-open")) {
      gameHud.classList.remove("hud-open");
      const btnHudToggle = document.getElementById("btnHudToggle");
      if (btnHudToggle) {
        btnHudToggle.setAttribute("aria-expanded", "false");
        const toggleText = btnHudToggle.querySelector(".hud-toggle-text");
        if (toggleText) toggleText.textContent = "HUD ▾";
      }
    }

    const badge = document.getElementById("gameVersionBadge");
    const logoItem = document.querySelector(".logo-item");
    const appContainer = document.getElementById("appContainer");
    const targetParent = logoItem || appContainer;
    if (badge && targetParent && badge.parentElement !== targetParent) {
      targetParent.appendChild(badge);
    }
    serverHealthUI.stopPolling();
    document.querySelectorAll("dialog").forEach((d) => {
      if (d.open) d.close();
    });
  }

  showBanner(text: string): void {
    const banner = document.getElementById("bannerNotification");
    const bannerText = document.getElementById("bannerText");
    if (bannerText) bannerText.textContent = text;
    if (banner) {
      banner.classList.remove("hidden");
      setTimeout(() => {
        banner.classList.add("hidden");
      }, 2200);
    }
  }

  setupVisibilityHandler(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.game.loop.stop();
        this.game.audio.stopThrust();
        if (this.game.audio.stopEnergyDrain) this.game.audio.stopEnergyDrain();
      } else {
        this.game.isCanvasRenderedForState = false;
        this.game.loop.start();
      }
    });
  }

  updateHUD(): void {
    const game = this.game;
    const levelStr = game.isCustomLevel
      ? "CUSTOM"
      : `${game.currentLevelIndex + 1}`;
    if (this.hudState.level !== levelStr) {
      this.hudState.level = levelStr;
      if (this.hudLevelEl) this.hudLevelEl.textContent = levelStr;
    }

    if (this.hudState.score !== game.player.score) {
      this.hudState.score = game.player.score;
      if (this.hudScoreEl)
        this.hudScoreEl.textContent = String(game.player.score).padStart(
          6,
          "0",
        );
    }

    if (this.hudState.lives !== game.player.lives) {
      this.hudState.lives = game.player.lives;
      let hearts = "";
      for (let i = 0; i < game.player.lives; i++) hearts += "❤️";
      if (this.hudLivesEl) this.hudLivesEl.textContent = hearts || "💀";
    }

    const emeraldStr = `${game.tileMap.collectedEmeralds} / ${game.tileMap.totalEmeralds}`;
    if (this.hudState.emeralds !== emeraldStr) {
      this.hudState.emeralds = emeraldStr;
      if (this.hudEmeraldsEl) this.hudEmeraldsEl.textContent = emeraldStr;
    }

    const fuelPct = Math.round(game.player.fuel);
    if (this.hudState.fuel !== fuelPct) {
      this.hudState.fuel = fuelPct;
      if (this.fuelBarFillEl) this.fuelBarFillEl.style.width = `${fuelPct}%`;
      if (this.fuelTextEl) this.fuelTextEl.textContent = `${fuelPct}%`;
    }

    if (game.player.rapidFireTimer > 0) {
      const timeStr = `${game.player.rapidFireTimer.toFixed(1)}s`;
      if (this.hudPowerupEl) this.hudPowerupEl.classList.remove("hidden");
      if (this.hudState.powerupTime !== timeStr) {
        this.hudState.powerupTime = timeStr;
        if (this.hudPowerupTextEl) this.hudPowerupTextEl.textContent = timeStr;
      }
    } else {
      if (this.hudPowerupEl) this.hudPowerupEl.classList.add("hidden");
      this.hudState.powerupTime = null;
    }

    const player = game.player;
    const activeWep = player.activeWeapon || "phase_beam";
    const spreadAmmo = player.weaponAmmo?.spread_cannon ?? 0;
    const grenadeAmmo = player.weaponAmmo?.plasma_grenade ?? 0;
    const missileAmmo = player.weaponAmmo?.seeker_missile ?? 0;

    if (this.hudState.activeWeapon !== activeWep) {
      this.hudState.activeWeapon = activeWep;
      this.slotPhaseEl?.classList.toggle("active", activeWep === "phase_beam");
      this.slotSpreadEl?.classList.toggle("active", activeWep === "spread_cannon");
      this.slotGrenadeEl?.classList.toggle("active", activeWep === "plasma_grenade");
      this.slotMissileEl?.classList.toggle("active", activeWep === "seeker_missile");
    }

    if (this.hudState.ammoSpread !== spreadAmmo) {
      this.hudState.ammoSpread = spreadAmmo;
      if (this.ammoSpreadEl) this.ammoSpreadEl.textContent = String(spreadAmmo);
      this.slotSpreadEl?.classList.toggle("empty", spreadAmmo <= 0);
    }

    if (this.hudState.ammoGrenade !== grenadeAmmo) {
      this.hudState.ammoGrenade = grenadeAmmo;
      if (this.ammoGrenadeEl) this.ammoGrenadeEl.textContent = String(grenadeAmmo);
      this.slotGrenadeEl?.classList.toggle("empty", grenadeAmmo <= 0);
    }

    if (this.hudState.ammoMissile !== missileAmmo) {
      this.hudState.ammoMissile = missileAmmo;
      if (this.ammoMissileEl) this.ammoMissileEl.textContent = String(missileAmmo);
      this.slotMissileEl?.classList.toggle("empty", missileAmmo <= 0);
    }
  }

  initVersionBadge(): void {
    const hashEl = document.getElementById("versionCommit");
    const dateEl = document.getElementById("versionDate");

    let commitHash =
      typeof __GIT_COMMIT_HASH__ !== "undefined" ? __GIT_COMMIT_HASH__ : null;
    let buildDate =
      typeof __BUILD_DATE_TIME__ !== "undefined" ? __BUILD_DATE_TIME__ : null;

    if (commitHash && hashEl) {
      hashEl.textContent = commitHash;
    }
    if (buildDate && dateEl) {
      dateEl.textContent = buildDate;
    }

    fetch("/api/version")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (hashEl && data.commitHash) hashEl.textContent = data.commitHash;
          if (dateEl && data.deployedAt) dateEl.textContent = data.deployedAt;
        }
      })
      .catch(() => {
        // Ignore errors when running without server
      });
  }

  updateAudioButtons(): void {
    const soundBtn = document.getElementById("btnSound");
    if (soundBtn) {
      const isSfxMuted = this.game.audio.isSfxMuted ?? false;
      soundBtn.textContent = isSfxMuted ? "🔇" : "🔊";
      soundBtn.title = isSfxMuted ? "Unmute Sound FX" : "Mute Sound FX";
      soundBtn.setAttribute?.("aria-label", soundBtn.title);
      soundBtn.classList?.toggle?.("muted", isSfxMuted);
    }

    const musicBtn = document.getElementById("btnMusic");
    if (musicBtn) {
      const isMusicMuted = this.game.audio.isMusicMuted ?? false;
      musicBtn.textContent = isMusicMuted ? "🔕" : "🎵";
      musicBtn.title = isMusicMuted ? "Unmute Music" : "Mute Music";
      musicBtn.setAttribute?.("aria-label", musicBtn.title);
      musicBtn.classList?.toggle?.("muted", isMusicMuted);
    }
  }
}
