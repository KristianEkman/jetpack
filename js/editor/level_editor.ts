/* ==========================================================================
   LEVEL EDITOR ENGINE
   ========================================================================== */

import { LevelData } from '../shared/payloads.js';
import { TileMap, TILES, TILE_SIZE, GRID_COLS, GRID_ROWS } from '../world/tilemap.js';

export interface PaletteItem {
    type: number;
    name: string;
    icon: string;
    color: string;
}

export const PALETTE: PaletteItem[] = [
    { type: TILES.AIR, name: 'Eraser', icon: '🧹', color: 'rgba(255,255,255,0.1)' },
    { type: TILES.BRICK, name: 'Brick', icon: '🧱', color: '#8b263e' },
    { type: TILES.PHASE_BRICK, name: 'Phase Brick', icon: '⚡', color: '#00f0ff' },
    { type: TILES.ICE, name: 'Ice Floor', icon: '🧊', color: '#b4f0ff' },
    { type: TILES.CONVEYOR_LEFT, name: 'Conv Left', icon: '◄', color: '#e74c3c' },
    { type: TILES.CONVEYOR_RIGHT, name: 'Conv Right', icon: '►', color: '#e74c3c' },
    { type: TILES.LADDER, name: 'Ladder', icon: '🪜', color: '#d35400' },
    { type: TILES.VINE, name: 'Vine', icon: '🌿', color: '#27ae60' },
    { type: TILES.SPIKE, name: 'Spike', icon: '⚠️', color: '#e74c3c' },
    { type: TILES.ENERGY_DRAIN, name: 'Energy Drain', icon: '☣️', color: '#ff0055' },
    { type: TILES.EMERALD, name: 'Emerald', icon: '💎', color: '#00ff77' },
    { type: TILES.FUEL, name: 'Fuel Can', icon: '⛽', color: '#f39c12' },
    { type: TILES.GOLD, name: 'Gold Coin', icon: '🪙', color: '#f1c40f' },
    { type: TILES.EXTRA_LIFE, name: 'Extra Life', icon: '❤️', color: '#ff2d55' },
    { type: TILES.RAPID_FIRE, name: 'Rapid Fire', icon: '⚡⚡', color: '#ff3300' },
    { type: TILES.SPAWN, name: 'Player Spawn', icon: '🚀', color: '#00ffcc' },
    { type: TILES.EXIT_PORTAL, name: 'Exit Portal', icon: '🌀', color: '#ff00ff' },
    { type: TILES.TELEPORTER, name: 'Teleporter', icon: '🔮', color: '#9b59b6' },
    { type: TILES.ENEMY_FLITZER, name: 'Flitzer Enemy', icon: '👿', color: '#ff0055' },
    { type: TILES.ENEMY_MISSILE, name: 'Homing Missile', icon: '🚀', color: '#ff5500' },
    { type: TILES.ENEMY_TURRET, name: 'Turret Enemy', icon: '🤖', color: '#e74c3c' },
    { type: TILES.ENEMY_BOSS, name: 'Boss Enemy', icon: '👾', color: '#ff0033' }
];

export class LevelEditor {
    canvas: HTMLCanvasElement;
    tileMap: TileMap;
    onPlaytest: () => void;
    isEditorActive: () => boolean;
    selectedTile: number;
    isPainting: boolean;
    hoverCol: number;
    hoverRow: number;

    constructor(canvas: HTMLCanvasElement, tileMap: TileMap, onPlaytest: () => void, isEditorActive: () => boolean = () => true) {
        this.canvas = canvas;
        this.tileMap = tileMap;
        this.onPlaytest = onPlaytest;
        this.isEditorActive = isEditorActive;

        this.selectedTile = TILES.BRICK;
        this.isPainting = false;
        this.hoverCol = -1;
        this.hoverRow = -1;

        this.initPaletteUI();
        this.bindCanvasEvents();
    }

