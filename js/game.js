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

        this.playerManager = new PlayerManager(this.audio, this.tileMap);
        this.network = new NetworkManager();
        this.isMultiplayer = false;
        this.selectedColor = '#ff4444';

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

    update(dt) {
        if (this.gameState !== GAME_STATES.PLAYING) return;

        let effectiveDt = dt;

        if (this.isMultiplayer) {
            this.network.sendInput(this.input.serializeInputState());
            this.playerManager.update(effectiveDt);
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
                    this.gameState = GAME_STATES.GAME_OVER;
                    const stats = document.getElementById('gameOverStats');
                    if (stats) stats.textContent = `Final Score: ${String(this.player.score).padStart(6, '0')}`;
                    this.uiManager.showDialog('dlgGameOver');
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

        // 1. Update TileMap
        this.tileMap.update(effectiveDt, this.player, this.enemyManager);

        // 2. Update Player
        this.player.update(effectiveDt, this.input.keys, this.enemyManager);

        const wasAliveBeforeEnemies = !this.player.isDead;

        // 3. Update Enemies
        this.enemyManager.update(effectiveDt, this.player);

        // 4. Notify server if enemies killed local player
        if (this.isMultiplayer && wasAliveBeforeEnemies && this.player.isDead) {
            this.network.sendPlayerDied('enemy');
        }

        // 5. Check Level Clear Condition
        if (!this.player.isDead && this.tileMap.collectedEmeralds >= this.tileMap.totalEmeralds) {
            const playerCol = Math.floor((this.player.x + this.player.width / 2) / TILE_SIZE);
            const playerRow = Math.floor((this.player.y + this.player.height / 2) / TILE_SIZE);

            if (this.tileMap.getTile(playerCol, playerRow) === TILES.EXIT_PORTAL) {
                this.levelManager.triggerLevelComplete();
            }
        }

        // Update HUD display
        this.uiManager.updateHUD();
    }

    render(dt) {
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
    }
}

// Instantiate Game on DOM Content Loaded
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
});
