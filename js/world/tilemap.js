/* ==========================================================================
   TILEMAP & WORLD ENGINE
   ========================================================================== */

export const TILE_SIZE = 32;
export const GRID_COLS = 30; // 30 * 32 = 960 px
export const GRID_ROWS = 18; // 18 * 32 = 576 px (+ HUD height)

export const TILES = {
    AIR: 0,
    BRICK: 1,
    PHASE_BRICK: 2,
    ICE: 3,
    CONVEYOR_LEFT: 4,
    CONVEYOR_RIGHT: 5,
    LADDER: 6,
    VINE: 7,
    SPIKE: 8,
    ENERGY_DRAIN: 9,
    EMERALD: 10,
    FUEL: 11,
    GOLD: 12,
    SPAWN: 13,
    EXIT_PORTAL: 14,
    TELEPORTER: 15
};

export class TileMap {
    constructor() {
        this.cols = GRID_COLS;
        this.rows = GRID_ROWS;
        this.grid = new Array(this.rows * this.cols).fill(TILES.AIR);

        // Dissolved Phase Bricks timer queue: { index, originalTile, timer }
        this.dissolvedBricks = [];

        // Animated portal angle & particle timer
        this.portalAngle = 0;
        this.totalEmeralds = 0;
        this.collectedEmeralds = 0;

        // Teleporters array: list of tile indices
        this.teleporters = [];

        // Particles system
        this.particles = [];
    }

    loadLevelData(levelData) {
        this.grid = [...levelData.grid];
        this.dissolvedBricks = [];
        this.particles = [];
        this.collectedEmeralds = 0;
        this.countTotalEmeralds();
        this.rebuildTeleporters();
    }

