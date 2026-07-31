/* ==========================================================================
   PLAYER ENTITY MODULE (Jetman Physics & Actions)
   ========================================================================== */

import { TILE_SIZE, TILES } from '../world/tilemap.js';

export class Player {
    constructor(audioManager, tileMap) {
        this.audio = audioManager;
        this.tileMap = tileMap;

        this.width = 22;
        this.height = 28;

        this.x = 100;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;

        this.facingRight = true;
        this.isGrounded = false;
        this.isClimbing = false;
        this.isThrusting = false;
        this.isPhasing = false;

        this.fuel = 100; // Max 100%
        this.maxFuel = 100;
        this.fuelBurnRate = 18; // % per second

        this.score = 0;
        this.lives = 3;
        this.isDead = false;

        // Phase Shifter / Laser Beam properties
        this.phaseCooldown = 0;
        this.phaseBeamTimer = 0;
        this.phaseBeamLength = 160;

        // Visual animation frame, teleport cooldown & stuck timer
        this.animTimer = 0;
        this.stuckTimer = 0;
        this.teleportCooldown = 0;
    }

    spawn(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.isGrounded = false;
        this.isClimbing = false;
        this.isDead = false;
        this.isPhasing = false;
        this.phaseBeamTimer = 0;
        this.phaseCooldown = 0;
        this.stuckTimer = 0;
        this.teleportCooldown = 0;
        this.fuel = Math.max(this.fuel, 50); // Give minimum fuel on respawn
    }

