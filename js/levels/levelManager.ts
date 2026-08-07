/* ==========================================================================
   LEVEL MANAGER
   Handles campaign level loading, custom level editing/testing, level completion, and level JSON import/export.
   ========================================================================== */

import { Game, GAME_STATES } from '../game.js';
import { CAMPAIGN_LEVELS } from './campaign.js';
import { TILE_SIZE, TILES } from '../world/tilemap.js';

export class LevelManager {
    game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    startLevel(index: number, isRestart: boolean = false): void {
        const game = this.game;
        game.isCustomLevel = false;
        game.currentLevelIndex = index;
        game.deathSequenceTimer = 0;
        game.isDeathHandled = false;
        const levelData = CAMPAIGN_LEVELS[index];

        game.tileMap.loadLevelData(levelData, isRestart);
        game.enemyManager.clear();

        // Spawn player at SPAWN tile
        let spawnFound = false;
        for (let r = 0; r < game.tileMap.rows; r++) {
            for (let c = 0; c < game.tileMap.cols; c++) {
                if (game.tileMap.getTile(c, r) === TILES.SPAWN) {
                    game.player.spawn(c * TILE_SIZE + 4, r * TILE_SIZE + 2);
                    spawnFound = true;
                    break;
                }
            }
        }
        if (!spawnFound) game.player.spawn(100, 100);

        // Spawn Enemies from level data arrays
        if (levelData.flitzers) {
            levelData.flitzers.forEach(f => game.enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
        }
        if (levelData.missiles) {
            levelData.missiles.forEach(m => game.enemyManager.addHomingMissile(m.x, m.y));
        }
        if (levelData.turrets) {
            levelData.turrets.forEach(t => game.enemyManager.addTurret(t.x, t.y, t.fireInterval));
        }
        if (levelData.bosses) {
            levelData.bosses.forEach(b => game.enemyManager.addBoss(b.x, b.y, b.hp || 25));
        }
        this.spawnEnemiesFromGrid();

        game.gameState = GAME_STATES.PLAYING;
        game.audio.startGameMusic(index);
        document.getElementById('editorToolbar')?.classList.add('hidden');
        game.uiManager.closeAllDialogs();

        game.uiManager.showBanner(`${levelData.name.toUpperCase()}`);
    }

    openLevelSelect(): void {
        const game = this.game;
        const grid = document.getElementById('levelGrid');
        if (!grid) return;
        grid.innerHTML = '';

        CAMPAIGN_LEVELS.forEach((level, idx) => {
            const card = document.createElement('div');
            card.className = 'level-card';
            card.innerHTML = `<span>STAGE</span><span>${idx + 1}</span>`;
            card.addEventListener('click', () => {
                game.player.score = 0;
                game.player.lives = 3;
                this.startLevel(idx);
            });
            grid.appendChild(card);
        });

        game.uiManager.showDialog('dlgLevelSelect');
    }

    openLevelEditor(): void {
        const game = this.game;
        game.gameState = GAME_STATES.LEVEL_EDITOR;
        game.audio.stopThrust();
        game.audio.startMenuMusic();
        game.uiManager.closeAllDialogs();
        document.getElementById('editorToolbar')?.classList.remove('hidden');

        if (!game.editor.loadFromLocal()) {
            game.tileMap.grid.fill(TILES.AIR);
        }
    }

    playtestCustomLevel(): void {
        const game = this.game;
        const validation = game.editor.validateLevel();
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        game.isCustomLevel = true;
        game.enemyManager.clear();
        game.tileMap.collectedEmeralds = 0;
        game.tileMap.resetExtraLifeState();

        let total = 0;
        let spawnX = 100, spawnY = 100;
        for (let r = 0; r < game.tileMap.rows; r++) {
            for (let c = 0; c < game.tileMap.cols; c++) {
                const t = game.tileMap.getTile(c, r);
                if (t === TILES.EMERALD) total++;
                if (t === TILES.SPAWN) {
                    spawnX = c * TILE_SIZE + 4;
                    spawnY = r * TILE_SIZE + 2;
                }
            }
        }
        game.tileMap.totalEmeralds = total;
        game.player.spawn(spawnX, spawnY);
        this.spawnEnemiesFromGrid();

        game.gameState = GAME_STATES.PLAYING;
        game.audio.startGameMusic(0);
        document.getElementById('editorToolbar')?.classList.add('hidden');
        game.uiManager.closeAllDialogs();
        game.uiManager.showBanner('PLAYTEST CUSTOM LEVEL');
    }

    spawnEnemiesFromGrid(): void {
        const game = this.game;
        for (let r = 0; r < game.tileMap.rows; r++) {
            for (let c = 0; c < game.tileMap.cols; c++) {
                const t = game.tileMap.getTile(c, r);
                if (t === TILES.ENEMY_FLITZER) {
                    game.enemyManager.addFlitzer(c * TILE_SIZE + 6, r * TILE_SIZE + 6, 120, 0);
                } else if (t === TILES.ENEMY_MISSILE) {
                    game.enemyManager.addHomingMissile(c * TILE_SIZE + 8, r * TILE_SIZE + 8);
                } else if (t === TILES.ENEMY_TURRET) {
                    game.enemyManager.addTurret(c * TILE_SIZE + 4, r * TILE_SIZE + 4, 2.0);
                } else if (t === TILES.ENEMY_BOSS) {
                    game.enemyManager.addBoss(c * TILE_SIZE, r * TILE_SIZE, 25);
                }
            }
        }
    }

    triggerLevelComplete(): void {
        const game = this.game;
        game.gameState = GAME_STATES.LEVEL_COMPLETE;
        game.audio.stopThrust();
        if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
        game.audio.stopMusic();
        game.audio.playPortalWarp();

        const fuelBonus = Math.floor(game.player.fuel * 10);
        const levelScore = 1000 + fuelBonus;
        game.player.score += levelScore;

        const statLevelScore = document.getElementById('statLevelScore');
        const statFuelBonus = document.getElementById('statFuelBonus');
        const statTotalScore = document.getElementById('statTotalScore');

        if (statLevelScore) statLevelScore.textContent = '1000';
        if (statFuelBonus) statFuelBonus.textContent = `${fuelBonus}`;
        if (statTotalScore) statTotalScore.textContent = `${game.player.score}`;

        document.getElementById('levelCompleteStats')?.classList.remove('hidden');
        document.getElementById('multiplayerLevelResults')?.classList.add('hidden');

        const btnNextLevel = document.getElementById('btnNextLevel') as HTMLButtonElement | null;
        if (btnNextLevel) {
            btnNextLevel.disabled = false;
            btnNextLevel.textContent = '🚀 NEXT LEVEL';
        }

        const sub = document.getElementById('dialogLevelCompleteSub');
        if (sub) {
            sub.textContent = '';
        }

        game.uiManager.showDialog('dlgLevelComplete');
    }

    exportLevelJSON(): void {
        const data = this.game.editor.getExportData();
        const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", str);
        a.setAttribute("download", "jetpack_custom_level.json");
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    importLevelJSON(e: any): void {
        const game = this.game;
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event: any) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.grid && parsed.grid.length === game.tileMap.grid.length) {
                    game.tileMap.loadLevelData(parsed);
                    game.editor.autoSaveLocal();
                    game.uiManager.showBanner('CUSTOM LEVEL IMPORTED!');
                } else {
                    alert('Invalid level format!');
                }
            } catch (err) {
                alert('Error parsing JSON level file!');
            }
        };
        reader.readAsText(file);
    }
}
