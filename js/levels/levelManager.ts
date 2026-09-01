/* ==========================================================================
   LEVEL MANAGER
   Handles campaign level loading, custom level editing/testing, level completion, and level JSON import/export.
   ========================================================================== */

import { Game, GAME_STATES } from '../game.js';
import { CAMPAIGN_LEVELS } from './campaign.js';
import { TILE_SIZE, TILES } from '../world/tilemap.js';
import { userService } from '../network/userService.js';
import { CustomLevelHeader, CustomLevelRecord, CustomLevelResult } from '../shared/payloads.js';

export class LevelManager {
    game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    startLevel(index: number, isRestart: boolean = false, continueCampaign: boolean = false): void {
        const game = this.game;
        game.isCustomLevel = false;
        game.activeCustomLevelRecord = null;
        game.currentLevelIndex = index;
        game.deathSequenceTimer = 0;
        game.isDeathHandled = false;
        const levelData = CAMPAIGN_LEVELS[index];

        // Fresh start (menu, level select, retry): reset lives/score/fuel/ammo.
        // Campaign next-level progression and restarts after death keep them.
        if (!isRestart && !continueCampaign) {
            game.player.resetForNewGame();
        }

        game.tileMap.loadLevelData(levelData, isRestart);
        game.enemyManager.clear();

        // Spawn player at SPAWN tile
        const spawn = game.tileMap.getPrimarySpawnPoint();
        game.player.spawn(spawn.x, spawn.y);

        // Spawn Enemies from level data
        game.enemyManager.spawnEnemiesFromLevelData(levelData);
        this.spawnEnemiesFromGrid();

        game.gameState = GAME_STATES.PLAYING;
        game.audio.startGameMusic(index);
        document.getElementById('editorToolbar')?.classList.add('hidden');
        game.uiManager.closeAllDialogs();

        game.uiManager.showBanner(`${levelData.name.toUpperCase()}`);
    }

    startCustomLevelRecord(record: CustomLevelRecord, isRestart: boolean = false): void {
        const game = this.game;
        game.isCustomLevel = true;
        game.activeCustomLevelRecord = record;
        game.currentLevelIndex = -1;
        game.deathSequenceTimer = 0;
        game.isDeathHandled = false;

        // Fresh play of a community level starts with full lives/score/fuel/ammo
        if (!isRestart) {
            game.player.resetForNewGame();
        }

        game.tileMap.loadLevelData(record, isRestart);
        game.enemyManager.clear();

        const spawn = game.tileMap.getPrimarySpawnPoint();
        game.player.spawn(spawn.x, spawn.y);

        game.enemyManager.spawnEnemiesFromLevelData(record);
        this.spawnEnemiesFromGrid();

        game.gameState = GAME_STATES.PLAYING;
        game.audio.startGameMusic(0);
        document.getElementById('editorToolbar')?.classList.add('hidden');
        game.uiManager.closeAllDialogs();

        game.uiManager.showBanner(`${record.name.toUpperCase()} (BY ${record.authorName.toUpperCase()})`);
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
    }

    playtestCustomLevel(isRestart: boolean = false): void {
        const game = this.game;
        const validation = game.editor.validateLevel();
        if (!validation.valid) {
            console.error(validation.error);
            return;
        }

        game.isCustomLevel = true;
        game.currentLevelIndex = -1;
        game.deathSequenceTimer = 0;
        game.isDeathHandled = false;
        game.enemyManager.clear();
        game.tileMap.collectedEmeralds = 0;
        if (!isRestart) {
            game.player.resetForNewGame();
            game.tileMap.resetExtraLifeState();
        }

        let total = 0;
        for (let r = 0; r < game.tileMap.rows; r++) {
            for (let c = 0; c < game.tileMap.cols; c++) {
                const t = game.tileMap.getTile(c, r);
                if (t === TILES.EMERALD) total++;
            }
        }
        game.tileMap.totalEmeralds = total;
        game.tileMap.rebuildSpawnPoints();
        const spawn = game.tileMap.getPrimarySpawnPoint();
        game.player.spawn(spawn.x, spawn.y);
        this.spawnEnemiesFromGrid();

        game.gameState = GAME_STATES.PLAYING;
        game.audio.startGameMusic(0);
        document.getElementById('editorToolbar')?.classList.add('hidden');
        game.uiManager.closeAllDialogs();
        game.uiManager.showBanner('PLAYTEST CUSTOM LEVEL');
    }