    getTile(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return TILES.BRICK; // Out of bounds is solid brick
        }
        return this.grid[row * this.cols + col];
    }

    setTile(col, row, tileType) {
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            this.grid[row * this.cols + col] = tileType;
            this.rebuildTeleporters();
        }
    }

    countTotalEmeralds() {
        let count = 0;
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === TILES.EMERALD) {
                count++;
            }
        }
        this.totalEmeralds = count;
    }

    rebuildTeleporters() {
        this.teleporters = [];

        const visited = new Set();
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === TILES.TELEPORTER && !visited.has(i)) {
                // Group contiguous teleporter tiles into a single Teleporter Pad node
                const padTiles = [];
                const queue = [i];
                visited.add(i);

                let sumCol = 0;
                let sumRow = 0;

                while (queue.length > 0) {
                    const curr = queue.shift();
                    padTiles.push(curr);

                    const c = curr % this.cols;
                    const r = Math.floor(curr / this.cols);
                    sumCol += c;
                    sumRow += r;

                    const neighbors = [
                        { c: c - 1, r },
                        { c: c + 1, r },
                        { c, r: r - 1 },
                        { c, r: r + 1 }
                    ];

                    for (let n of neighbors) {
                        if (n.c >= 0 && n.c < this.cols && n.r >= 0 && n.r < this.rows) {
                            const nIdx = n.r * this.cols + n.c;
                            if (this.grid[nIdx] === TILES.TELEPORTER && !visited.has(nIdx)) {
                                visited.add(nIdx);
                                queue.push(nIdx);
                            }
                        }
                    }
                }

                const avgCol = sumCol / padTiles.length;
                const avgRow = sumRow / padTiles.length;

                this.teleporters.push({
                    tiles: padTiles,
                    col: avgCol,
                    row: avgRow,
                    x: avgCol * TILE_SIZE,
                    y: avgRow * TILE_SIZE
                });
            }
        }
    }

    // Check if tile is solid for collision
    isSolid(col, row) {
        const tile = this.getTile(col, row);
        return [TILES.BRICK, TILES.PHASE_BRICK, TILES.ICE, TILES.CONVEYOR_LEFT, TILES.CONVEYOR_RIGHT].includes(tile);
    }

    // Check climbable
    isClimbable(col, row) {
        const tile = this.getTile(col, row);
        return tile === TILES.LADDER || tile === TILES.VINE;
    }

    // Phase Shifter beam targeting: dissolves phaseable brick at tile
    phaseTile(col, row) {
        const tile = this.getTile(col, row);
        if (tile === TILES.PHASE_BRICK) {
            const index = row * this.cols + col;
            // Prevent duplicating restoration timer
            if (!this.dissolvedBricks.some(b => b.index === index)) {
                this.grid[index] = TILES.AIR;
                this.dissolvedBricks.push({
                    index,
                    col,
                    row,
                    originalTile: TILES.PHASE_BRICK,
                    timer: 5.0 // Re-solidifies in 5 seconds
                });

                // Spawn disintegration particles
                this.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#00e5ff', 12);
                return true;
            }
        }
        return false;
    }

    update(dt, player = null, enemyManager = null) {
        // Update portal animation rotation
        this.portalAngle += dt * 3;

        // Collect entities to check for tile occupancy
        const entities = [];
        if (player && !player.isDead) entities.push(player);
        if (enemyManager && enemyManager.enemies) {
            for (const enemy of enemyManager.enemies) {
                entities.push(enemy);
            }
        }

        // Update dissolved phase bricks restoration timer
        for (let i = this.dissolvedBricks.length - 1; i >= 0; i--) {
            const brick = this.dissolvedBricks[i];
            brick.timer -= dt;

            // Flash warning when about to rebuild
            if (brick.timer <= 0.8 && Math.floor(brick.timer * 10) % 2 === 0) {
                this.addSparkles(brick.col * TILE_SIZE + 16, brick.row * TILE_SIZE + 16, '#ffcc00', 2);
            }

            if (brick.timer <= 0) {
                const brickLeft = brick.col * TILE_SIZE;
                const brickRight = brickLeft + TILE_SIZE;
                const brickTop = brick.row * TILE_SIZE;
                const brickBottom = brickTop + TILE_SIZE;

                // Check if any entity currently overlaps this phase brick tile
                const isOccupied = entities.some(e => {
                    const eLeft = e.x;
                    const eRight = e.x + e.width;
                    const eTop = e.y;
                    const eBottom = e.y + e.height;
                    return eLeft < brickRight && eRight > brickLeft && eTop < brickBottom && eBottom > brickTop;
                });

                if (isOccupied) {
                    // Delay re-solidification while occupied so entities don't get trapped inside solid geometry
                    brick.timer = 0.4;
                    this.addSparkles(brick.col * TILE_SIZE + 16, brick.row * TILE_SIZE + 16, '#ffaa00', 3);
                } else {
                    // Re-solidify brick
                    this.grid[brick.index] = brick.originalTile;
                    this.addSparkles(brick.col * TILE_SIZE + 16, brick.row * TILE_SIZE + 16, '#00ffcc', 10);
                    this.dissolvedBricks.splice(i, 1);
                }
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;
            p.size = Math.max(0, p.size - dt * 2);

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    addSparkles(x, y, color = '#00ffcc', count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 60 + 20;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed * 0.016,
                vy: Math.sin(angle) * speed * 0.016,
                color,
                size: Math.random() * 4 + 2,
                life: Math.random() * 0.4 + 0.2
            });
        }
    }

    // Canvas Render Engine for TileMap
    render(ctx) {
        ctx.clearRect(0, 0, this.cols * TILE_SIZE, this.rows * TILE_SIZE);

        // Draw Background Grid Lines (Single batched path stroke for high performance)
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 0; c <= this.cols; c++) {
            ctx.moveTo(c * TILE_SIZE, 0);
            ctx.lineTo(c * TILE_SIZE, this.rows * TILE_SIZE);
        }
        for (let r = 0; r <= this.rows; r++) {
            ctx.moveTo(0, r * TILE_SIZE);
            ctx.lineTo(this.cols * TILE_SIZE, r * TILE_SIZE);
        }
        ctx.stroke();

        // Render Tiles
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.getTile(c, r);
                if (tile === TILES.AIR) continue;

                const x = c * TILE_SIZE;
                const y = r * TILE_SIZE;

                this.renderTile(ctx, tile, x, y, c, r);
            }
        }

        // Render Dissolved Phase Bricks Ghost Outlines
        for (let b of this.dissolvedBricks) {
            const x = b.col * TILE_SIZE;
            const y = b.row * TILE_SIZE;
            ctx.save();
            ctx.strokeStyle = b.timer <= 0.8 ? '#ffcc00' : 'rgba(0, 240, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.restore();
        }

        // Render Particles Layer
        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderTile(ctx, tile, x, y, c, r) {
        switch (tile) {
            case TILES.BRICK:
                // Classic Red-Brown Metallic Brick
                ctx.fillStyle = '#8b263e';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#b83b5e';
                ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                ctx.fillStyle = '#4a1525';
                ctx.fillRect(x + 2, y + TILE_SIZE / 2, TILE_SIZE - 4, 2);
                ctx.fillRect(x + TILE_SIZE / 2, y + 2, 2, TILE_SIZE / 2 - 2);
                break;

            case TILES.PHASE_BRICK:
                // Phaseable Cyan Glass Brick
                ctx.fillStyle = 'rgba(0, 204, 255, 0.4)';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                // Glowing inner core
                ctx.fillStyle = '#00f0ff';
                ctx.fillRect(x + 10, y + 10, TILE_SIZE - 20, TILE_SIZE - 20);
                break;

            case TILES.ICE:
                // Ice Floor Block
                ctx.fillStyle = 'rgba(180, 240, 255, 0.6)';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#ffffff';
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.beginPath();
                ctx.moveTo(x + 4, y + TILE_SIZE - 4);
                ctx.lineTo(x + TILE_SIZE - 4, y + 4);
                ctx.stroke();
                break;

            case TILES.CONVEYOR_LEFT:
            case TILES.CONVEYOR_RIGHT:
                ctx.fillStyle = '#34495e';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(x, y + 4, TILE_SIZE, 6);
                // Animated arrows
                ctx.fillStyle = '#f1c40f';
                ctx.font = '12px Orbitron, sans-serif';
                const arrow = tile === TILES.CONVEYOR_LEFT ? '◄' : '►';
                ctx.fillText(arrow, x + 8, y + 22);
                break;

            case TILES.LADDER:
                ctx.fillStyle = '#d35400';
                ctx.fillRect(x + 4, y, 4, TILE_SIZE);
                ctx.fillRect(x + TILE_SIZE - 8, y, 4, TILE_SIZE);
                ctx.fillRect(x + 4, y + 8, TILE_SIZE - 8, 3);
                ctx.fillRect(x + 4, y + 20, TILE_SIZE - 8, 3);
                break;

            case TILES.VINE:
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(x + 14, y, 4, TILE_SIZE);
                ctx.beginPath();
                ctx.arc(x + 10, y + 10, 4, 0, Math.PI * 2);
                ctx.arc(x + 22, y + 22, 4, 0, Math.PI * 2);
                ctx.fill();
                break;

            case TILES.SPIKE:
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.moveTo(x, y + TILE_SIZE);
                ctx.lineTo(x + 8, y);
                ctx.lineTo(x + 16, y + TILE_SIZE);
                ctx.lineTo(x + 24, y);
                ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
                ctx.closePath();
                ctx.fill();
                break;

            case TILES.ENERGY_DRAIN:
                ctx.fillStyle = 'rgba(255, 0, 85, 0.35)';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#ff0055';
                ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                // Lightning bolt icon
                ctx.fillStyle = '#ff0055';
                ctx.font = '14px sans-serif';
                ctx.fillText('⚡', x + 8, y + 22);
                break;

            case TILES.EMERALD:
                // Premium 3D Brilliant-Cut Emerald Gem with Radiant Aura & Sparkle Glint
                const hoverOffset = Math.sin(Date.now() / 250) * 1.5;
                const cx = x + 16;
                const cy = y + 16 + hoverOffset;
                const pulseGlow = (Math.sin(Date.now() / 180) + 1) * 0.5;

                // 1. Multi-layered Radiant Ambient Aura
                const outerGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18 + pulseGlow * 3);
                outerGlow.addColorStop(0, `rgba(0, 255, 136, ${0.4 + pulseGlow * 0.2})`);
                outerGlow.addColorStop(0.5, `rgba(0, 255, 204, ${0.15 + pulseGlow * 0.1})`);
                outerGlow.addColorStop(1, 'rgba(0, 255, 136, 0)');
                ctx.fillStyle = outerGlow;
                ctx.beginPath();
                ctx.arc(cx, cy, 18 + pulseGlow * 3, 0, Math.PI * 2);
                ctx.fill();

                // 3D Gem Coordinates
                const pT  = { x: cx, y: cy - 13 };       // Top vertex
                const pUL = { x: cx - 9, y: cy - 5 };     // Upper left shoulder
                const pUR = { x: cx + 9, y: cy - 5 };     // Upper right shoulder
                const pML = { x: cx - 13, y: cy + 1 };    // Mid left girdle
                const pMR = { x: cx + 13, y: cy + 1 };    // Mid right girdle
                const pB  = { x: cx, y: cy + 13 };       // Bottom culet
                const pC  = { x: cx, y: cy - 2 };        // Center facet vertex

                // 2. Pavilion Lower Facets (Deep Shaded Emerald Base for 3D Depth)
                // Bottom-left facet
                ctx.fillStyle = '#004d25';
                ctx.beginPath();
                ctx.moveTo(pML.x, pML.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.lineTo(pB.x, pB.y);
                ctx.closePath();
                ctx.fill();

                // Bottom-right facet
                ctx.fillStyle = '#006b32';
                ctx.beginPath();
                ctx.moveTo(pMR.x, pMR.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.lineTo(pB.x, pB.y);
                ctx.closePath();
                ctx.fill();

                // 3. Crown Side Facets (Vibrant Metallic Emerald Green)
                // Mid-left crown
                ctx.fillStyle = '#00a84e';
                ctx.beginPath();
                ctx.moveTo(pUL.x, pUL.y);
                ctx.lineTo(pML.x, pML.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.closePath();
                ctx.fill();

                // Mid-right crown
                ctx.fillStyle = '#00cc5f';
                ctx.beginPath();
                ctx.moveTo(pUR.x, pUR.y);
                ctx.lineTo(pMR.x, pMR.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.closePath();
                ctx.fill();

                // Top-left crown
                ctx.fillStyle = '#00ff77';
                ctx.beginPath();
                ctx.moveTo(pT.x, pT.y);
                ctx.lineTo(pUL.x, pUL.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.closePath();
                ctx.fill();

                // Top-right crown (bright light source side)
                ctx.fillStyle = '#42ff9e';
                ctx.beginPath();
                ctx.moveTo(pT.x, pT.y);
                ctx.lineTo(pUR.x, pUR.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.closePath();
                ctx.fill();

                // 4. Center Table Facet (Brightest Reflective Crystal Highlight)
                const tableGrad = ctx.createLinearGradient(pUL.x, pT.y, pUR.x, pC.y);
                tableGrad.addColorStop(0, '#ffffff');
                tableGrad.addColorStop(0.4, '#aaffdd');
                tableGrad.addColorStop(1, '#00ff88');
                ctx.fillStyle = tableGrad;
                ctx.beginPath();
                ctx.moveTo(pT.x, pT.y);
                ctx.lineTo(pUR.x, pUR.y);
                ctx.lineTo(pC.x, pC.y);
                ctx.lineTo(pUL.x, pUL.y);
                ctx.closePath();
                ctx.fill();

                // 5. Crisp Facet Edges & Outline
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                // Outer perimeter
                ctx.moveTo(pT.x, pT.y);
                ctx.lineTo(pUR.x, pUR.y);
                ctx.lineTo(pMR.x, pMR.y);
                ctx.lineTo(pB.x, pB.y);
                ctx.lineTo(pML.x, pML.y);
                ctx.lineTo(pUL.x, pUL.y);
                ctx.closePath();
                // Inner facet spokes
                ctx.moveTo(pC.x, pC.y); ctx.lineTo(pT.x, pT.y);
                ctx.moveTo(pC.x, pC.y); ctx.lineTo(pB.x, pB.y);
                ctx.moveTo(pC.x, pC.y); ctx.lineTo(pML.x, pML.y);
                ctx.moveTo(pC.x, pC.y); ctx.lineTo(pMR.x, pMR.y);
                ctx.moveTo(pC.x, pC.y); ctx.lineTo(pUL.x, pUL.y);
                ctx.moveTo(pC.x, pC.y); ctx.lineTo(pUR.x, pUR.y);
                ctx.stroke();

                // 6. Dynamic Star Flare Glint (Top-Left Highlight Vertex)
                const flareTime = Date.now() / 200;
                const flareSize = (Math.sin(flareTime) + 1) * 2.5 + 2;
                const flareAlpha = (Math.sin(flareTime) + 1) * 0.4 + 0.4;
                const fx = pUL.x + 1;
                const fy = pUL.y + 1;

                ctx.strokeStyle = `rgba(255, 255, 255, ${flareAlpha})`;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(fx - flareSize, fy); ctx.lineTo(fx + flareSize, fy);
                ctx.moveTo(fx, fy - flareSize); ctx.lineTo(fx, fy + flareSize);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case TILES.FUEL: {
                // Instantly Recognizable Classic Jerrycan Fuel Canister
                const now = Date.now();
                const hoverY = Math.sin(now / 220) * 1.5;
                const pulse = (Math.sin(now / 180) + 1) * 0.5;
                const cx = x + 16;
                const cy = y + 16 + hoverY;

                ctx.save();

                // 1. Radiant Outer Energy Glow (Amber/Yellow Warm Aura)
                const outerGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16 + pulse * 2);
                outerGlow.addColorStop(0, `rgba(255, 170, 0, ${0.45 + pulse * 0.2})`);
                outerGlow.addColorStop(0.6, `rgba(255, 80, 0, ${0.15 + pulse * 0.1})`);
                outerGlow.addColorStop(1, 'rgba(255, 80, 0, 0)');
                ctx.fillStyle = outerGlow;
                ctx.beginPath();
                ctx.arc(cx, cy, 16 + pulse * 2, 0, Math.PI * 2);
                ctx.fill();

                // 2. Floating Drop Shadow underneath
                const shadowScale = Math.max(0.6, 1 - hoverY * 0.12);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.beginPath();
                ctx.ellipse(cx, y + 29, 8 * shadowScale, 2.5 * shadowScale, 0, 0, Math.PI * 2);
                ctx.fill();

                // Jerrycan Main Dimensions (centered at cx, cy)
                const w = 16;
                const h = 18;
                const bx = cx - w / 2;
                const by = cy - h / 2 + 2;

                // 3. Jerrycan Carrying Handle (Top 3-Rib Heavy Industrial Bar)
                ctx.fillStyle = '#1c2833';
                ctx.fillRect(cx - 6, by - 5, 12, 3);
                
                // Chrome Handle Grip Highlights
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(cx - 5, by - 5, 3, 2);
                ctx.fillRect(cx - 1, by - 5, 3, 2);
                ctx.fillRect(cx + 3, by - 5, 3, 2);

                // 4. Heavy Brass Filler Cap / Spout (Angled Top Left)
                ctx.fillStyle = '#d35400';
                ctx.fillRect(bx + 1, by - 4, 4, 3);
                ctx.fillStyle = '#f1c40f'; // Cap highlight
                ctx.fillRect(bx + 1.5, by - 5, 3, 1.5);

                // 5. Jerrycan Main Body (Vibrant High-Contrast Industrial Red-Orange)
                const bodyGrad = ctx.createLinearGradient(bx, 0, bx + w, 0);
                bodyGrad.addColorStop(0, '#b02a00');   // Deep red left border
                bodyGrad.addColorStop(0.25, '#e74c3c'); // Racing red
                bodyGrad.addColorStop(0.55, '#ff5522'); // Vibrant bright orange-red
                bodyGrad.addColorStop(0.75, '#ff8800'); // Specular highlight ridge
                bodyGrad.addColorStop(1, '#800c2f');   // Shaded right edge

                ctx.fillStyle = bodyGrad;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, by, w, h, 2);
                } else {
                    ctx.rect(bx, by, w, h);
                }
                ctx.fill();

                // Crisp Dark Perimeter Outline for Maximum Contrast against any background
                ctx.strokeStyle = '#200500';
                ctx.lineWidth = 1;
                ctx.stroke();

                // 6. Iconic Stamped Jerrycan "X" Structural Embossing
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(bx + 3, by + 3); ctx.lineTo(bx + w - 3, by + h - 3);
                ctx.moveTo(bx + w - 3, by + 3); ctx.lineTo(bx + 3, by + h - 3);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bx + 3.5, by + 4); ctx.lineTo(bx + w - 3.5, by + h - 2);
                ctx.moveTo(bx + w - 3.5, by + 4); ctx.lineTo(bx + 3.5, by + h - 2);
                ctx.stroke();

                // 7. Center Emblem: Glowing Vector Fuel Flame Symbol (Ultra-sharp & Recognizable)
                const fx = cx;
                const fy = by + h / 2 - 0.5;

                // Outer Flame (Red-Orange)
                ctx.fillStyle = '#ff2200';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 5);
                ctx.bezierCurveTo(fx + 4, fy - 1, fx + 4, fy + 4, fx, fy + 4);
                ctx.bezierCurveTo(fx - 4, fy + 4, fx - 4, fy - 1, fx, fy - 5);
                ctx.fill();

                // Inner Flame (Bright Yellow)
                ctx.fillStyle = '#ffeb3b';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 3);
                ctx.bezierCurveTo(fx + 2.5, fy, fx + 2.5, fy + 3, fx, fy + 3);
                ctx.bezierCurveTo(fx - 2.5, fy + 3, fx - 2.5, fy, fx, fy - 3);
                ctx.fill();

                // Flame Core (White Hot)
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(fx, fy - 1);
                ctx.bezierCurveTo(fx + 1.2, fy + 0.8, fx + 1.2, fy + 2, fx, fy + 2);
                ctx.bezierCurveTo(fx - 1.2, fy + 2, fx - 1.2, fy + 0.8, fx, fy - 1);
                ctx.fill();

                // 8. Animated Liquid Sight Gauge (Right Edge Vertical Glass Strip)
                const gw = 2.5;
                const gh = 10;
                const gx = bx + w - 3.5;
                const gy = by + 4;

                ctx.fillStyle = '#100500';
                ctx.fillRect(gx, gy, gw, gh);

                const slosh = Math.sin(now / 150) * 0.5;
                const fillH = 7 + slosh;
                const fillY = gy + (gh - fillH);

                const fuelGrad = ctx.createLinearGradient(0, fillY, 0, gy + gh);
                fuelGrad.addColorStop(0, '#ffee00');
                fuelGrad.addColorStop(1, '#ff5500');

                ctx.fillStyle = fuelGrad;
                ctx.fillRect(gx, fillY, gw, gh - (fillY - gy));

                // 9. High-Gloss Specular Chrome Reflection Streak on Left Rim
                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.fillRect(bx + 1.5, by + 2, 1.2, h - 4);

                // Animated Sparkle Glint on Brass Cap
                const glintTime = now / 180;
                const glintAlpha = (Math.sin(glintTime) + 1) * 0.45 + 0.1;
                const glintSize = (Math.sin(glintTime) + 1) * 1.5 + 1;
                const capGx = bx + 3;
                const capGy = by - 4;

                ctx.strokeStyle = `rgba(255, 255, 255, ${glintAlpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(capGx - glintSize, capGy); ctx.lineTo(capGx + glintSize, capGy);
                ctx.moveTo(capGx, capGy - glintSize); ctx.lineTo(capGx, capGy + glintSize);
                ctx.stroke();

                ctx.restore();
                break;
            }

            case TILES.GOLD:
                // Gold Coin
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(x + 16, y + 16, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#d35400';
                ctx.stroke();
                break;

            case TILES.SPAWN:
                ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#00ffcc';
                ctx.font = '10px Orbitron, sans-serif';
                ctx.fillText('START', x + 2, y + 20);
                break;

            case TILES.EXIT_PORTAL:
                // Swirling Exit Portal
                const isUnlocked = this.collectedEmeralds >= this.totalEmeralds;
                ctx.save();
                ctx.translate(x + 16, y + 16);
                ctx.rotate(this.portalAngle);

                ctx.strokeStyle = isUnlocked ? '#00ffcc' : '#7f8c8d';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 1.5);
                ctx.stroke();

                ctx.strokeStyle = isUnlocked ? '#ff00ff' : '#95a5a6';
                ctx.beginPath();
                ctx.arc(0, 0, 6, Math.PI * 0.5, Math.PI * 2);
                ctx.stroke();

                ctx.restore();

                if (isUnlocked) {
                    // Multi-layer glowing core (Fast vector alternative to software shadowBlur)
                    ctx.fillStyle = 'rgba(0, 255, 204, 0.35)';
                    ctx.beginPath();
                    ctx.arc(x + 16, y + 16, 8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#00ffcc';
                    ctx.beginPath();
                    ctx.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case TILES.TELEPORTER: {
                const now = Date.now();
                const pulse = (Math.sin(now / 150) + 1) * 0.5;
                const rot = (now / 350) % (Math.PI * 2);
                const cx = x + 16;
                const cy = y + 16;

                ctx.save();

                // 1. Ambient Purple Radiant Aura
                const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 17 + pulse * 2);
                glow.addColorStop(0, `rgba(155, 89, 182, ${0.5 + pulse * 0.25})`);
                glow.addColorStop(0.6, `rgba(0, 206, 201, ${0.2 + pulse * 0.1})`);
                glow.addColorStop(1, 'rgba(142, 68, 173, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(cx, cy, 17 + pulse * 2, 0, Math.PI * 2);
                ctx.fill();

                // 2. Metallic Teleporter Base Platform
                ctx.fillStyle = '#1b0e27';
                ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

                ctx.strokeStyle = '#8e44ad';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

                // Corner Sci-fi Beacon Lights
                ctx.fillStyle = '#00cec9';
                ctx.fillRect(x + 3, y + 3, 2, 2);
                ctx.fillRect(x + TILE_SIZE - 5, y + 3, 2, 2);
                ctx.fillRect(x + 3, y + TILE_SIZE - 5, 2, 2);
                ctx.fillRect(x + TILE_SIZE - 5, y + TILE_SIZE - 5, 2, 2);

                // 3. Rotating Swirling Warp Vortex Rings
                ctx.translate(cx, cy);
                ctx.rotate(rot);

                ctx.strokeStyle = '#a29bfe';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.arc(0, 0, 9, 0, Math.PI * 1.4);
                ctx.stroke();

                ctx.strokeStyle = '#00cec9';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(0, 0, 5, Math.PI * 0.7, Math.PI * 2.1);
                ctx.stroke();

                ctx.restore();

                // 4. Bright Energy Core Focus
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx, cy, 2.5 + pulse * 1, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }
    }
}
