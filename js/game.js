/* ==========================================================================
   MASTER GAME CONTROLLER
   Coordinates core game loop, state transitions, and sub-managers.
   ========================================================================== */

import { GameLoop } from './engine/loop.js';
import { InputHandler } from './engine/input.js';
import { AudioManager } from './audio/index.js';
import { TileMap, TILE_SIZE, TILES } from './world/tilemap.js';
import { Player } from './entities/player.js';
import { EnemyManager } from './entities/enemy.js';
import { LevelEditor } from './editor/level_editor.js';
import { PlayerManager } from './entities/playerManager.js';
import { NetworkManager } from './network/networkManager.js';

import { UIManager } from './ui/uiManager.js';
import { LevelManager } from './levels/levelManager.js';
import { MultiplayerController } from './network/multiplayerController.js';

export const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_EDITOR: 'level_editor',
    GAME_OVER: 'game_over',
    LEVEL_COMPLETE: 'level_complete',
    SPECTATING: 'spectating'
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

        this.playerManager = new PlayerManager(this.audio, this.tileMap);
        this.network = new NetworkManager();

        this.enemyManager.onEnemyDestroyed = ({ enemyId }) => {
            if (this.isMultiplayer) {
                this.network.sendEnemyDestroyed(enemyId);
            }
        };

        this.isMultiplayer = false;
        try {
            this.selectedColor = localStorage.getItem('jetpack_player_color') || '#ff4444';
        } catch (e) {
            this.selectedColor = '#ff4444';
        }

        this.currentLevelIndex = 0;
        this.gameState = GAME_STATES.MENU;
        this.isCustomLevel = false;
        this.isCanvasRenderedForState = false;

        // Initialize Sub-Managers
        this.uiManager = new UIManager(this);
        this.levelManager = new LevelManager(this);
        this.multiplayerController = new MultiplayerController(this);

        this.editor = new LevelEditor(
            this.canvas,
            this.tileMap,
            () => this.levelManager.playtestCustomLevel(),
            () => this.gameState === GAME_STATES.LEVEL_EDITOR
        );

        this.loop = new GameLoop(
            (dt) => this.update(dt),
            (dt) => this.render(dt)
        );

        // Bind UI and Network events
        this.uiManager.bindUI();
        this.multiplayerController.initNetwork();
        this.multiplayerController.bindMultiplayerUI();
        this.audio.setupUserUnlock();
        this.uiManager.showDialog('dlgMainMenu');
        this.loop.start();
    }

    togglePause() {
        if (this.gameState === GAME_STATES.PLAYING) {
            this.gameState = GAME_STATES.PAUSED;
            this.audio.stopThrust();
            if (this.audio.stopEnergyDrain) this.audio.stopEnergyDrain();
            this.audio.stopMusic();
            this.uiManager.showDialog('dlgPause');
        }
    }

    resumeGame() {
        if (this.gameState === GAME_STATES.PAUSED) {
            this.gameState = GAME_STATES.PLAYING;
            this.audio.startGameMusic(this.currentLevelIndex);
            this.uiManager.closeAllDialogs();
        }
    }

    // Delegate UI & Dialog methods for convenience / compatibility
    showDialog(dialogId) { this.uiManager.showDialog(dialogId); }
    closeAllDialogs() { this.uiManager.closeAllDialogs(); }
    showBanner(text) { this.uiManager.showBanner(text); }
    updateHUD() { this.uiManager.updateHUD(); }

    // Delegate Level methods for convenience / compatibility
    startLevel(index) { this.levelManager.startLevel(index); }
    openLevelSelect() { this.levelManager.openLevelSelect(); }
    openLevelEditor() { this.levelManager.openLevelEditor(); }
    playtestCustomLevel() { this.levelManager.playtestCustomLevel(); }
    spawnEnemiesFromGrid() { this.levelManager.spawnEnemiesFromGrid(); }
    triggerLevelComplete() { this.levelManager.triggerLevelComplete(); }
    exportLevelJSON() { this.levelManager.exportLevelJSON(); }
    importLevelJSON(e) { this.levelManager.importLevelJSON(e); }

    // Delegate Multiplayer methods for convenience / compatibility
    initNetwork() { this.multiplayerController.initNetwork(); }
    bindMultiplayerUI() { this.multiplayerController.bindMultiplayerUI(); }
    showLobbyView() { this.multiplayerController.showLobbyView(); }
    updateLobbyUI(room) { this.multiplayerController.updateLobbyUI(room); }
    renderPublicRoomsList(list) { this.multiplayerController.renderPublicRoomsList(list); }
    startMultiplayerMatch(payload) { this.multiplayerController.startMultiplayerMatch(payload); }
    triggerMultiplayerLevelComplete(data) { this.multiplayerController.triggerMultiplayerLevelComplete(data); }
    triggerMultiplayerGameOver(data) { this.multiplayerController.triggerMultiplayerGameOver(data); }

    update(dt) {
        if (this.gameState !== GAME_STATES.PLAYING && this.gameState !== GAME_STATES.SPECTATING) return;

        let effectiveDt = dt;

        if (this.isMultiplayer) {
            const inputState = this.input.serializeInputState(null, this.player);
            this.network.sendInput(inputState);
            this.playerManager.update(effectiveDt);
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
                        this.uiManager.showBanner('OUT OF LIVES - SPECTATING');
                    } else {
                        this.gameState = GAME_STATES.GAME_OVER;
                        const stats = document.getElementById('gameOverStats');
                        if (stats) stats.textContent = `Final Score: ${String(this.player.score).padStart(6, '0')}`;
                        this.uiManager.showDialog('dlgGameOver');
                    }
                } else if (this.isMultiplayer) {
                    this.deathSequenceTimer = 0;
                } else {
                    this.levelManager.startLevel(this.currentLevelIndex);
                }
            }
        } else if (this.isDeathHandled) {
            this.deathSequenceTimer = 0;
            this.isDeathHandled = false;
        }

        if (this.gameState === GAME_STATES.SPECTATING) {
            this.uiManager.updateHUD();
            return;
        }

        const wasAlive = !this.player.isDead;
        const currentInput = this.input.serializeInputState();

        // 1. Update TileMap
        this.tileMap.update(effectiveDt, this.player, this.enemyManager);

        // 2. Update Player (pass full input state)
        this.player.update(effectiveDt, currentInput, this.enemyManager);

        // 3. Update Enemies (Singleplayer = local AI update, Multiplayer = server authoritative interpolation)
        if (!this.isMultiplayer) {
            this.enemyManager.update(effectiveDt, this.player);
        }

        // 4. Notify server if local player died this frame
        if (this.isMultiplayer && wasAlive && this.player.isDead) {
            this.network.sendPlayerDied('local_damage');
        }

        // 5. Check Level Clear Condition
        if (!this.player.isDead && this.tileMap.collectedEmeralds >= this.tileMap.totalEmeralds) {
            const playerCol = Math.floor((this.player.x + this.player.width / 2) / TILE_SIZE);
            const playerRow = Math.floor((this.player.y + this.player.height / 2) / TILE_SIZE);

            if (this.tileMap.getTile(playerCol, playerRow) === TILES.EXIT_PORTAL) {
                if (this.isMultiplayer) {
                    this.gameState = GAME_STATES.LEVEL_COMPLETE;
                    this.network.completeLevel();
                } else {
                    this.levelManager.triggerLevelComplete();
                }
            }
        }

        // Update HUD display
        this.uiManager.updateHUD();
    }

    render(dt, alpha = 1) {
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
        this.tileMap.render(this.ctx, this.gameState === GAME_STATES.LEVEL_EDITOR);

        // Render Enemies
        this.enemyManager.render(this.ctx, this.player);

        // Render Player / Multi-Player Entities
        if (this.isMultiplayer) {
            this.playerManager.render(this.ctx);
        } else {
            this.player.render(this.ctx);
        }

        // Render Editor Overlay if in Level Editor Mode
        if (this.gameState === GAME_STATES.LEVEL_EDITOR) {
            this.editor.renderHoverPreview(this.ctx);
        }

        // Render Spectator Banner Overlay if in Spectating Mode
        if (this.gameState === GAME_STATES.SPECTATING) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
            this.ctx.fillRect(0, 0, this.canvas.width, 28);
            this.ctx.font = 'bold 12px Orbitron, sans-serif';
            this.ctx.fillStyle = '#ff0055';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('💀 OUT OF LIVES - SPECTATING MATCH', this.canvas.width / 2, 18);
            this.ctx.restore();
        }
    }
}

// Instantiate Game on DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
});
