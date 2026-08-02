/* ==========================================================================
   ENEMY AI MODULE (Flitzers, Homing Missiles, Turrets)
   ========================================================================== */

import { TILE_SIZE, TileMap } from '../world/tilemap.js';

export const ENEMY_TYPES = {
    FLITZER: 'flitzer',
    HOMING_MISSILE: 'homing_missile',
    TURRET: 'turret'
} as const;

export interface Enemy {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    vx?: number;
    vy?: number;
    speed?: number;
    timer?: number;
    fireInterval?: number;
    animTimer?: number;
    targetX?: number;
    targetY?: number;
    dead?: boolean;
}

export interface Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    life: number;
}

export class EnemyManager {
    tileMap: TileMap;
    enemies: Enemy[];
    projectiles: Projectile[];
    nextEnemyId: number;
    onEnemyDestroyed: ((data: { enemyId: string; playerId: string }) => void) | null;

    constructor(tileMap: any) {
        this.tileMap = tileMap;
        this.enemies = [];
        this.projectiles = [];
        this.nextEnemyId = 0;
        this.onEnemyDestroyed = null;
    }

    clear(): void {
        this.enemies = [];
        this.projectiles = [];
        this.nextEnemyId = 0;
    }

    allocateEnemyId(explicitId: string | null = null): string {
        return explicitId ?? `enemy_${this.nextEnemyId++}`;
    }

    addFlitzer(x: number, y: number, vx: number = 100, vy: number = 100, id: string | null = null): void {
        this.enemies.push({
            id: this.allocateEnemyId(id),
            type: ENEMY_TYPES.FLITZER,
            x,
            y,
            width: 20,
            height: 20,
            vx,
            vy,
            animTimer: Math.random() * 10
        });
    }

    addHomingMissile(x: number, y: number, id: string | null = null): void {
        this.enemies.push({
            id: this.allocateEnemyId(id),
            type: ENEMY_TYPES.HOMING_MISSILE,
            x,
            y,
            width: 16,
            height: 16,
            vx: 0,
            vy: 0,
            speed: 90
        });
    }

    addTurret(x: number, y: number, fireInterval: number = 2.0, id: string | null = null): void {
        this.enemies.push({
            id: this.allocateEnemyId(id),
            type: ENEMY_TYPES.TURRET,
            x,
            y,
            width: 24,
            height: 24,
            timer: 0,
            fireInterval
        });
    }

    removeEnemyById(enemyId: string): Enemy | null {
        const index = this.enemies.findIndex(enemy => enemy.id === enemyId);
        if (index === -1) {
            return null;
        }
        return this.enemies.splice(index, 1)[0];
    }

