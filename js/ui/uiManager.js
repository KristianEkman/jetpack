/* ==========================================================================
   UI MANAGER
   Handles HUD rendering, modal dialogs, banner notifications, and UI event listeners.
   ========================================================================== */

import { GAME_STATES } from '../game.js';
import { CAMPAIGN_LEVELS } from '../levels/campaign.js';
import { TILES } from '../world/tilemap.js';

export class UIManager {
    constructor(game) {
        this.game = game;

        // Cache HUD DOM Element References
        this.hudLevelEl = document.getElementById('hudLevel');
        this.hudScoreEl = document.getElementById('hudScore');
        this.hudLivesEl = document.getElementById('hudLives');
        this.hudEmeraldsEl = document.getElementById('hudEmeralds');
        this.fuelBarFillEl = document.getElementById('fuelBarFill');
        this.fuelTextEl = document.getElementById('fuelText');

        // Dirty state tracking to prevent unnecessary DOM mutations
        this.hudState = {
            level: null,
            score: null,
            lives: null,
            emeralds: null,
            fuel: null
        };

        this.setupVisibilityHandler();
    }

    bindUI() {
        const game = this.game;

        // HUD buttons
        document.getElementById('btnPause')?.addEventListener('click', () => game.togglePause());
        document.getElementById('btnSound')?.addEventListener('click', () => {
            const muted = game.audio.toggleMute();
            document.getElementById('btnSound').textContent = muted ? '🔇' : '🔊';
        });
        document.getElementById('btnCRT')?.addEventListener('click', () => {
            document.getElementById('crtOverlay')?.classList.toggle('active');
        });

        // Main Menu buttons
        document.getElementById('btnStartGame')?.addEventListener('click', () => {
            game.isMultiplayer = false;
            game.currentLevelIndex = 0;
            game.player.score = 0;
            game.player.lives = 3;
            game.levelManager.startLevel(0);
        });

        document.getElementById('btnMultiplayer')?.addEventListener('click', () => {
            this.showDialog('dlgMultiplayer');
            document.getElementById('tabCreateRoom')?.click();
            game.network.connect();
            game.network.listRooms();
        });

        document.getElementById('btnLevelSelect')?.addEventListener('click', () => {
            game.levelManager.openLevelSelect();
        });

        document.getElementById('btnOpenEditor')?.addEventListener('click', () => {
            game.levelManager.openLevelEditor();
        });

        document.getElementById('btnControls')?.addEventListener('click', () => {
            this.showDialog('dlgControls');
        });

        document.getElementById('btnCloseControls')?.addEventListener('click', () => {
            if (game.gameState === GAME_STATES.PAUSED) {
                this.showDialog('dlgPause');
            } else {
                this.showDialog('dlgMainMenu');
            }
        });

        // Pause Menu buttons
        document.getElementById('btnResume')?.addEventListener('click', () => game.resumeGame());
        document.getElementById('btnRestartLevel')?.addEventListener('click', () => {
            this.closeAllDialogs();
            game.levelManager.startLevel(game.currentLevelIndex);
        });
        document.getElementById('btnPauseControls')?.addEventListener('click', () => {
            this.showDialog('dlgControls');
        });
        document.getElementById('btnQuitToMenu')?.addEventListener('click', () => {
            game.audio.stopThrust();
            if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
            game.audio.stopMusic();
            game.gameState = GAME_STATES.MENU;
            this.showDialog('dlgMainMenu');
        });

        // Game Over buttons
        document.getElementById('btnRetryLevel')?.addEventListener('click', () => {
            game.player.lives = 3;
            game.player.score = 0;
            this.closeAllDialogs();
            game.levelManager.startLevel(game.currentLevelIndex);
        });
        document.getElementById('btnGameOverMenu')?.addEventListener('click', () => {
            game.audio.stopMusic();
            this.showDialog('dlgMainMenu');
        });

        // Stage Complete buttons
        document.getElementById('btnNextLevel')?.addEventListener('click', () => {
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
                    this.showBanner('CONGRATULATIONS! YOU BEAT THE CAMPAIGN!');
                    setTimeout(() => this.showDialog('dlgMainMenu'), 2000);
                } else {
                    game.levelManager.startLevel(game.currentLevelIndex);
                }
            }
        });
        document.getElementById('btnCompleteMenu')?.addEventListener('click', () => {
            game.audio.stopMusic();
            this.showDialog('dlgMainMenu');
        });

        // Level Select Close button
        document.getElementById('btnCloseLevelSelect')?.addEventListener('click', () => {
            this.showDialog('dlgMainMenu');
        });

        // Editor Toolbar buttons
        document.getElementById('btnEditorPlay')?.addEventListener('click', () => game.levelManager.playtestCustomLevel());
        document.getElementById('btnEditorSave')?.addEventListener('click', () => {
            game.editor.autoSaveLocal();
            this.showBanner('LEVEL SAVED TO LOCAL STORAGE!');
        });
        document.getElementById('btnEditorExport')?.addEventListener('click', () => game.levelManager.exportLevelJSON());
        document.getElementById('btnEditorImport')?.addEventListener('click', () => {
            document.getElementById('fileImportInput')?.click();
        });
        document.getElementById('fileImportInput')?.addEventListener('change', (e) => game.levelManager.importLevelJSON(e));
        document.getElementById('btnEditorClear')?.addEventListener('click', () => {
            game.tileMap.grid.fill(TILES.AIR);
            this.showBanner('CANVAS CLEARED');
        });
        document.getElementById('btnEditorExit')?.addEventListener('click', () => {
            game.audio.stopMusic();
            document.getElementById('editorToolbar')?.classList.add('hidden');
            this.showDialog('dlgMainMenu');
        });

        // Pause Key Listener
        game.input.onPausePress = () => {
            if (game.gameState === GAME_STATES.PLAYING) {
                game.togglePause();
            } else if (game.gameState === GAME_STATES.PAUSED) {
                game.resumeGame();
            }
        };
    }

    showDialog(dialogId) {
        this.game.isCanvasRenderedForState = false;
        this.closeAllDialogs();
        const dlg = document.getElementById(dialogId);
        if (dlg) {
            dlg.showModal();
        }
        if (dialogId === 'dlgMainMenu' || dialogId === 'dlgLevelSelect') {
            this.game.audio.startMenuMusic();
        }
    }

    closeAllDialogs() {
        document.querySelectorAll('dialog').forEach(d => {
            if (d.open) d.close();
        });
    }

    showBanner(text) {
        const banner = document.getElementById('bannerNotification');
        const bannerText = document.getElementById('bannerText');
        if (bannerText) bannerText.textContent = text;
        if (banner) {
            banner.classList.remove('hidden');
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 2200);
        }
    }

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
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

    updateHUD() {
        const game = this.game;
        const levelStr = game.isCustomLevel ? 'CUSTOM' : `${game.currentLevelIndex + 1}`;
        if (this.hudState.level !== levelStr) {
            this.hudState.level = levelStr;
            if (this.hudLevelEl) this.hudLevelEl.textContent = levelStr;
        }

        if (this.hudState.score !== game.player.score) {
            this.hudState.score = game.player.score;
            if (this.hudScoreEl) this.hudScoreEl.textContent = String(game.player.score).padStart(6, '0');
        }

        if (this.hudState.lives !== game.player.lives) {
            this.hudState.lives = game.player.lives;
            let hearts = '';
            for (let i = 0; i < game.player.lives; i++) hearts += '❤️';
            if (this.hudLivesEl) this.hudLivesEl.textContent = hearts || '💀';
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
    }
}
