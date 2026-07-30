/* ==========================================================================
   MASTER GAME CONTROLLER
   ========================================================================== */

import { GameLoop } from './engine/loop.js';
import { InputHandler } from './engine/input.js';
import { AudioManager } from './audio/index.js';
import { TileMap, TILE_SIZE, TILES } from './world/tilemap.js';
import { Player } from './entities/player.js';
import { EnemyManager } from './entities/enemy.js';
import { CAMPAIGN_LEVELS } from './levels/campaign.js';
import { LevelEditor } from './editor/level_editor.js';

export const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_EDITOR: 'level_editor',
    GAME_OVER: 'game_over',
    LEVEL_COMPLETE: 'level_complete'
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.audio = new AudioManager();
        this.input = new InputHandler();
        this.tileMap = new TileMap();
        this.player = new Player(this.audio, this.tileMap);
        this.enemyManager = new EnemyManager(this.tileMap);

        this.currentLevelIndex = 0;
        this.gameState = GAME_STATES.MENU;
        this.isCustomLevel = false;

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

        this.isCanvasRenderedForState = false;
        this.setupVisibilityHandler();

        this.editor = new LevelEditor(
            this.canvas,
            this.tileMap,
            () => this.playtestCustomLevel(),
            () => this.gameState === GAME_STATES.LEVEL_EDITOR
        );

        this.loop = new GameLoop(
            (dt) => this.update(dt),
            (dt) => this.render(dt)
        );

        this.bindUI();
        this.audio.setupUserUnlock();
        this.showDialog('dlgMainMenu');
        this.loop.start();
    }

    bindUI() {
        // HUD buttons
        document.getElementById('btnPause').addEventListener('click', () => this.togglePause());
        document.getElementById('btnSound').addEventListener('click', () => {
            const muted = this.audio.toggleMute();
            document.getElementById('btnSound').textContent = muted ? '🔇' : '🔊';
        });
        document.getElementById('btnCRT').addEventListener('click', () => {
            document.getElementById('crtOverlay').classList.toggle('active');
        });

        // Main Menu buttons
        document.getElementById('btnStartGame').addEventListener('click', () => {
            this.currentLevelIndex = 0;
            this.player.score = 0;
            this.player.lives = 3;
            this.startLevel(0);
        });

        document.getElementById('btnLevelSelect').addEventListener('click', () => {
            this.openLevelSelect();
        });

        document.getElementById('btnOpenEditor').addEventListener('click', () => {
            this.openLevelEditor();
        });

        document.getElementById('btnControls').addEventListener('click', () => {
            this.showDialog('dlgControls');
        });

        document.getElementById('btnCloseControls').addEventListener('click', () => {
            if (this.gameState === GAME_STATES.PAUSED) {
                this.showDialog('dlgPause');
            } else {
                this.showDialog('dlgMainMenu');
            }
        });

        // Pause Menu buttons
        document.getElementById('btnResume').addEventListener('click', () => this.resumeGame());
        document.getElementById('btnRestartLevel').addEventListener('click', () => {
            this.closeAllDialogs();
            this.startLevel(this.currentLevelIndex);
        });
        document.getElementById('btnPauseControls').addEventListener('click', () => {
            this.showDialog('dlgControls');
        });
        document.getElementById('btnQuitToMenu').addEventListener('click', () => {
            this.audio.stopThrust();
            this.audio.stopMusic();
            this.gameState = GAME_STATES.MENU;
            this.showDialog('dlgMainMenu');
        });

        // Game Over buttons
        document.getElementById('btnRetryLevel').addEventListener('click', () => {
            this.player.lives = 3;
            this.player.score = 0;
            this.closeAllDialogs();
            this.startLevel(this.currentLevelIndex);
        });
        document.getElementById('btnGameOverMenu').addEventListener('click', () => {
            this.audio.stopMusic();
            this.showDialog('dlgMainMenu');
        });

        // Stage Complete buttons
        document.getElementById('btnNextLevel').addEventListener('click', () => {
            this.closeAllDialogs();
            if (this.isCustomLevel) {
                this.openLevelEditor();
            } else {
                this.currentLevelIndex++;
                if (this.currentLevelIndex >= CAMPAIGN_LEVELS.length) {
                    this.audio.stopMusic();
                    this.showBanner('CONGRATULATIONS! YOU BEAT THE CAMPAIGN!');
                    setTimeout(() => this.showDialog('dlgMainMenu'), 2000);
                } else {
                    this.startLevel(this.currentLevelIndex);
                }
            }
        });
        document.getElementById('btnCompleteMenu').addEventListener('click', () => {
            this.audio.stopMusic();
            this.showDialog('dlgMainMenu');
        });

        // Level Select Close button
        document.getElementById('btnCloseLevelSelect').addEventListener('click', () => {
            this.showDialog('dlgMainMenu');
        });

        // Editor Toolbar buttons
        document.getElementById('btnEditorPlay').addEventListener('click', () => this.playtestCustomLevel());
        document.getElementById('btnEditorSave').addEventListener('click', () => {
            this.editor.autoSaveLocal();
            this.showBanner('LEVEL SAVED TO LOCAL STORAGE!');
        });
        document.getElementById('btnEditorExport').addEventListener('click', () => this.exportLevelJSON());
        document.getElementById('btnEditorImport').addEventListener('click', () => {
            document.getElementById('fileImportInput').click();
        });
        document.getElementById('fileImportInput').addEventListener('change', (e) => this.importLevelJSON(e));
        document.getElementById('btnEditorClear').addEventListener('click', () => {
            this.tileMap.grid.fill(TILES.AIR);
            this.showBanner('CANVAS CLEARED');
        });
        document.getElementById('btnEditorExit').addEventListener('click', () => {
            this.audio.stopMusic();
            document.getElementById('editorToolbar').classList.add('hidden');
            this.showDialog('dlgMainMenu');
        });

        // Pause Key Listener
        this.input.onPausePress = () => {
            if (this.gameState === GAME_STATES.PLAYING) {
                this.togglePause();
            } else if (this.gameState === GAME_STATES.PAUSED) {
                this.resumeGame();
            }
        };
    }

    startLevel(index) {
        this.isCustomLevel = false;
        this.currentLevelIndex = index;
        const levelData = CAMPAIGN_LEVELS[index];

        this.tileMap.loadLevelData(levelData);
        this.enemyManager.clear();

        // Spawn player at SPAWN tile
        let spawnFound = false;
        for (let r = 0; r < this.tileMap.rows; r++) {
            for (let c = 0; c < this.tileMap.cols; c++) {
                if (this.tileMap.getTile(c, r) === TILES.SPAWN) {
                    this.player.spawn(c * TILE_SIZE + 4, r * TILE_SIZE + 2);
                    spawnFound = true;
                    break;
                }
            }
        }
        if (!spawnFound) this.player.spawn(100, 100);

        // Spawn Enemies
        if (levelData.flitzers) {
            levelData.flitzers.forEach(f => this.enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
        }
        if (levelData.missiles) {
            levelData.missiles.forEach(m => this.enemyManager.addHomingMissile(m.x, m.y));
        }
        if (levelData.turrets) {
            levelData.turrets.forEach(t => this.enemyManager.addTurret(t.x, t.y, t.fireInterval));
        }

        this.gameState = GAME_STATES.PLAYING;
        this.audio.startGameMusic(index);
        document.getElementById('editorToolbar').classList.add('hidden');
        this.closeAllDialogs();

        this.showBanner(`${levelData.name.toUpperCase()}`);
    }

    openLevelSelect() {
        const grid = document.getElementById('levelGrid');
        grid.innerHTML = '';

        CAMPAIGN_LEVELS.forEach((level, idx) => {
            const card = document.createElement('div');
            card.className = 'level-card';
            card.innerHTML = `<span>STAGE</span><span>${idx + 1}</span>`;
            card.addEventListener('click', () => {
                this.player.score = 0;
                this.player.lives = 3;
                this.startLevel(idx);
            });
            grid.appendChild(card);
        });

        this.showDialog('dlgLevelSelect');
    }

    openLevelEditor() {
        this.gameState = GAME_STATES.LEVEL_EDITOR;
        this.audio.stopThrust();
        this.audio.startMenuMusic();
        this.closeAllDialogs();
        document.getElementById('editorToolbar').classList.remove('hidden');

        // Load saved custom level or default blank
        if (!this.editor.loadFromLocal()) {
            this.tileMap.grid.fill(TILES.AIR);
        }
    }

    playtestCustomLevel() {
        const validation = this.editor.validateLevel();
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        this.isCustomLevel = true;
        this.enemyManager.clear();
        this.tileMap.collectedEmeralds = 0;

        // Count emeralds
        let total = 0;
        let spawnX = 100, spawnY = 100;
        for (let r = 0; r < this.tileMap.rows; r++) {
            for (let c = 0; c < this.tileMap.cols; c++) {
                const t = this.tileMap.getTile(c, r);
                if (t === TILES.EMERALD) total++;
                if (t === TILES.SPAWN) {
                    spawnX = c * TILE_SIZE + 4;
                    spawnY = r * TILE_SIZE + 2;
                }
            }
        }
        this.tileMap.totalEmeralds = total;
        this.player.spawn(spawnX, spawnY);

        this.gameState = GAME_STATES.PLAYING;
        this.audio.startGameMusic(0);
        document.getElementById('editorToolbar').classList.add('hidden');
        this.closeAllDialogs();
        this.showBanner('PLAYTEST CUSTOM LEVEL');
    }

    exportLevelJSON() {
        const data = this.editor.getExportData();
        const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", str);
        a.setAttribute("download", "jetpack_custom_level.json");
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    importLevelJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.grid && parsed.grid.length === this.tileMap.grid.length) {
                    this.tileMap.loadLevelData(parsed);
                    this.editor.autoSaveLocal();
                    this.showBanner('CUSTOM LEVEL IMPORTED!');
                } else {
                    alert('Invalid level format!');
                }
            } catch (err) {
                alert('Error parsing JSON level file!');
            }
        };
        reader.readAsText(file);
    }

    togglePause() {
        if (this.gameState === GAME_STATES.PLAYING) {
            this.gameState = GAME_STATES.PAUSED;
            this.audio.stopThrust();
            this.audio.stopMusic();
            this.showDialog('dlgPause');
        }
    }

    resumeGame() {
        if (this.gameState === GAME_STATES.PAUSED) {
            this.gameState = GAME_STATES.PLAYING;
            this.audio.startGameMusic(this.currentLevelIndex);
            this.closeAllDialogs();
        }
    }

    showDialog(dialogId) {
        this.isCanvasRenderedForState = false;
        this.closeAllDialogs();
        const dlg = document.getElementById(dialogId);
        if (dlg) {
            dlg.showModal();
        }
        if (dialogId === 'dlgMainMenu' || dialogId === 'dlgLevelSelect') {
            this.audio.startMenuMusic();
        }
    }

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.loop.stop();
                this.audio.stopThrust();
            } else {
                this.isCanvasRenderedForState = false;
                this.loop.start();
            }
        });
    }

    closeAllDialogs() {
        document.querySelectorAll('dialog').forEach(d => {
            if (d.open) d.close();
        });
    }

    showBanner(text) {
        const banner = document.getElementById('bannerNotification');
        const bannerText = document.getElementById('bannerText');
        bannerText.textContent = text;
        banner.classList.remove('hidden');
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 2200);
    }

    update(dt) {
        if (this.gameState !== GAME_STATES.PLAYING) return;

        // 1. Update TileMap
        this.tileMap.update(dt, this.player, this.enemyManager);

        // 2. Update Player
        this.player.update(dt, this.input.keys, this.enemyManager);

        // 3. Update Enemies
        this.enemyManager.update(dt, this.player);

        // 4. Check Level Clear Condition (Player enters EXIT_PORTAL when all emeralds collected)
        if (this.tileMap.collectedEmeralds >= this.tileMap.totalEmeralds) {
            const playerCol = Math.floor((this.player.x + this.player.width / 2) / TILE_SIZE);
            const playerRow = Math.floor((this.player.y + this.player.height / 2) / TILE_SIZE);
            
            if (this.tileMap.getTile(playerCol, playerRow) === TILES.EXIT_PORTAL) {
                this.triggerLevelComplete();
            }
        }

        // 5. Check Player Death / Game Over
        if (this.player.isDead) {
            this.audio.stopThrust();
            setTimeout(() => {
                if (this.player.lives <= 0) {
                    this.gameState = GAME_STATES.GAME_OVER;
                    document.getElementById('gameOverStats').textContent = `Final Score: ${String(this.player.score).padStart(6, '0')}`;
                    this.showDialog('dlgGameOver');
                } else {
                    // Respawn at level start
                    const spawnTile = CAMPAIGN_LEVELS[this.currentLevelIndex]?.grid;
                    this.startLevel(this.currentLevelIndex);
                }
            }, 1200);
        }

        // Update HUD display
        this.updateHUD();
    }

    triggerLevelComplete() {
        this.gameState = GAME_STATES.LEVEL_COMPLETE;
        this.audio.stopThrust();
        this.audio.stopMusic();
        this.audio.playPortalWarp();

        const fuelBonus = Math.floor(this.player.fuel * 10);
        const levelScore = 1000 + fuelBonus;
        this.player.score += levelScore;

        document.getElementById('statLevelScore').textContent = '1000';
        document.getElementById('statFuelBonus').textContent = `${fuelBonus}`;
        document.getElementById('statTotalScore').textContent = `${this.player.score}`;

        this.showDialog('dlgLevelComplete');
    }

    updateHUD() {
        const levelStr = this.isCustomLevel ? 'CUSTOM' : `${this.currentLevelIndex + 1}`;
        if (this.hudState.level !== levelStr) {
            this.hudState.level = levelStr;
            this.hudLevelEl.textContent = levelStr;
        }

        if (this.hudState.score !== this.player.score) {
            this.hudState.score = this.player.score;
            this.hudScoreEl.textContent = String(this.player.score).padStart(6, '0');
        }

        if (this.hudState.lives !== this.player.lives) {
            this.hudState.lives = this.player.lives;
            let hearts = '';
            for (let i = 0; i < this.player.lives; i++) hearts += '❤️';
            this.hudLivesEl.textContent = hearts || '💀';
        }

        const emeraldStr = `${this.tileMap.collectedEmeralds} / ${this.tileMap.totalEmeralds}`;
        if (this.hudState.emeralds !== emeraldStr) {
            this.hudState.emeralds = emeraldStr;
            this.hudEmeraldsEl.textContent = emeraldStr;
        }

        const fuelPct = Math.round(this.player.fuel);
        if (this.hudState.fuel !== fuelPct) {
            this.hudState.fuel = fuelPct;
            this.fuelBarFillEl.style.width = `${fuelPct}%`;
            this.fuelTextEl.textContent = `${fuelPct}%`;
        }
    }

    render(dt) {
        // Skip continuous canvas rendering in menu, pause, or game over states to eliminate background CPU/GPU usage
        if (this.gameState === GAME_STATES.PAUSED || this.gameState === GAME_STATES.MENU || 
            this.gameState === GAME_STATES.GAME_OVER || this.gameState === GAME_STATES.LEVEL_COMPLETE) {
            if (this.isCanvasRenderedForState) return;
            this.isCanvasRenderedForState = true;
        } else {
            this.isCanvasRenderedForState = false;
        }

        this.ctx.fillStyle = '#05070c';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render TileMap World
        this.tileMap.render(this.ctx);

        // Render Enemies
        this.enemyManager.render(this.ctx, this.player);

        // Render Player
        this.player.render(this.ctx);

        // Render Editor Overlay if in Level Editor Mode
        if (this.gameState === GAME_STATES.LEVEL_EDITOR) {
            this.editor.renderHoverPreview(this.ctx);
        }
    }
}

// Instantiate Game on DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
});