    update(dt, input, enemyManager) {
        if (this.isDead) return;

        if (input.suicide) {
            this.takeDamage();
            return;
        }

        this.animTimer += dt;
        this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);
        this.phaseBeamTimer = Math.max(0, this.phaseBeamTimer - dt);
        this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);
        this.isPhasing = this.phaseBeamTimer > 0;

        // 1. Check current tile interaction (Climbing, Conveyor, Ice, Hazards)
        const centerCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
        const centerRow = Math.floor((this.y + this.height / 2) / TILE_SIZE);
        const feetRow = Math.floor((this.y + this.height + 1) / TILE_SIZE);

        const currentTile = this.tileMap.getTile(centerCol, centerRow);
        const feetTile = this.tileMap.getTile(centerCol, feetRow);

        const onLadder = this.tileMap.isClimbable(centerCol, centerRow);
        const onIce = feetTile === TILES.ICE;

        // Hazard check: Spikes or Energy Drain
        if (currentTile === TILES.SPIKE || feetTile === TILES.SPIKE) {
            if (this.audio.stopEnergyDrain) this.audio.stopEnergyDrain();
            this.takeDamage();
            return;
        }
        if (currentTile === TILES.ENERGY_DRAIN || feetTile === TILES.ENERGY_DRAIN) {
            this.fuel = Math.max(0, this.fuel - 40 * dt);
            if (this.audio.startEnergyDrain) this.audio.startEnergyDrain();
            if (Math.random() < 0.3) {
                const px = this.x + Math.random() * this.width;
                const py = this.y + Math.random() * this.height;
                this.tileMap.addSparkles(px, py, '#ff0055', 1);
            }
        } else {
            if (this.audio.stopEnergyDrain) this.audio.stopEnergyDrain();
        }

        // 2. Movement Logic: Walking & Facing Direction
        const accel = onIce ? 400 : 1200;
        const friction = onIce ? 0.96 : 0.82;
        const maxSpeed = 200;

        if (input.left) {
            this.vx -= accel * dt;
            this.facingRight = false;
        } else if (input.right) {
            this.vx += accel * dt;
            this.facingRight = true;
        } else {
            this.vx *= friction;
        }

        this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));

        // 3. Ladder Climbing Logic
        if (onLadder && (input.up || input.down)) {
            this.isClimbing = true;
        }
        if (!onLadder) {
            this.isClimbing = false;
        }

        if (this.isClimbing) {
            this.vy = 0;
            if (input.up) this.vy = -140;
            if (input.down) this.vy = 140;
            this.vx *= 0.5;
        }

        // 4. Jetpack Thrust Logic
        if (input.thrust && this.fuel > 0) {
            this.isClimbing = false;
            this.isThrusting = true;
            this.vy -= 1400 * dt; // Thrust acceleration upward
            this.fuel = Math.max(0, this.fuel - this.fuelBurnRate * dt);
            
            this.audio.startThrust();

            // Thrust particle effect
            const px = this.facingRight ? this.x + 2 : this.x + this.width - 2;
            const py = this.y + this.height - 4;
            this.tileMap.addSparkles(px, py, '#ff6600', 2);
        } else {
            this.isThrusting = false;
            this.audio.stopThrust();
        }

        // 5. Gravity Physics
        if (!this.isClimbing && !this.isGrounded) {
            this.vy += 950 * dt; // Gravity
        }
        this.vy = Math.min(450, this.vy); // Terminal velocity

        // 6. Phase Shifter / Laser Beam Firing Logic
        if (input.phase && this.phaseCooldown <= 0) {
            this.isPhasing = true;
            this.phaseBeamTimer = 0.14; // Visually persistent beam duration
            this.phaseCooldown = 0.12;  // Fire rate interval
            this.audio.playPhaseSound();

            // Check if player is currently standing inside a phase brick tile
            const playerCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
            const playerRow = Math.floor((this.y + this.height / 2) / TILE_SIZE);
            if (this.tileMap.getTile(playerCol, playerRow) === TILES.PHASE_BRICK) {
                this.tileMap.phaseTile(playerCol, playerRow);
            }

            const dir = this.facingRight ? 1 : -1;
            const startX = this.facingRight ? this.x + this.width : this.x;
            const startY = this.y + 12;

            // Muzzle flash particles
            this.tileMap.addSparkles(startX, startY, '#00f0ff', 6);

            // Raycast forward up to 5 tiles (160 px)
            this.phaseBeamLength = 160;
            for (let dist = 0; dist <= 160; dist += 8) {
                const targetX = startX + dir * dist;
                const targetCol = Math.floor(targetX / TILE_SIZE);
                const targetRow = Math.floor(startY / TILE_SIZE);

                // Check Enemy Hits along laser beam path
                if (enemyManager && enemyManager.enemies) {
                    let hitEnemyIndex = -1;
                    for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
                        const enemy = enemyManager.enemies[i];
                        if (
                            targetX >= enemy.x && targetX <= enemy.x + enemy.width &&
                            startY >= enemy.y && startY <= enemy.y + enemy.height
                        ) {
                            hitEnemyIndex = i;
                            break;
                        }
                    }
                    if (hitEnemyIndex >= 0) {
                        const enemy = enemyManager.enemies[hitEnemyIndex];
                        this.tileMap.addSparkles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff0055', 25);
                        this.audio.playExplosion();
                        this.score += 200;
                        enemyManager.enemies.splice(hitEnemyIndex, 1);
                        this.phaseBeamLength = dist;
                        break;
                    }
                }

                const t = this.tileMap.getTile(targetCol, targetRow);
                if (t === TILES.PHASE_BRICK) {
                    this.tileMap.phaseTile(targetCol, targetRow);
                    this.phaseBeamLength = dist;
                    break;
                } else if (this.tileMap.isSolid(targetCol, targetRow)) {
                    this.phaseBeamLength = dist;
                    this.tileMap.addSparkles(targetX, startY, '#00f0ff', 4);
                    break;
                }
            }
        }

        // 7. Apply Positions & Handle Collision
        this.moveAndCollide(dt);

        // 8. Collectible Item Pickup Collision
        this.checkCollectibles();

        // 9. Teleporter Interaction (Warp to next Teleporter node)
        this.checkTeleporter();

        // 10. Trapped / Stuck Detection (No fuel in inescapable pit)
        this.checkStuck(dt);
    }

    moveAndCollide(dt) {
        const CORNER_NUDGE_SLOP = 8; // Max pixel overlap to automatically nudge into gaps/corridors
        const FOOT_INSET = 5; // Pixel inset from left/right edges for ground stance & hole falling

        // Horizontal Movement
        this.x += this.vx * dt;
        let colLeft = Math.floor(this.x / TILE_SIZE);
        let colRight = Math.floor((this.x + this.width) / TILE_SIZE);
        let rowTop = Math.floor(this.y / TILE_SIZE);
        let rowBottom = Math.floor((this.y + this.height - 1) / TILE_SIZE);

        if (this.vx < 0) { // Moving Left
            const solidTop = this.tileMap.isSolid(colLeft, rowTop);
            const solidBottom = this.tileMap.isSolid(colLeft, rowBottom);

            if (solidTop && !solidBottom) {
                // Clipping ceiling corner while entering a lower corridor
                const overlapTop = (rowTop + 1) * TILE_SIZE - this.y;
                if (overlapTop <= CORNER_NUDGE_SLOP) {
                    const newY = this.y + overlapTop;
                    const newRowBottom = Math.floor((newY + this.height - 1) / TILE_SIZE);
                    if (!this.tileMap.isSolid(colLeft, newRowBottom)) {
                        this.y = newY; // Nudge downward into opening
                        this.vy = Math.max(0, this.vy); // Kill upward velocity to prevent re-clipping ceiling
                        rowTop = Math.floor(this.y / TILE_SIZE);
                        rowBottom = newRowBottom;
                    }
                }
            } else if (!solidTop && solidBottom) {
                // Clipping floor corner while entering an upper corridor
                const overlapBottom = (this.y + this.height) - rowBottom * TILE_SIZE;
                if (overlapBottom <= CORNER_NUDGE_SLOP) {
                    const newY = this.y - overlapBottom;
                    const newRowTop = Math.floor(newY / TILE_SIZE);
                    if (!this.tileMap.isSolid(colLeft, newRowTop)) {
                        this.y = newY; // Nudge upward into opening
                        rowTop = newRowTop;
                        rowBottom = Math.floor((this.y + this.height - 1) / TILE_SIZE);
                    }
                }
            }

            // Re-evaluate left collision after corner nudge attempt
            if (this.tileMap.isSolid(colLeft, rowTop) || this.tileMap.isSolid(colLeft, rowBottom)) {
                this.x = (colLeft + 1) * TILE_SIZE;
                this.vx = 0;
            }
        } else if (this.vx > 0) { // Moving Right
            const solidTop = this.tileMap.isSolid(colRight, rowTop);
            const solidBottom = this.tileMap.isSolid(colRight, rowBottom);

            if (solidTop && !solidBottom) {
                // Clipping ceiling corner while entering a lower corridor
                const overlapTop = (rowTop + 1) * TILE_SIZE - this.y;
                if (overlapTop <= CORNER_NUDGE_SLOP) {
                    const newY = this.y + overlapTop;
                    const newRowBottom = Math.floor((newY + this.height - 1) / TILE_SIZE);
                    if (!this.tileMap.isSolid(colRight, newRowBottom)) {
                        this.y = newY; // Nudge downward into opening
                        this.vy = Math.max(0, this.vy); // Kill upward velocity to prevent re-clipping ceiling
                        rowTop = Math.floor(this.y / TILE_SIZE);
                        rowBottom = newRowBottom;
                    }
                }
            } else if (!solidTop && solidBottom) {
                // Clipping floor corner while entering an upper corridor
                const overlapBottom = (this.y + this.height) - rowBottom * TILE_SIZE;
                if (overlapBottom <= CORNER_NUDGE_SLOP) {
                    const newY = this.y - overlapBottom;
                    const newRowTop = Math.floor(newY / TILE_SIZE);
                    if (!this.tileMap.isSolid(colRight, newRowTop)) {
                        this.y = newY; // Nudge upward into opening
                        rowTop = newRowTop;
                        rowBottom = Math.floor((this.y + this.height - 1) / TILE_SIZE);
                    }
                }
            }

            // Re-evaluate right collision after corner nudge attempt
            if (this.tileMap.isSolid(colRight, rowTop) || this.tileMap.isSolid(colRight, rowBottom)) {
                this.x = colRight * TILE_SIZE - this.width;
                this.vx = 0;
            }
        }

        // Vertical Movement
        this.y += this.vy * dt;
        colLeft = Math.floor(this.x / TILE_SIZE);
        colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
        rowTop = Math.floor(this.y / TILE_SIZE);
        rowBottom = Math.floor((this.y + this.height) / TILE_SIZE);

        this.isGrounded = false;

        if (this.vy < 0) { // Moving Up
            const solidLeft = this.tileMap.isSolid(colLeft, rowTop);
            const solidRight = this.tileMap.isSolid(colRight, rowTop);

            if (solidLeft && !solidRight) {
                // Left shoulder clips ceiling corner while flying up into vertical shaft
                const overlapLeft = (colLeft + 1) * TILE_SIZE - this.x;
                if (overlapLeft <= CORNER_NUDGE_SLOP) {
                    const newX = this.x + overlapLeft;
                    const newColRight = Math.floor((newX + this.width - 1) / TILE_SIZE);
                    if (!this.tileMap.isSolid(newColRight, rowTop)) {
                        this.x = newX; // Nudge right into vertical shaft
                        this.vx = Math.max(0, this.vx); // Kill opposing leftward velocity
                        colLeft = Math.floor(this.x / TILE_SIZE);
                        colRight = newColRight;
                    }
                }
            } else if (!solidLeft && solidRight) {
                // Right shoulder clips ceiling corner while flying up into vertical shaft
                const overlapRight = (this.x + this.width) - colRight * TILE_SIZE;
                if (overlapRight <= CORNER_NUDGE_SLOP) {
                    const newX = this.x - overlapRight;
                    const newColLeft = Math.floor(newX / TILE_SIZE);
                    if (!this.tileMap.isSolid(newColLeft, rowTop)) {
                        this.x = newX; // Nudge left into vertical shaft
                        this.vx = Math.min(0, this.vx); // Kill opposing rightward velocity
                        colLeft = newColLeft;
                        colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
                    }
                }
            }

            if (this.tileMap.isSolid(colLeft, rowTop) || this.tileMap.isSolid(colRight, rowTop)) {
                this.y = (rowTop + 1) * TILE_SIZE;
                this.vy = 0;
            }
        } else if (this.vy >= 0) { // Moving Down / Gravity
            // Use foot inset so walking off a ledge into a hole drops the player cleanly
            const footLeftCol = Math.floor((this.x + FOOT_INSET) / TILE_SIZE);
            const footRightCol = Math.floor((this.x + this.width - FOOT_INSET) / TILE_SIZE);
            const solidLeft = this.tileMap.isSolid(footLeftCol, rowBottom);
            const solidRight = this.tileMap.isSolid(footRightCol, rowBottom);

            if (solidLeft && !solidRight && this.vx > 0) {
                // Moving right off a ledge into a hole: nudge X slightly right so trailing heel clears corner
                const overlapLeft = (footLeftCol + 1) * TILE_SIZE - (this.x + FOOT_INSET);
                if (overlapLeft <= CORNER_NUDGE_SLOP) {
                    const newX = this.x + overlapLeft;
                    const newFootLeftCol = Math.floor((newX + FOOT_INSET) / TILE_SIZE);
                    if (!this.tileMap.isSolid(newFootLeftCol, rowBottom)) {
                        this.x = newX;
                        colLeft = Math.floor(this.x / TILE_SIZE);
                        colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
                    }
                }
            } else if (!solidLeft && solidRight && this.vx < 0) {
                // Moving left off a ledge into a hole: nudge X slightly left so trailing heel clears corner
                const overlapRight = (this.x + this.width - FOOT_INSET) - footRightCol * TILE_SIZE;
                if (overlapRight <= CORNER_NUDGE_SLOP) {
                    const newX = this.x - overlapRight;
                    const newFootRightCol = Math.floor((newX + this.width - FOOT_INSET) / TILE_SIZE);
                    if (!this.tileMap.isSolid(newFootRightCol, rowBottom)) {
                        this.x = newX;
                        colLeft = Math.floor(this.x / TILE_SIZE);
                        colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
                    }
                }
            }

            // Check ground collision using foot inset
            const isGroundedLeft = this.tileMap.isSolid(Math.floor((this.x + FOOT_INSET) / TILE_SIZE), rowBottom);
            const isGroundedRight = this.tileMap.isSolid(Math.floor((this.x + this.width - FOOT_INSET) / TILE_SIZE), rowBottom);

            if (isGroundedLeft || isGroundedRight) {
                this.y = rowBottom * TILE_SIZE - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }
        }

        // Conveyor belt force
        const feetTile = this.tileMap.getTile(Math.floor((this.x + this.width / 2) / TILE_SIZE), rowBottom);
        if (this.isGrounded) {
            if (feetTile === TILES.CONVEYOR_LEFT) this.x -= 120 * dt;
            if (feetTile === TILES.CONVEYOR_RIGHT) this.x += 120 * dt;
        }

        // Screen Boundaries
        this.x = Math.max(0, Math.min(this.tileMap.cols * TILE_SIZE - this.width, this.x));
        this.y = Math.max(0, Math.min(this.tileMap.rows * TILE_SIZE - this.height, this.y));
    }

    checkCollectibles() {
        const leftCol = Math.floor(this.x / TILE_SIZE);
        const rightCol = Math.floor((this.x + this.width) / TILE_SIZE);
        const topRow = Math.floor(this.y / TILE_SIZE);
        const bottomRow = Math.floor((this.y + this.height - 1) / TILE_SIZE);

        for (let col = leftCol; col <= rightCol; col++) {
            for (let row = topRow; row <= bottomRow; row++) {
                const tile = this.tileMap.getTile(col, row);

                if (tile === TILES.EMERALD) {
                    this.tileMap.setTile(col, row, TILES.AIR);
                    this.tileMap.collectedEmeralds++;
                    this.score += 250;
                    const isAllCaught = this.tileMap.collectedEmeralds === 4 ||
                        (this.tileMap.totalEmeralds > 0 && this.tileMap.collectedEmeralds === this.tileMap.totalEmeralds);
                    if (isAllCaught) {
                        this.audio.playAllDiamondsCaught();
                        this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#00ff77', 25);
                        this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#ffd700', 25);
                    } else {
                        this.audio.playEmeraldPickup();
                        this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#00ff77', 12);
                    }
                } else if (tile === TILES.FUEL) {
                    this.tileMap.setTile(col, row, TILES.AIR);
                    this.fuel = Math.min(this.maxFuel, this.fuel + 50);
                    this.score += 50;
                    this.audio.playFuelPickup();
                    this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#ffaa00', 14);
                    this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#ffee55', 10);
                    this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#ffffff', 6);
                } else if (tile === TILES.GOLD) {
                    this.tileMap.setTile(col, row, TILES.AIR);
                    this.score += 500;
                    this.audio.playEmeraldPickup();
                    this.tileMap.addSparkles(col * TILE_SIZE + 16, row * TILE_SIZE + 16, '#f1c40f', 10);
                }
            }
        }
    }

    checkTeleporter() {
        if (this.teleportCooldown > 0) return;
        if (!this.tileMap.teleporters || this.tileMap.teleporters.length < 2) return;

        const leftCol = Math.floor(this.x / TILE_SIZE);
        const rightCol = Math.floor((this.x + this.width) / TILE_SIZE);
        const topRow = Math.floor(this.y / TILE_SIZE);
        // Include +2px below feet so standing on top of a teleporter tile detects it immediately
        const bottomRow = Math.floor((this.y + this.height + 2) / TILE_SIZE);

        for (let col = leftCol; col <= rightCol; col++) {
            for (let row = topRow; row <= bottomRow; row++) {
                const tile = this.tileMap.getTile(col, row);
                if (tile === TILES.TELEPORTER) {
                    const tileIndex = row * this.tileMap.cols + col;
                    const currentPadIdx = this.tileMap.teleporters.findIndex(pad => pad.tiles.includes(tileIndex));
                    
                    if (currentPadIdx !== -1) {
                        const nextPadIdx = (currentPadIdx + 1) % this.tileMap.teleporters.length;
                        const targetPad = this.tileMap.teleporters[nextPadIdx];

                        const startX = this.x + this.width / 2;
                        const startY = this.y + this.height / 2;

                        // Departure particle burst
                        this.tileMap.addSparkles(startX, startY, '#9b59b6', 22);
                        this.tileMap.addSparkles(startX, startY, '#00cec9', 18);

                        // Warp player position to center of target pad
                        this.x = targetPad.x + (TILE_SIZE - this.width) / 2;
                        this.y = targetPad.y + (TILE_SIZE - this.height) / 2;
                        this.vy = Math.min(0, this.vy); // Dampen downward momentum

                        const destX = this.x + this.width / 2;
                        const destY = this.y + this.height / 2;

                        // Arrival particle burst
                        this.tileMap.addSparkles(destX, destY, '#a29bfe', 22);
                        this.tileMap.addSparkles(destX, destY, '#ffffff', 18);

                        // Play teleport sound effect
                        this.audio.playTeleport();

                        // 0.6s cooldown to allow smooth departure/arrival without instant re-warp
                        this.teleportCooldown = 0.6;
                        return;
                    }
                }
            }
        }
    }

    takeDamage() {
        if (this.isDead) return;
        this.isDead = true;
        this.lives--;
        this.stuckTimer = 0;
        if (this.audio.stopThrust) this.audio.stopThrust();
        if (this.audio.stopEnergyDrain) this.audio.stopEnergyDrain();
        this.audio.playExplosion();
        this.tileMap.addSparkles(this.x + 11, this.y + 14, '#ff0055', 25);
    }

    checkStuck(dt) {
        if (this.isDead) return;

        // Player can only be stuck if they have low fuel (< 1.0%) and are not thrusting
        if (this.fuel >= 1.0 || this.isThrusting) {
            this.stuckTimer = 0;
            return;
        }

        // Must be grounded or climbing or sitting still (not falling rapidly)
        if (!this.isGrounded && !this.isClimbing && Math.abs(this.vy) > 15) {
            this.stuckTimer = 0;
            return;
        }

        const startCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
        const startRow = Math.floor((this.y + this.height - 4) / TILE_SIZE);

        let canEscape = false;
        const queue = [{ col: startCol, row: startRow }];
        const visited = new Set();
        visited.add(`${startCol},${startRow}`);

        let steps = 0;
        const maxSteps = 150; // Deep search through walkable/climbable areas

        while (queue.length > 0 && steps < maxSteps) {
            steps++;
            const { col, row } = queue.shift();
            const tile = this.tileMap.getTile(col, row);

            // Escape condition 1: Reachable fuel canister
            if (tile === TILES.FUEL) {
                canEscape = true;
                break;
            }

            // Escape condition 2: Reachable teleporter
            if (tile === TILES.TELEPORTER) {
                canEscape = true;
                break;
            }

            // Escape condition 3: Reachable active exit portal
            if (tile === TILES.EXIT_PORTAL && this.tileMap.collectedEmeralds >= this.tileMap.totalEmeralds) {
                canEscape = true;
                break;
            }

            // Escape condition 4: Reachable phase brick (can be destroyed by laser to create path)
            if (tile === TILES.PHASE_BRICK) {
                canEscape = true;
                break;
            }

            const isCurrentClimbable = this.tileMap.isClimbable(col, row);

            // 1. Move Up (only possible if current or target tile is a ladder/vine)
            const upRow = row - 1;
            if (upRow >= 0) {
                const isUpClimbable = this.tileMap.isClimbable(col, upRow);
                if ((isCurrentClimbable || isUpClimbable) && !this.tileMap.isSolid(col, upRow)) {
                    const key = `${col},${upRow}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({ col, row: upRow });
                    }
                }
            }

            // 2. Move Down (climbing down or dropping down)
            const downRow = row + 1;
            if (downRow < this.tileMap.rows) {
                if (!this.tileMap.isSolid(col, downRow)) {
                    // Fall down to solid ground or climbable tile
                    let fallRow = downRow;
                    while (fallRow < this.tileMap.rows - 1 && 
                           !this.tileMap.isSolid(col, fallRow + 1) && 
                           !this.tileMap.isClimbable(col, fallRow)) {
                        fallRow++;
                    }
                    const key = `${col},${fallRow}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({ col, row: fallRow });
                    }
                }
            }

            // 3. Move Left & Right (walking)
            for (const dc of [-1, 1]) {
                const nextCol = col + dc;
                if (nextCol < 0 || nextCol >= this.tileMap.cols) continue;

                if (this.tileMap.isSolid(nextCol, row)) {
                    // Check if solid tile is a phase brick (player can shoot laser at it)
                    if (this.tileMap.getTile(nextCol, row) === TILES.PHASE_BRICK) {
                        canEscape = true;
                        break;
                    }
                    continue;
                }

                // If space next to us is clear, simulate walking/falling into it
                let walkRow = row;
                if (!this.tileMap.isSolid(nextCol, walkRow + 1) && !this.tileMap.isClimbable(nextCol, walkRow)) {
                    while (walkRow < this.tileMap.rows - 1 && 
                           !this.tileMap.isSolid(nextCol, walkRow + 1) && 
                           !this.tileMap.isClimbable(nextCol, walkRow)) {
                        walkRow++;
                    }
                }

                const key = `${nextCol},${walkRow}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push({ col: nextCol, row: walkRow });
                }
            }

            if (canEscape) break;
        }

        if (!canEscape) {
            this.stuckTimer += dt;
            // Emit red warning sparkles while trapped
            if (Math.random() < 0.5) {
                this.tileMap.addSparkles(this.x + 11, this.y + 14, '#ff0055', 4);
            }
            // Kill player after 0.8 seconds of being trapped without fuel
            if (this.stuckTimer >= 0.8) {
                this.takeDamage();
            }
        } else {
            this.stuckTimer = 0;
        }
    }

    render(ctx) {
        if (this.isDead) return;

        ctx.save();

        // Draw Jetman Character Sprite (Canvas Vector Graphics)
        const px = this.x;
        const py = this.y;

        // Jetpack Unit on back
        ctx.fillStyle = '#7f8c8d';
        const packX = this.facingRight ? px - 4 : px + this.width - 2;
        ctx.fillRect(packX, py + 6, 6, 16);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(packX + 1, py + 8, 4, 4);

        // Main Body Suit
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(px + 4, py + 8, 14, 14);

        // Head Helmet
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(px + 11, py + 6, 7, 0, Math.PI * 2);
        ctx.fill();

        // Helmet Visor
        ctx.fillStyle = '#3498db';
        const visorX = this.facingRight ? px + 11 : px + 5;
        ctx.fillRect(visorX, py + 3, 6, 5);

        // Legs (Animate walking legs when moving on ground; keep static when flying, falling, or standing still)
        const isMovingOnGround = this.isGrounded && !this.isThrusting && !this.isClimbing && Math.abs(this.vx) > 5;
        
        let strideX = 0;
        let liftY1 = 0;
        let liftY2 = 0;

        if (isMovingOnGround) {
            const speedRatio = Math.min(1.5, Math.abs(this.vx) / 100);
            const walkSpeed = 14 * Math.max(0.5, speedRatio);
            const legSwing = Math.sin(this.animTimer * walkSpeed);
            strideX = legSwing * 3.5;
            liftY1 = Math.max(0, legSwing) * 2;
            liftY2 = Math.max(0, -legSwing) * 2;
        }

        // Back Leg (Light slate blue for depth and high visibility)
        ctx.fillStyle = '#3b82f6';
        const leg1X = px + 4 + strideX;
        const leg1Height = 6 - liftY1;
        ctx.fillRect(leg1X, py + 22, 5, leg1Height);
        // Back Boot
        ctx.fillStyle = '#1d4ed8';
        const boot1X = this.facingRight ? leg1X : leg1X - 1;
        ctx.fillRect(boot1X, py + 22 + leg1Height - 2, 6, 2);

        // Front Leg (Bright sky blue for maximum visibility)
        ctx.fillStyle = '#60a5fa';
        const leg2X = px + 13 - strideX;
        const leg2Height = 6 - liftY2;
        ctx.fillRect(leg2X, py + 22, 5, leg2Height);
        // Front Boot
        ctx.fillStyle = '#2563eb';
        const boot2X = this.facingRight ? leg2X : leg2X - 1;
        ctx.fillRect(boot2X, py + 22 + leg2Height - 2, 6, 2);

        // Phase Beam Laser Shot Rendering
        if (this.isPhasing) {
            const beamStartX = this.facingRight ? px + this.width : px;
            const beamStartY = py + 12;
            const beamEndX = this.facingRight ? beamStartX + this.phaseBeamLength : beamStartX - this.phaseBeamLength;

            // Outer Neon Laser Glow (Multi-layer stroke vector alternative to CPU shadowBlur)
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(beamStartX, beamStartY);
            ctx.lineTo(beamEndX, beamStartY);
            ctx.stroke();

            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(beamStartX, beamStartY);
            ctx.lineTo(beamEndX, beamStartY);
            ctx.stroke();

            // Inner Bright Core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(beamStartX, beamStartY);
            ctx.lineTo(beamEndX, beamStartY);
            ctx.stroke();

            // Muzzle Flash
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(beamStartX, beamStartY, 4, 0, Math.PI * 2);
            ctx.fill();

            // Beam Impact Point Pulse
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(beamEndX, beamStartY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(beamEndX, beamStartY, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