    getClosestPlayer(enemy: Enemy, playerInput: any): any {
        if (!playerInput) return null;
        let playersList: any[] = [];
        if (Array.isArray(playerInput)) {
            playersList = playerInput;
        } else if (playerInput instanceof Map) {
            playersList = Array.from(playerInput.values());
        } else if (playerInput.x !== undefined) {
            playersList = [playerInput];
        }

        let closest: any = null;
        let minDistSq = Infinity;
        const ex = enemy.x + enemy.width / 2;
        const ey = enemy.y + enemy.height / 2;

        for (const p of playersList) {
            if (!p || p.isDead) continue;
            const px = p.x + p.width / 2;
            const py = p.y + p.height / 2;
            const distSq = (px - ex) * (px - ex) + (py - ey) * (py - ey);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = p;
            }
        }
        return closest;
    }

    getLivingPlayers(playerInput: any): any[] {
        if (!playerInput) return [];
        if (Array.isArray(playerInput)) {
            return playerInput.filter(p => p && !p.isDead && (p.respawnInvulnerability || 0) <= 0);
        } else if (playerInput instanceof Map) {
            return Array.from(playerInput.values()).filter((p: any) => p && !p.isDead && (p.respawnInvulnerability || 0) <= 0);
        } else if (playerInput && playerInput.x !== undefined && !playerInput.isDead && (playerInput.respawnInvulnerability || 0) <= 0) {
            return [playerInput];
        }
        return [];
    }

    serializeEnemies(): any[] {
        return this.enemies.map(e => [
            e.id,
            e.type,
            Math.round(e.x * 100) / 100,
            Math.round(e.y * 100) / 100,
            Math.round((e.vx || 0) * 100) / 100,
            Math.round((e.vy || 0) * 100) / 100,
            Math.round((e.animTimer || 0) * 100) / 100,
            Math.round((e.timer || 0) * 100) / 100,
            e.fireInterval
        ]);
    }

    serializeProjectiles(): any[] {
        return this.projectiles.map(p => [
            Math.round(p.x * 100) / 100,
            Math.round(p.y * 100) / 100,
            Math.round(p.vx * 100) / 100,
            Math.round(p.vy * 100) / 100,
            p.radius,
            p.life
        ]);
    }

    applyEnemySnapshot(snapshotEnemies: any, snapshotProjectiles: any): void {
        if (!Array.isArray(snapshotEnemies)) return;
        const parsedEnemies = snapshotEnemies.map(e => Array.isArray(e) ? {
            id: e[0], type: e[1], x: e[2], y: e[3], vx: e[4], vy: e[5], animTimer: e[6], timer: e[7], fireInterval: e[8]
        } : e);

        const serverIds = new Set(parsedEnemies.map(e => e.id));

        for (const sEnemy of parsedEnemies) {
            let localEnemy = this.enemies.find(e => e.id === sEnemy.id);
            if (!localEnemy) {
                if (sEnemy.type === ENEMY_TYPES.FLITZER) {
                    this.addFlitzer(sEnemy.x, sEnemy.y, sEnemy.vx, sEnemy.vy, sEnemy.id);
                } else if (sEnemy.type === ENEMY_TYPES.HOMING_MISSILE) {
                    this.addHomingMissile(sEnemy.x, sEnemy.y, sEnemy.id);
                } else if (sEnemy.type === ENEMY_TYPES.TURRET) {
                    this.addTurret(sEnemy.x, sEnemy.y, sEnemy.fireInterval || 2.0, sEnemy.id);
                }
                localEnemy = this.enemies.find(e => e.id === sEnemy.id);
            }

            if (localEnemy) {
                localEnemy.targetX = sEnemy.x;
                localEnemy.targetY = sEnemy.y;
                localEnemy.vx = sEnemy.vx;
                localEnemy.vy = sEnemy.vy;
                if (sEnemy.timer !== undefined) localEnemy.timer = sEnemy.timer;
                if (sEnemy.animTimer !== undefined) {
                    if (localEnemy.animTimer === undefined || Math.abs(localEnemy.animTimer - sEnemy.animTimer) > 0.5) {
                        localEnemy.animTimer = sEnemy.animTimer;
                    }
                }
            }
        }

        this.enemies = this.enemies.filter(e => serverIds.has(e.id));

        if (Array.isArray(snapshotProjectiles)) {
            this.projectiles = snapshotProjectiles.map(p => Array.isArray(p) ? {
                x: p[0], y: p[1], vx: p[2], vy: p[3], radius: p[4], life: p[5]
            } : p);
        }
    }

    interpolateEnemies(dt: number): void {
        for (const enemy of this.enemies) {
            enemy.animTimer = (enemy.animTimer || 0) + dt;
            if (enemy.targetX !== undefined && enemy.targetY !== undefined) {
                const dx = enemy.targetX - enemy.x;
                const dy = enemy.targetY - enemy.y;
                if (dx * dx + dy * dy > 4096) {
                    enemy.x = enemy.targetX;
                    enemy.y = enemy.targetY;
                } else {
                    enemy.x += dx * Math.min(1, dt * 15);
                    enemy.y += dy * Math.min(1, dt * 15);
                }
            }
        }
    }

    update(dt: number, player: any): void {
        const livingPlayers = this.getLivingPlayers(player);

        for (let enemy of this.enemies) {
            enemy.animTimer = (enemy.animTimer || 0) + dt;

            if (enemy.type === ENEMY_TYPES.FLITZER) {
                enemy.x += (enemy.vx || 0) * dt;
                enemy.y += (enemy.vy || 0) * dt;

                const colLeft = Math.floor(enemy.x / TILE_SIZE);
                const colRight = Math.floor((enemy.x + enemy.width) / TILE_SIZE);
                const rowTop = Math.floor(enemy.y / TILE_SIZE);
                const rowBottom = Math.floor((enemy.y + enemy.height) / TILE_SIZE);

                if (this.tileMap.isSolid(colLeft, rowTop) || this.tileMap.isSolid(colRight, rowTop) ||
                    this.tileMap.isSolid(colLeft, rowBottom) || this.tileMap.isSolid(colRight, rowBottom) ||
                    enemy.x <= 0 || enemy.x + enemy.width >= this.tileMap.cols * TILE_SIZE) {
                    enemy.vx = (enemy.vx || 0) * -1;
                }
                if (enemy.y <= 0 || enemy.y + enemy.height >= this.tileMap.rows * TILE_SIZE) {
                    enemy.vy = (enemy.vy || 0) * -1;
                }

                if (Math.random() < 0.35 && this.tileMap && this.tileMap.addSparkles) {
                    this.tileMap.addSparkles(
                        enemy.x + 10 + (Math.random() * 6 - 3),
                        enemy.y + 10 + (Math.random() * 6 - 3),
                        '#ff0055',
                        1
                    );
                }
            } else if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
                const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
                if (targetPlayer) {
                    const dx = (targetPlayer.x + targetPlayer.width / 2) - (enemy.x + enemy.width / 2);
                    const dy = (targetPlayer.y + targetPlayer.height / 2) - (enemy.y + enemy.height / 2);
                    const angle = Math.atan2(dy, dx);

                    enemy.vx = Math.cos(angle) * (enemy.speed || 90);
                    enemy.vy = Math.sin(angle) * (enemy.speed || 90);
                }

                enemy.x += (enemy.vx || 0) * dt;
                enemy.y += (enemy.vy || 0) * dt;

                if (Math.random() < 0.5 && this.tileMap && this.tileMap.addSparkles) {
                    this.tileMap.addSparkles(
                        enemy.x + 8 - (enemy.vx || 0) * 0.05,
                        enemy.y + 8 - (enemy.vy || 0) * 0.05,
                        '#ff5500',
                        1
                    );
                }
            } else if (enemy.type === ENEMY_TYPES.TURRET) {
                enemy.timer = (enemy.timer || 0) + dt;
                const targetPlayer = this.getClosestPlayer(enemy, livingPlayers);
                if (enemy.timer >= (enemy.fireInterval || 2.0) && targetPlayer) {
                    enemy.timer = 0;
                    const dx = (targetPlayer.x + targetPlayer.width / 2) - (enemy.x + enemy.width / 2);
                    const dy = (targetPlayer.y + targetPlayer.height / 2) - (enemy.y + enemy.height / 2);
                    const angle = Math.atan2(dy, dx);

                    this.projectiles.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y + enemy.height / 2,
                        vx: Math.cos(angle) * 220,
                        vy: Math.sin(angle) * 220,
                        radius: 5,
                        life: 3.5
                    });
                }
            }

            for (const p of livingPlayers) {
                if (this.checkAABB(enemy, p)) {
                    p.takeDamage();

                    if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
                        enemy.dead = true;
                        if (this.tileMap && this.tileMap.addSparkles) {
                            for (let s = 0; s < 8; s++) {
                                this.tileMap.addSparkles(
                                    enemy.x + enemy.width / 2 + (Math.random() * 16 - 8),
                                    enemy.y + enemy.height / 2 + (Math.random() * 16 - 8),
                                    '#ff5500',
                                    2
                                );
                            }
                        }
                    }
                    break;
                }
            }
        }

        this.enemies = this.enemies.filter(e => !e.dead);

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            if (Math.random() < 0.3 && this.tileMap && this.tileMap.addSparkles) {
                this.tileMap.addSparkles(p.x, p.y, '#ff0055', 1);
            }

            for (const targetPlayer of livingPlayers) {
                const dx = p.x - (targetPlayer.x + targetPlayer.width / 2);
                const dy = p.y - (targetPlayer.y + targetPlayer.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) < p.radius + 10) {
                    targetPlayer.takeDamage();
                    p.life = 0;
                    break;
                }
            }

            const col = Math.floor(p.x / TILE_SIZE);
            const row = Math.floor(p.y / TILE_SIZE);
            if (this.tileMap.isSolid(col, row) || p.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    checkAABB(rect1: any, rect2: any): boolean {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    render(ctx: CanvasRenderingContext2D, player: any = null): void {
        for (let enemy of this.enemies) {
            ctx.save();
            if (enemy.type === ENEMY_TYPES.FLITZER) {
                this.renderFlitzer(ctx, enemy, player);
            } else if (enemy.type === ENEMY_TYPES.HOMING_MISSILE) {
                this.renderHomingMissile(ctx, enemy);
            } else if (enemy.type === ENEMY_TYPES.TURRET) {
                this.renderTurret(ctx, enemy, player);
            }
            ctx.restore();
        }

        for (let p of this.projectiles) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 85, 0.35)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff0055';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    renderFlitzer(ctx: CanvasRenderingContext2D, enemy: Enemy, player: any): void {
        const cx = enemy.x + enemy.width / 2;
        const cy = enemy.y + enemy.height / 2;
        const moveAngle = Math.atan2(enemy.vy || 0, enemy.vx || 0);
        const animTimer = enemy.animTimer || 0;

        const auraRad = 15 + Math.sin(animTimer * 10) * 3;
        const auraGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, auraRad);
        auraGrad.addColorStop(0, 'rgba(255, 0, 85, 0.85)');
        auraGrad.addColorStop(0.5, 'rgba(180, 0, 50, 0.4)');
        auraGrad.addColorStop(1, 'rgba(100, 0, 30, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, auraRad, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(cx, cy);

        const spikeCount = 8;
        const rotAngle = animTimer * 4;
        ctx.save();
        ctx.rotate(rotAngle);
        for (let i = 0; i < spikeCount; i++) {
            const a = (i * Math.PI * 2) / spikeCount;
            const spikeLen = 13 + Math.sin(animTimer * 12 + i * 1.5) * 3;
            const innerR = 6;

            ctx.beginPath();
            ctx.moveTo(Math.cos(a - 0.3) * innerR, Math.sin(a - 0.3) * innerR);
            ctx.lineTo(Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
            ctx.lineTo(Math.cos(a + 0.3) * innerR, Math.sin(a + 0.3) * innerR);

            ctx.fillStyle = '#ff0033';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
        ctx.restore();

        const hullGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 9);
        hullGrad.addColorStop(0, '#3a0614');
        hullGrad.addColorStop(0.7, '#150208');
        hullGrad.addColorStop(1, '#050002');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const jawOpen = Math.sin(animTimer * 14) * 2;
        ctx.fillStyle = '#ffeef2';
        ctx.beginPath();
        ctx.moveTo(-4, 4);
        ctx.lineTo(-2.5, 8.5 + jawOpen);
        ctx.lineTo(-1, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 4);
        ctx.lineTo(2.5, 8.5 + jawOpen);
        ctx.lineTo(4, 4);
        ctx.fill();

        let eyeAngle = moveAngle;
        if (player && !player.isDead) {
            eyeAngle = Math.atan2((player.y + player.height / 2) - cy, (player.x + player.width / 2) - cx);
        }
        const eyeDx = Math.cos(eyeAngle) * 2.2;
        const eyeDy = Math.sin(eyeAngle) * 2.2;

        ctx.fillStyle = '#ff0033';
        ctx.beginPath();
        ctx.arc(-3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffee00';
        ctx.beginPath();
        ctx.arc(-3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff0033';
        ctx.beginPath();
        ctx.arc(3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffee00';
        ctx.beginPath();
        ctx.arc(3.5 + eyeDx * 0.5, -2.5 + eyeDy * 0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        if (Math.random() < 0.45) {
            const sparkAngle = Math.random() * Math.PI * 2;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(Math.cos(sparkAngle) * 4, Math.sin(sparkAngle) * 4);
            ctx.lineTo(Math.cos(sparkAngle) * 14, Math.sin(sparkAngle) * 14);
            ctx.stroke();
        }
    }

    renderHomingMissile(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
        const cx = enemy.x + enemy.width / 2;
        const cy = enemy.y + enemy.height / 2;
        const angle = Math.atan2(enemy.vy || 0, enemy.vx || 0);

        ctx.translate(cx, cy);
        ctx.rotate(angle);

        const flameLen = 10 + Math.random() * 8;
        const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#ffaa00');
        flameGrad.addColorStop(0.7, '#ff0033');
        flameGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(-8 - flameLen, 0);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1c040d';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -6);
        ctx.lineTo(-8, -5);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-8, 5);
        ctx.lineTo(4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ff0044';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#4a081a';
        ctx.beginPath();
        ctx.moveTo(-2, -5);
        ctx.lineTo(-7, -9);
        ctx.lineTo(-5, -3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 5);
        ctx.lineTo(-7, 9);
        ctx.lineTo(-5, 3);
        ctx.fill();

        ctx.fillStyle = '#ff0033';
        ctx.beginPath();
        ctx.arc(4, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffee00';
        ctx.beginPath();
        ctx.arc(5, 0, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    renderTurret(ctx: CanvasRenderingContext2D, enemy: Enemy, player: any): void {
        const cx = enemy.x + enemy.width / 2;
        const cy = enemy.y + enemy.height / 2;

        let angle = Math.PI / 2;
        if (player && !player.isDead) {
            angle = Math.atan2((player.y + player.height / 2) - cy, (player.x + player.width / 2) - cx);
        }

        ctx.fillStyle = '#1e272e';
        ctx.fillRect(enemy.x + 2, enemy.y + 10, 20, 14);
        ctx.strokeStyle = '#485460';
        ctx.lineWidth = 1;
        ctx.strokeRect(enemy.x + 2, enemy.y + 10, 20, 14);

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(enemy.x + 4, enemy.y + 20, 4, 3);
        ctx.fillRect(enemy.x + 10, enemy.y + 20, 4, 3);
        ctx.fillRect(enemy.x + 16, enemy.y + 20, 4, 3);

        if (player && !player.isDead) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * 160, cy + Math.sin(angle) * 160);
            ctx.stroke();
            ctx.restore();
        }

        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.fillStyle = '#0f171e';
        ctx.fillRect(2, -5, 10, 3);
        ctx.fillRect(2, 2, 10, 3);

        ctx.fillStyle = '#ff0044';
        ctx.fillRect(10, -5, 2, 3);
        ctx.fillRect(10, 2, 2, 3);

        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const chargeRatio = Math.min(1, (enemy.timer || 0) / (enemy.fireInterval || 2.0));
        const glowRad = 2 + chargeRatio * 2;
        ctx.fillStyle = chargeRatio > 0.8 ? '#ffffff' : '#ff0033';
        ctx.beginPath();
        ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
        ctx.fill();
    }
}