    restartCurrentLevel(isRestart: boolean = false): void {
        const game = this.game;
        if (game.isCustomLevel) {
            if (game.activeCustomLevelRecord) {
                this.startCustomLevelRecord(game.activeCustomLevelRecord, isRestart);
            } else {
                this.playtestCustomLevel(isRestart);
            }
        } else {
            this.startLevel(game.currentLevelIndex, isRestart);
        }
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
                    game.enemyManager.addBoss(c * TILE_SIZE, r * TILE_SIZE, 10);
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

        // High score and rating integration for custom level
        if (game.isCustomLevel && game.activeCustomLevelRecord) {
            const record = game.activeCustomLevelRecord;
            const playerName = userService.getLoggedInUser()?.name || "Player";
            
            this.submitCustomLevelHighScore(record.id, game.player.score, playerName).then((res) => {
                if (res.success && res.level) {
                    game.activeCustomLevelRecord = res.level;
                }
            });

            if (sub) {
                sub.innerHTML = `Custom Level High Score: <strong>${record.highScore}</strong> (${record.highScoreUser})<br>Rate this level: <span class="star-rating" data-level-id="${record.id}"><button data-star="1">⭐1</button> <button data-star="2">⭐2</button> <button data-star="3">⭐3</button> <button data-star="4">⭐4</button> <button data-star="5">⭐5</button></span>`;
                const ratingButtons = sub.querySelectorAll('.star-rating button');
                ratingButtons.forEach((btn) => {
                    btn.addEventListener('click', async (e) => {
                        const target = e.currentTarget as HTMLButtonElement;
                        const star = parseInt(target.dataset.star || '5', 10);
                        const result = await this.rateCustomLevel(record.id, star);
                        if (result.success && result.level) {
                            game.activeCustomLevelRecord = result.level;
                            sub.innerHTML = `Thank you for rating! Level Average Rating: <strong>${result.level.averageRating}★</strong> (${result.level.ratingCount} votes)`;
                        }
                    });
                });
            }
        } else if (sub) {
            sub.textContent = '';
        }

        game.uiManager.showDialog('dlgLevelComplete');
    }



    async fetchCustomLevels(): Promise<CustomLevelHeader[]> {
        try {
            const userId = userService.getLoggedInUserId();
            const headers: Record<string, string> = {};
            if (userId) {
                headers["Authorization"] = `Bearer ${userId}`;
            }
            const res = await fetch("/api/levels", { headers });
            const data = (await res.json()) as { success: boolean; levels?: CustomLevelHeader[]; error?: string };
            return data.success && data.levels ? data.levels : [];
        } catch (err) {
            console.error("Failed to fetch custom levels:", err);
            return [];
        }
    }

    async fetchCustomLevelById(levelId: string): Promise<CustomLevelRecord | null> {
        try {
            const userId = userService.getLoggedInUserId();
            const headers: Record<string, string> = {};
            if (userId) {
                headers["Authorization"] = `Bearer ${userId}`;
            }
            const res = await fetch(`/api/levels/${encodeURIComponent(levelId)}`, { headers });
            const data = (await res.json()) as CustomLevelResult;
            return data.success && data.level ? data.level : null;
        } catch (err) {
            console.error("Failed to fetch custom level by ID:", err);
            return null;
        }
    }

    async uploadCustomLevel(levelData: Partial<CustomLevelRecord>): Promise<CustomLevelResult> {
        const userId = userService.getLoggedInUserId();
        if (!userId) {
            return { success: false, error: "Please log in to upload custom levels." };
        }
        try {
            const res = await fetch("/api/levels", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userId}`,
                },
                body: JSON.stringify(levelData),
            });
            return (await res.json()) as CustomLevelResult;
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : "Network error uploading custom level.";
            return { success: false, error };
        }
    }

    async updateCustomLevel(levelId: string, levelData: Partial<CustomLevelRecord>): Promise<CustomLevelResult> {
        const userId = userService.getLoggedInUserId();
        if (!userId) {
            return { success: false, error: "Please log in to edit your custom levels." };
        }
        try {
            const res = await fetch(`/api/levels/${encodeURIComponent(levelId)}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userId}`,
                },
                body: JSON.stringify(levelData),
            });
            return (await res.json()) as CustomLevelResult;
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : "Network error updating custom level.";
            return { success: false, error };
        }
    }

    async deleteCustomLevel(levelId: string): Promise<CustomLevelResult> {
        const userId = userService.getLoggedInUserId();
        if (!userId) {
            return { success: false, error: "Please log in to delete custom levels." };
        }
        try {
            const res = await fetch(`/api/levels/${encodeURIComponent(levelId)}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${userId}`,
                },
            });
            return (await res.json()) as CustomLevelResult;
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : "Network error deleting custom level.";
            return { success: false, error };
        }
    }

    async rateCustomLevel(levelId: string, rating: number): Promise<CustomLevelResult> {
        const userId = userService.getLoggedInUserId();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (userId) {
            headers["Authorization"] = `Bearer ${userId}`;
        }
        try {
            const res = await fetch(`/api/levels/${encodeURIComponent(levelId)}/rate`, {
                method: "POST",
                headers,
                body: JSON.stringify({ rating }),
            });
            return (await res.json()) as CustomLevelResult;
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : "Network error rating custom level.";
            return { success: false, error };
        }
    }

    async submitCustomLevelHighScore(levelId: string, score: number, userName: string): Promise<CustomLevelResult> {
        try {
            const res = await fetch(`/api/levels/${encodeURIComponent(levelId)}/highscore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score, userName }),
            });
            return (await res.json()) as CustomLevelResult;
        } catch (err: unknown) {
            const error = err instanceof Error ? err.message : "Network error submitting high score.";
            return { success: false, error };
        }
    }
}