    initPaletteUI(): void {
        const paletteContainer = document.getElementById('tilePalette');
        if (!paletteContainer) return;

        paletteContainer.innerHTML = '';
        PALETTE.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `tile-btn ${item.type === this.selectedTile ? 'active' : ''}`;
            btn.dataset.tile = String(item.type);
            
            btn.innerHTML = `
                <div class="tile-preview" style="background:${item.color}; display:flex; align-items:center; justify-content:center; font-size:12px;">${item.icon}</div>
                <span class="tile-name">${item.name}</span>
            `;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.tile-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTile = item.type;
            });

            paletteContainer.appendChild(btn);
        });
    }

    bindCanvasEvents(): void {
        const getCanvasCoords = (e: MouseEvent | TouchEvent) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const touchPoint = 'touches' in e && e.touches.length > 0 ? e.touches[0] : (e as MouseEvent);
            const clientX = touchPoint.clientX;
            const clientY = touchPoint.clientY;

            const col = Math.floor(((clientX - rect.left) * scaleX) / TILE_SIZE);
            const row = Math.floor(((clientY - rect.top) * scaleY) / TILE_SIZE);
            return { col, row };
        };

        const handleStart = (e: MouseEvent | TouchEvent) => {
            if (this.isEditorActive && !this.isEditorActive()) return;
            this.isPainting = true;
            const { col, row } = getCanvasCoords(e);
            this.paintTile(col, row);
        };

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (this.isEditorActive && !this.isEditorActive()) {
                this.hoverCol = -1;
                this.hoverRow = -1;
                this.isPainting = false;
                return;
            }
            const { col, row } = getCanvasCoords(e);
            this.hoverCol = col;
            this.hoverRow = row;
            if (this.isPainting) {
                this.paintTile(col, row);
            }
        };

        const handleEnd = () => {
            if (this.isPainting) {
                this.isPainting = false;
                this.autoSaveLocal();
            }
        };

        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
    }

    paintTile(col: number, row: number): void {
        if (this.isEditorActive && !this.isEditorActive()) return;
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

        if (this.selectedTile === TILES.SPAWN) {
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (this.tileMap.getTile(c, r) === TILES.SPAWN) {
                        this.tileMap.setTile(c, r, TILES.AIR);
                    }
                }
            }
        }
        if (this.selectedTile === TILES.EXIT_PORTAL) {
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (this.tileMap.getTile(c, r) === TILES.EXIT_PORTAL) {
                        this.tileMap.setTile(c, r, TILES.AIR);
                    }
                }
            }
        }

        this.tileMap.setTile(col, row, this.selectedTile);
    }

    validateLevel(): { valid: boolean; error?: string } {
        let spawnCount = 0;
        let portalCount = 0;
        let emeraldCount = 0;

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const t = this.tileMap.getTile(c, r);
                if (t === TILES.SPAWN) spawnCount++;
                if (t === TILES.EXIT_PORTAL) portalCount++;
                if (t === TILES.EMERALD) emeraldCount++;
            }
        }

        if (spawnCount === 0) return { valid: false, error: 'Please place a Player Spawn point (🚀)!' };
        if (portalCount === 0) return { valid: false, error: 'Please place an Exit Portal (🌀)!' };
        if (emeraldCount === 0) return { valid: false, error: 'Please place at least one Emerald (💎)!' };

        return { valid: true };
    }

    getExportData(): { name: string; author: string; cols: number; rows: number; grid: number[] } {
        return {
            name: "Custom Jetpack Level",
            author: "User",
            cols: GRID_COLS,
            rows: GRID_ROWS,
            grid: [...this.tileMap.grid]
        };
    }

    autoSaveLocal(): void {
        try {
            localStorage.setItem('jetpack_custom_level', JSON.stringify(this.getExportData()));
        } catch (e) {
            // ignore
        }
    }

    loadFromLocal(): boolean {
        try {
            const data = localStorage.getItem('jetpack_custom_level');
            if (data) {
                const parsed = JSON.parse(data);
                this.tileMap.loadLevelData(parsed);
                return true;
            }
        } catch (e) {
            // ignore
        }
        return false;
    }

    loadFromJSON(jsonData: LevelData | null): boolean {
        if (!jsonData || !Array.isArray(jsonData.grid)) return false;
        this.tileMap.loadLevelData(jsonData);
        this.autoSaveLocal();
        return true;
    }

    renderHoverPreview(ctx: CanvasRenderingContext2D): void {
        if (this.hoverCol >= 0 && this.hoverCol < GRID_COLS && this.hoverRow >= 0 && this.hoverRow < GRID_ROWS) {
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.hoverCol * TILE_SIZE, this.hoverRow * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
}
