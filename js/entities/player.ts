/* ==========================================================================
   PLAYER ENTITY MODULE (Jetman Physics & Actions)
   ========================================================================== */

import { AudioManager, SoundEffects } from "../audio/index.js";
import {
  TILE_SIZE,
  TILES,
  PLAYER_PHYSICS,
  GAME_EVENTS,
  COMPETE_SCORE_PER_HIT,
} from "../shared/constants.js";
import { SerializedInputState } from "../shared/types.js";
import { TeleporterPad, TileMap } from "../world/tilemap.js";
import { EnemyManager, ENEMY_TYPES } from "./enemy.js";
import { UnpackedPlayerSnapshot } from "./playerManager.js";

export interface PlayerOptions {
  id?: string;
  color?: string;
  name?: string;
  isLocal?: boolean;
  showNameTag?: boolean;
  audio?: SoundEffects;
  tileMap?: TileMap;
}

export class Player {
  audio: AudioManager;
  tileMap: TileMap;
  id: string;
  color: string;
  name: string;
  isLocal: boolean;
  showNameTag: boolean;

  width: number;
  height: number;
  x: number;
  y: number;
  vx: number;
  vy: number;

  facingRight: boolean;
  isGrounded: boolean;
  isClimbing: boolean;
  isThrusting: boolean;
  isPhasing: boolean;

  fuel: number;
  maxFuel: number;
  fuelBurnRate: number;

  score: number;
  lives: number;
  isDead: boolean;
  serverAcknowledgedDeath: boolean;
  _localDeathTimestamp: number;
  respawnInvulnerability: number;

  phaseCooldown: number;
  phaseBeamTimer: number;
  phaseBeamLength: number;

  animTimer: number;
  stuckTimer: number;
  teleportCooldown: number;

  pendingInputs: SerializedInputState[];
  visualCorrectionX: number;
  visualCorrectionY: number;
  deathTimer: number;

  constructor(
    audioManager: AudioManager,
    tileMap: TileMap | null = null,
    options: PlayerOptions = {},
  ) {
    this.audio = audioManager;
    this.tileMap = tileMap!;

    this.id = options.id || `player_${Math.random().toString(36).substr(2, 9)}`;
    this.color = options.color || "#00f0ff";
    this.name = options.name || "Player 1";
    this.isLocal = options.isLocal !== undefined ? options.isLocal : true;
    this.showNameTag = options.showNameTag ?? false;

    this.width = PLAYER_PHYSICS.WIDTH;
    this.height = PLAYER_PHYSICS.HEIGHT;

    this.x = 100;
    this.y = 100;
    this.vx = 0;
    this.vy = 0;

    this.facingRight = true;
    this.isGrounded = false;
    this.isClimbing = false;
    this.isThrusting = false;
    this.isPhasing = false;

    this.fuel = PLAYER_PHYSICS.MAX_FUEL;
    this.maxFuel = PLAYER_PHYSICS.MAX_FUEL;
    this.fuelBurnRate = PLAYER_PHYSICS.FUEL_BURN_RATE;

    this.score = 0;
    this.lives = PLAYER_PHYSICS.INITIAL_LIVES;
    this.isDead = false;
    this.serverAcknowledgedDeath = false;
    this._localDeathTimestamp = 0;
    this.respawnInvulnerability = 0;

    this.phaseCooldown = 0;
    this.phaseBeamTimer = 0;
    this.phaseBeamLength = PLAYER_PHYSICS.PHASE_BEAM_LENGTH;

    this.animTimer = 0;
    this.stuckTimer = 0;
    this.teleportCooldown = 0;

    this.pendingInputs = [];
    this.visualCorrectionX = 0;
    this.visualCorrectionY = 0;
    this.deathTimer = 0;
  }

  spawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.isClimbing = false;
    this.isDead = false;
    this.serverAcknowledgedDeath = false;
    this._localDeathTimestamp = 0;
    this.respawnInvulnerability = 2.5;
    this.isPhasing = false;
    this.phaseBeamTimer = 0;
    this.phaseCooldown = 0;
    this.stuckTimer = 0;
    this.teleportCooldown = 0;
    this.fuel = Math.max(this.fuel, 50);
    this.pendingInputs = [];
    this.visualCorrectionX = 0;
    this.visualCorrectionY = 0;
  }

  simulateMovement(
    dt: number,
    input: SerializedInputState,
    enemyManager: EnemyManager | null = null,
    playerTargets: Iterable<Player> | null = null,
  ): void {
    if (this.isDead || !input) return;

    this.phaseCooldown = Math.max(0, this.phaseCooldown - dt);
    this.phaseBeamTimer = Math.max(0, this.phaseBeamTimer - dt);
    this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);
    this.isPhasing = this.phaseBeamTimer > 0;

    const centerCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
    const centerRow = Math.floor((this.y + this.height / 2) / TILE_SIZE);
    const feetRow = Math.floor((this.y + this.height + 1) / TILE_SIZE);

    const feetTile = this.tileMap.getTile(centerCol, feetRow);
    const onLadder = this.tileMap.isClimbable(centerCol, centerRow);
    const onIce = feetTile === TILES.ICE;

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
      if (!this.isGrounded) {
        this.vx *= 0.5;
      }
    }

    if (input.thrust && this.fuel > 0) {
      this.isClimbing = false;
      this.isThrusting = true;
      this.vy -= 1400 * dt;
      this.fuel = Math.max(0, this.fuel - this.fuelBurnRate * dt);
    } else {
      this.isThrusting = false;
    }

    if (!this.isClimbing && !this.isGrounded) {
      this.vy += 950 * dt;
    }
    this.vy = Math.min(450, this.vy);

    if (input.phase && this.phaseCooldown <= 0) {
      this.performPhaseBeam(enemyManager, playerTargets);
    }

    this.moveAndCollide(dt);
  }

  performPhaseBeam(
    enemyManager: EnemyManager | null = null,
    playerTargets: Iterable<Player> | null = null,
  ): Player | null {
    if (!this.tileMap) return null;

    this.isPhasing = true;
    this.phaseBeamTimer = 0.14;
    this.phaseCooldown = PLAYER_PHYSICS.PHASE_COOLDOWN_TIME;

    const playerCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
    const playerRow = Math.floor((this.y + this.height / 2) / TILE_SIZE);
    if (this.tileMap.getTile(playerCol, playerRow) === TILES.PHASE_BRICK) {
      this.tileMap.phaseTile(playerCol, playerRow);
    }

    const dir = this.facingRight ? 1 : -1;
    const startX = this.facingRight ? this.x + this.width : this.x;
    const startY = this.y + 12;
    const targets = playerTargets ? Array.from(playerTargets) : [];

    this.phaseBeamLength = 160;
    for (let dist = 0; dist <= 160; dist += 8) {
      const targetX = startX + dir * dist;
      const targetCol = Math.floor(targetX / TILE_SIZE);
      const targetRow = Math.floor(startY / TILE_SIZE);

      if (targets.length > 0) {
        for (const target of targets) {
          if (
            target === this ||
            target.isDead ||
            target.respawnInvulnerability > 0
          ) {
            continue;
          }
          if (
            targetX >= target.x &&
            targetX <= target.x + target.width &&
            startY >= target.y &&
            startY <= target.y + target.height
          ) {
            const livesBeforeHit = target.lives;
            target.takeDamage();
            if (target.lives < livesBeforeHit) {
              this.addScore(COMPETE_SCORE_PER_HIT);
              this.phaseBeamLength = dist;
              return target;
            }
          }
        }
      }

      if (enemyManager && enemyManager.enemies) {
        let hitEnemyIndex = -1;
        for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
          const enemy = enemyManager.enemies[i];
          if (
            targetX >= enemy.x &&
            targetX <= enemy.x + enemy.width &&
            startY >= enemy.y &&
            startY <= enemy.y + enemy.height
          ) {
            hitEnemyIndex = i;
            break;
          }
        }
        if (hitEnemyIndex >= 0) {
          const enemy = enemyManager.enemies[hitEnemyIndex];
          const isBoss = enemy.type === ENEMY_TYPES.BOSS;
          const wasDestroyed = enemyManager.damageEnemy
            ? enemyManager.damageEnemy(enemy.id, 1, this.id)
            : !!enemyManager.removeEnemyById(enemy.id);

          if (wasDestroyed) {
            this.audio?.playExplosion?.();
            this.addScore(isBoss ? 5000 : 200);
          }

          this.phaseBeamLength = dist;
          return null;
        }
      }

      const t = this.tileMap.getTile(targetCol, targetRow);
      if (t === TILES.PHASE_BRICK) {
        this.audio.playExplosion?.();
        this.tileMap.phaseTile(targetCol, targetRow);
        this.phaseBeamLength = dist;
        return null;
      } else if (this.tileMap.isSolid(targetCol, targetRow)) {
        this.phaseBeamLength = dist;
        return null;
      }
    }
    return null;
  }

  processLocalEffects(
    dt: number,
    input: SerializedInputState,
    enemyManager: EnemyManager | null,
  ): void {
    if (this.isDead || !input) return;

    if (input.suicide) {
      this.takeDamage();
      return;
    }

    const centerCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
    const centerRow = Math.floor((this.y + this.height / 2) / TILE_SIZE);
    const feetRow = Math.floor((this.y + this.height + 1) / TILE_SIZE);

    const currentTile = this.tileMap.getTile(centerCol, centerRow);
    const feetTile = this.tileMap.getTile(centerCol, feetRow);

    if (currentTile === TILES.SPIKE || feetTile === TILES.SPIKE) {
      this.audio?.stopEnergyDrain?.();
      this.takeDamage();
      return;
    }
    if (currentTile === TILES.ENERGY_DRAIN || feetTile === TILES.ENERGY_DRAIN) {
      this.fuel = Math.max(0, this.fuel - 40 * dt);
      this.audio?.startEnergyDrain?.();
      if (Math.random() < 0.3) {
        const px = this.x + Math.random() * this.width;
        const py = this.y + Math.random() * this.height;
        this.tileMap.addSparkles(px, py, "#ff0055", 1);
      }
    } else {
      this.audio?.stopEnergyDrain?.();
    }

    if (input.thrust && this.fuel > 0) {
      this.audio?.startThrust?.();
      const px = this.facingRight ? this.x + 2 : this.x + this.width - 2;
      const py = this.y + this.height - 4;
      this.tileMap.addSparkles(px, py, "#ff6600", 2);
    } else {
      this.audio?.stopThrust?.();
    }

    if (
      input.phase &&
      this.phaseCooldown >= PLAYER_PHYSICS.PHASE_COOLDOWN_TIME - 0.01
    ) {
      this.audio?.playPhaseSound?.();
      const startX = this.facingRight ? this.x + this.width : this.x;
      const startY = this.y + 12;
      this.tileMap.addSparkles(startX, startY, "#00f0ff", 6);

      const dir = this.facingRight ? 1 : -1;
      for (let dist = 0; dist <= 160; dist += 8) {
        const targetX = startX + dir * dist;

        if (enemyManager && enemyManager.enemies) {
          let hitEnemyIndex = -1;
          for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
            const enemy = enemyManager.enemies[i];
            if (
              targetX >= enemy.x &&
              targetX <= enemy.x + enemy.width &&
              startY >= enemy.y &&
              startY <= enemy.y + enemy.height
            ) {
              hitEnemyIndex = i;
              break;
            }
          }
          if (hitEnemyIndex >= 0) {
            const enemy = enemyManager.enemies[hitEnemyIndex];
            const isBoss = enemy.type === ENEMY_TYPES.BOSS;
            this.tileMap.addSparkles(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              "#ff0055",
              25,
            );

            const wasDestroyed = enemyManager.damageEnemy
              ? enemyManager.damageEnemy(enemy.id, 1, this.id)
              : !!enemyManager.removeEnemyById(enemy.id);

            if (wasDestroyed) {
              this.audio?.playExplosion?.();
              this.addScore(isBoss ? 5000 : 200);
            }
            break;
          }
        }
      }
    }

    this.checkCollectibles();
    this.checkTeleporter();
    this.checkStuck(dt);
  }

  update(
    dt: number,
    input: SerializedInputState,
    enemyManager: EnemyManager,
  ): void {
    if (this.respawnInvulnerability > 0) {
      this.respawnInvulnerability = Math.max(
        0,
        this.respawnInvulnerability - dt,
      );
    }
    if (this.isDead) return;

    this.animTimer += dt;
    this.simulateMovement(dt, input, enemyManager);
    this.processLocalEffects(dt, input, enemyManager);
  }

  reconcileServerSnapshot(serverPlayer: UnpackedPlayerSnapshot): void {
    if (!serverPlayer) return;

    const acknowledgedSeq = serverPlayer.lastSequenceId || 0;
    const prevPredictedX = this.x;
    const prevPredictedY = this.y;

    this.x = serverPlayer.x;
    this.y = serverPlayer.y;
    this.vx = serverPlayer.vx;
    this.vy = serverPlayer.vy;
    this.fuel = serverPlayer.fuel;
    this.lives = serverPlayer.lives;
    this.score = serverPlayer.score;
    this.facingRight = serverPlayer.facingRight;
    this.isGrounded = serverPlayer.isGrounded;
    this.isThrusting = serverPlayer.isThrusting;
    this.isClimbing = serverPlayer.isClimbing;
    this.isPhasing = serverPlayer.isPhasing;

    this.pendingInputs = this.pendingInputs.filter(
      (inp) => inp.sequenceId > acknowledgedSeq,
    );

    for (const inp of this.pendingInputs) {
      this.simulateMovement(1 / 60, inp);
    }

    const errX = prevPredictedX - this.x;
    const errY = prevPredictedY - this.y;
    const errSq = errX * errX + errY * errY;

    if (errSq > 4096 || serverPlayer.isDead || this.isDead) {
      this.visualCorrectionX = 0;
      this.visualCorrectionY = 0;
    } else {
      this.visualCorrectionX = Math.max(
        -32,
        Math.min(32, this.visualCorrectionX + errX),
      );
      this.visualCorrectionY = Math.max(
        -32,
        Math.min(32, this.visualCorrectionY + errY),
      );
    }
  }

  moveAndCollide(dt: number): void {
    const CORNER_NUDGE_SLOP = 8;
    const FOOT_INSET = 5;

    this.x += this.vx * dt;
    let colLeft = Math.floor(this.x / TILE_SIZE);
    let colRight = Math.floor((this.x + this.width) / TILE_SIZE);
    let rowTop = Math.floor(this.y / TILE_SIZE);
    let rowBottom = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    if (this.vx < 0) {
      const solidTop = this.tileMap.isSolid(colLeft, rowTop);
      const solidBottom = this.tileMap.isSolid(colLeft, rowBottom);

      if (solidTop && !solidBottom) {
        const overlapTop = (rowTop + 1) * TILE_SIZE - this.y;
        if (overlapTop <= CORNER_NUDGE_SLOP) {
          const newY = this.y + overlapTop;
          const newRowBottom = Math.floor((newY + this.height - 1) / TILE_SIZE);
          if (!this.tileMap.isSolid(colLeft, newRowBottom)) {
            this.y = newY;
            this.vy = Math.max(0, this.vy);
            rowTop = Math.floor(this.y / TILE_SIZE);
            rowBottom = newRowBottom;
          }
        }
      } else if (!solidTop && solidBottom) {
        const overlapBottom = this.y + this.height - rowBottom * TILE_SIZE;
        if (overlapBottom <= CORNER_NUDGE_SLOP) {
          const newY = this.y - overlapBottom;
          const newRowTop = Math.floor(newY / TILE_SIZE);
          if (!this.tileMap.isSolid(colLeft, newRowTop)) {
            this.y = newY;
            rowTop = newRowTop;
            rowBottom = Math.floor((this.y + this.height - 1) / TILE_SIZE);
          }
        }
      }

      if (
        this.tileMap.isSolid(colLeft, rowTop) ||
        this.tileMap.isSolid(colLeft, rowBottom)
      ) {
        this.x = (colLeft + 1) * TILE_SIZE;
        this.vx = 0;
      }
    } else if (this.vx > 0) {
      const solidTop = this.tileMap.isSolid(colRight, rowTop);
      const solidBottom = this.tileMap.isSolid(colRight, rowBottom);

      if (solidTop && !solidBottom) {
        const overlapTop = (rowTop + 1) * TILE_SIZE - this.y;
        if (overlapTop <= CORNER_NUDGE_SLOP) {
          const newY = this.y + overlapTop;
          const newRowBottom = Math.floor((newY + this.height - 1) / TILE_SIZE);
          if (!this.tileMap.isSolid(colRight, newRowBottom)) {
            this.y = newY;
            this.vy = Math.max(0, this.vy);
            rowTop = Math.floor(this.y / TILE_SIZE);
            rowBottom = newRowBottom;
          }
        }
      } else if (!solidTop && solidBottom) {
        const overlapBottom = this.y + this.height - rowBottom * TILE_SIZE;
        if (overlapBottom <= CORNER_NUDGE_SLOP) {
          const newY = this.y - overlapBottom;
          const newRowTop = Math.floor(newY / TILE_SIZE);
          if (!this.tileMap.isSolid(colRight, newRowTop)) {
            this.y = newY;
            rowTop = newRowTop;
            rowBottom = Math.floor((this.y + this.height - 1) / TILE_SIZE);
          }
        }
      }

      if (
        this.tileMap.isSolid(colRight, rowTop) ||
        this.tileMap.isSolid(colRight, rowBottom)
      ) {
        this.x = colRight * TILE_SIZE - this.width;
        this.vx = 0;
      }
    }

    this.y += this.vy * dt;
    colLeft = Math.floor(this.x / TILE_SIZE);
    colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
    rowTop = Math.floor(this.y / TILE_SIZE);
    rowBottom = Math.floor((this.y + this.height) / TILE_SIZE);

    this.isGrounded = false;

    if (this.vy < 0) {
      const solidLeft = this.tileMap.isSolid(colLeft, rowTop);
      const solidRight = this.tileMap.isSolid(colRight, rowTop);

      if (solidLeft && !solidRight) {
        const overlapLeft = (colLeft + 1) * TILE_SIZE - this.x;
        if (overlapLeft <= CORNER_NUDGE_SLOP) {
          const newX = this.x + overlapLeft;
          const newColRight = Math.floor((newX + this.width - 1) / TILE_SIZE);
          if (!this.tileMap.isSolid(newColRight, rowTop)) {
            this.x = newX;
            this.vx = Math.max(0, this.vx);
            colLeft = Math.floor(this.x / TILE_SIZE);
            colRight = newColRight;
          }
        }
      } else if (!solidLeft && solidRight) {
        const overlapRight = this.x + this.width - colRight * TILE_SIZE;
        if (overlapRight <= CORNER_NUDGE_SLOP) {
          const newX = this.x - overlapRight;
          const newColLeft = Math.floor(newX / TILE_SIZE);
          if (!this.tileMap.isSolid(newColLeft, rowTop)) {
            this.x = newX;
            this.vx = Math.min(0, this.vx);
            colLeft = newColLeft;
            colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
          }
        }
      }

      if (
        this.tileMap.isSolid(colLeft, rowTop) ||
        this.tileMap.isSolid(colRight, rowTop)
      ) {
        this.y = (rowTop + 1) * TILE_SIZE;
        this.vy = 0;
      }
    } else if (this.vy >= 0) {
      const footLeftCol = Math.floor((this.x + FOOT_INSET) / TILE_SIZE);
      const footRightCol = Math.floor(
        (this.x + this.width - FOOT_INSET) / TILE_SIZE,
      );
      const solidLeft = this.tileMap.isSolid(footLeftCol, rowBottom);
      const solidRight = this.tileMap.isSolid(footRightCol, rowBottom);

      if (solidLeft && !solidRight && this.vx > 0) {
        const overlapLeft =
          (footLeftCol + 1) * TILE_SIZE - (this.x + FOOT_INSET);
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
        const overlapRight =
          this.x + this.width - FOOT_INSET - footRightCol * TILE_SIZE;
        if (overlapRight <= CORNER_NUDGE_SLOP) {
          const newX = this.x - overlapRight;
          const newFootRightCol = Math.floor(
            (newX + this.width - FOOT_INSET) / TILE_SIZE,
          );
          if (!this.tileMap.isSolid(newFootRightCol, rowBottom)) {
            this.x = newX;
            colLeft = Math.floor(this.x / TILE_SIZE);
            colRight = Math.floor((this.x + this.width - 1) / TILE_SIZE);
          }
        }
      }

      const isGroundedLeft = this.tileMap.isSolid(
        Math.floor((this.x + FOOT_INSET) / TILE_SIZE),
        rowBottom,
      );
      const isGroundedRight = this.tileMap.isSolid(
        Math.floor((this.x + this.width - FOOT_INSET) / TILE_SIZE),
        rowBottom,
      );

      if (isGroundedLeft || isGroundedRight) {
        this.y = rowBottom * TILE_SIZE - this.height;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    const feetTile = this.tileMap.getTile(
      Math.floor((this.x + this.width / 2) / TILE_SIZE),
      rowBottom,
    );
    if (this.isGrounded) {
      if (feetTile === TILES.CONVEYOR_LEFT) this.x -= 120 * dt;
      if (feetTile === TILES.CONVEYOR_RIGHT) this.x += 120 * dt;
    }

    this.x = Math.max(
      0,
      Math.min(this.tileMap.cols * TILE_SIZE - this.width, this.x),
    );
    this.y = Math.max(
      0,
      Math.min(this.tileMap.rows * TILE_SIZE - this.height, this.y),
    );
  }

  checkCollectibles(): void {
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
          this.addScore(250);
          const isAllCaught =
            this.tileMap.collectedEmeralds === 4 ||
            (this.tileMap.totalEmeralds > 0 &&
              this.tileMap.collectedEmeralds === this.tileMap.totalEmeralds);
          if (isAllCaught) {
            this.audio?.playAllDiamondsCaught?.();
            this.tileMap.addSparkles(
              col * TILE_SIZE + 16,
              row * TILE_SIZE + 16,
              "#00e5ff",
              25,
            );
            this.tileMap.addSparkles(
              col * TILE_SIZE + 16,
              row * TILE_SIZE + 16,
              "#00ff77",
              25,
            );
            this.tileMap.addSparkles(
              col * TILE_SIZE + 16,
              row * TILE_SIZE + 16,
              "#ffd700",
              20,
            );
          } else {
            this.audio?.playEmeraldPickup?.();
            this.tileMap.addSparkles(
              col * TILE_SIZE + 16,
              row * TILE_SIZE + 16,
              "#00e5ff",
              12,
            );
            this.tileMap.addSparkles(
              col * TILE_SIZE + 16,
              row * TILE_SIZE + 16,
              "#00ff77",
              10,
            );
          }
          this.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
            col,
            row,
            tileType: tile,
            playerId: this.id,
            collectedEmeralds: this.tileMap.collectedEmeralds,
            totalEmeralds: this.tileMap.totalEmeralds,
            isAllCaught,
          });
        } else if (tile === TILES.FUEL) {
          this.tileMap.setTile(col, row, TILES.AIR);
          this.fuel = Math.min(this.maxFuel, this.fuel + 50);
          this.addScore(50);
          this.audio?.playFuelPickup?.();
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ffaa00",
            14,
          );
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ffee55",
            10,
          );
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ffffff",
            6,
          );
          this.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
            col,
            row,
            tileType: tile,
            playerId: this.id,
            collectedEmeralds: this.tileMap.collectedEmeralds,
            totalEmeralds: this.tileMap.totalEmeralds,
            fuel: this.fuel,
          });
        } else if (tile === TILES.GOLD) {
          this.tileMap.setTile(col, row, TILES.AIR);
          this.addScore(500);
          this.audio?.playEmeraldPickup?.();
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#f1c40f",
            10,
          );
          this.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
            col,
            row,
            tileType: tile,
            playerId: this.id,
            collectedEmeralds: this.tileMap.collectedEmeralds,
            totalEmeralds: this.tileMap.totalEmeralds,
            score: this.score,
          });
        } else if (tile === TILES.EXTRA_LIFE) {
          this.tileMap.setTile(col, row, TILES.AIR);
          this.lives = Math.min(PLAYER_PHYSICS.MAX_LIVES, this.lives + 1);
          this.addScore(1000);
          this.audio?.playExtraLifePickup?.();
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ff2d55",
            15,
          );
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ff88a5",
            12,
          );
          this.tileMap.addSparkles(
            col * TILE_SIZE + 16,
            row * TILE_SIZE + 16,
            "#ffffff",
            8,
          );
          this.tileMap.emit(GAME_EVENTS.ITEM_COLLECTED, {
            col,
            row,
            tileType: tile,
            playerId: this.id,
            collectedEmeralds: this.tileMap.collectedEmeralds,
            totalEmeralds: this.tileMap.totalEmeralds,
            lives: this.lives,
            score: this.score,
          });
        }
      }
    }
  }

  addScore(points: number): void {
    const oldScore = this.score;
    this.score += points;
    const milestone = PLAYER_PHYSICS.SCORE_PER_EXTRA_LIFE;
    if (milestone > 0) {
      const oldMilestones = Math.floor(oldScore / milestone);
      const newMilestones = Math.floor(this.score / milestone);
      if (newMilestones > oldMilestones) {
        const extraLivesToAdd = newMilestones - oldMilestones;
        const prevLives = this.lives;
        this.lives = Math.min(PLAYER_PHYSICS.MAX_LIVES, this.lives + extraLivesToAdd);
        if (this.lives > prevLives) {
          this.audio?.playExtraLifePickup?.();
          this.tileMap?.addSparkles?.(
            this.x + this.width / 2,
            this.y + this.height / 2,
            "#ff2d55",
            20,
          );
          this.tileMap?.addSparkles?.(
            this.x + this.width / 2,
            this.y + this.height / 2,
            "#ffffff",
            15,
          );
        }
      }
    }
  }

  checkTeleporter(): void {
    if (this.teleportCooldown > 0) return;
    if (!this.tileMap.teleporters || this.tileMap.teleporters.length < 2)
      return;

    const leftCol = Math.floor(this.x / TILE_SIZE);
    const rightCol = Math.floor((this.x + this.width) / TILE_SIZE);
    const topRow = Math.floor(this.y / TILE_SIZE);
    const bottomRow = Math.floor((this.y + this.height + 2) / TILE_SIZE);

    for (let col = leftCol; col <= rightCol; col++) {
      for (let row = topRow; row <= bottomRow; row++) {
        const tile = this.tileMap.getTile(col, row);
        if (tile === TILES.TELEPORTER) {
          const tileIndex = row * this.tileMap.cols + col;
          const currentPadIdx = this.tileMap.teleporters.findIndex(
            (pad: TeleporterPad) => pad.tiles.includes(tileIndex),
          );

          if (currentPadIdx !== -1) {
            const nextPadIdx =
              (currentPadIdx + 1) % this.tileMap.teleporters.length;
            const targetPad = this.tileMap.teleporters[nextPadIdx];

            const startX = this.x + this.width / 2;
            const startY = this.y + this.height / 2;

            this.tileMap.addSparkles(startX, startY, "#9b59b6", 22);
            this.tileMap.addSparkles(startX, startY, "#00cec9", 18);

            this.x = targetPad.x + (TILE_SIZE - this.width) / 2;
            this.y = targetPad.y + (TILE_SIZE - this.height) / 2;
            this.vy = Math.min(0, this.vy);

            const destX = this.x + this.width / 2;
            const destY = this.y + this.height / 2;

            this.tileMap.addSparkles(destX, destY, "#a29bfe", 22);
            this.tileMap.addSparkles(destX, destY, "#ffffff", 18);

            this.audio?.playTeleport?.();

            this.teleportCooldown = 0.6;
            return;
          }
        }
      }
    }
  }

  takeDamage(): void {
    if (this.isDead || (this.respawnInvulnerability || 0) > 0) return;
    this.isDead = true;
    this.serverAcknowledgedDeath = false;
    this._localDeathTimestamp = Date.now();
    this.lives--;
    this.stuckTimer = 0;
    this.audio?.stopThrust?.();
    this.audio?.stopEnergyDrain?.();
    this.audio?.playExplosion?.();

    if (this.tileMap) {
      this.tileMap.addDeathExplosion(this.x, this.y, this.facingRight);
    }
  }

  checkStuck(dt: number): void {
    if (this.isDead) return;

    if (this.fuel >= 1.0 || this.isThrusting) {
      this.stuckTimer = 0;
      return;
    }

    if (!this.isGrounded && !this.isClimbing && Math.abs(this.vy) > 15) {
      this.stuckTimer = 0;
      return;
    }

    const startCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
    const startRow = Math.floor((this.y + this.height - 4) / TILE_SIZE);

    let canEscape = false;
    const queue: Array<{ col: number; row: number }> = [
      { col: startCol, row: startRow },
    ];
    const visited = new Set<string>();
    visited.add(`${startCol},${startRow}`);

    let steps = 0;
    const maxSteps = 150;

    while (queue.length > 0 && steps < maxSteps) {
      steps++;
      const { col, row } = queue.shift()!;
      const tile = this.tileMap.getTile(col, row);

      if (tile === TILES.FUEL) {
        canEscape = true;
        break;
      }

      if (tile === TILES.TELEPORTER) {
        canEscape = true;
        break;
      }

      if (
        tile === TILES.EXIT_PORTAL &&
        this.tileMap.collectedEmeralds >= this.tileMap.totalEmeralds
      ) {
        canEscape = true;
        break;
      }

      if (tile === TILES.PHASE_BRICK) {
        canEscape = true;
        break;
      }

      const isCurrentClimbable = this.tileMap.isClimbable(col, row);

      const upRow = row - 1;
      if (upRow >= 0) {
        const isUpClimbable = this.tileMap.isClimbable(col, upRow);
        if (
          (isCurrentClimbable || isUpClimbable) &&
          !this.tileMap.isSolid(col, upRow)
        ) {
          const key = `${col},${upRow}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ col, row: upRow });
          }
        }
      }

      const downRow = row + 1;
      if (downRow < this.tileMap.rows) {
        if (!this.tileMap.isSolid(col, downRow)) {
          let fallRow = downRow;
          while (
            fallRow < this.tileMap.rows - 1 &&
            !this.tileMap.isSolid(col, fallRow + 1) &&
            !this.tileMap.isClimbable(col, fallRow)
          ) {
            fallRow++;
          }
          const key = `${col},${fallRow}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ col, row: fallRow });
          }
        }
      }

      for (const dc of [-1, 1]) {
        const nextCol = col + dc;
        if (nextCol < 0 || nextCol >= this.tileMap.cols) continue;

        if (this.tileMap.isSolid(nextCol, row)) {
          if (this.tileMap.getTile(nextCol, row) === TILES.PHASE_BRICK) {
            canEscape = true;
            break;
          }
          continue;
        }

        let walkRow = row;
        if (
          !this.tileMap.isSolid(nextCol, walkRow + 1) &&
          !this.tileMap.isClimbable(nextCol, walkRow)
        ) {
          while (
            walkRow < this.tileMap.rows - 1 &&
            !this.tileMap.isSolid(nextCol, walkRow + 1) &&
            !this.tileMap.isClimbable(nextCol, walkRow)
          ) {
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
      if (Math.random() < 0.5) {
        this.tileMap.addSparkles(this.x + 11, this.y + 14, "#ff0055", 4);
      }
      if (this.stuckTimer >= 0.8) {
        this.takeDamage();
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  applySnapshot(player: Player): void {
    if (!player) return;
    if (player.x !== undefined) this.x = player.x;
    if (player.y !== undefined) this.y = player.y;
    if (player.vx !== undefined) this.vx = player.vx;
    if (player.vy !== undefined) this.vy = player.vy;
    if (player.fuel !== undefined) this.fuel = player.fuel;
    if (player.lives !== undefined) this.lives = player.lives;
    if (player.score !== undefined) this.score = player.score;
    if (player.facingRight !== undefined) this.facingRight = player.facingRight;
    if (player.isGrounded !== undefined) this.isGrounded = player.isGrounded;
    if (player.isThrusting !== undefined) this.isThrusting = player.isThrusting;
    if (player.isClimbing !== undefined) this.isClimbing = player.isClimbing;
    if (player.isPhasing !== undefined) this.isPhasing = player.isPhasing;
    if (player.isDead !== undefined) this.isDead = player.isDead;
    if (player.respawnInvulnerability !== undefined)
      this.respawnInvulnerability = player.respawnInvulnerability;
    if (player.color) this.color = player.color;
    if (player.name) this.name = player.name;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    ctx.save();

    if (this.respawnInvulnerability > 0) {
      if (Math.floor(this.animTimer * 20) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }
    }

    if (!this.isLocal) {
      this.animTimer += 0.016;
    }

    const isMovingOnGround =
      (this.isGrounded || Math.abs(this.vy) < 25) &&
      !this.isThrusting &&
      !this.isClimbing &&
      Math.abs(this.vx) > 5;

    let strideX = 0;
    let liftY1 = 0;
    let liftY2 = 0;
    let walkBobY = 0;

    if (isMovingOnGround) {
      const speedRatio = Math.min(1.5, Math.abs(this.vx) / 100);
      const walkSpeed = 14 * Math.max(0.5, speedRatio);
      const legSwing = Math.sin(this.animTimer * walkSpeed);
      strideX = legSwing * 3.5;
      liftY1 = Math.max(0, legSwing) * 2;
      liftY2 = Math.max(0, -legSwing) * 2;
      walkBobY = Math.abs(Math.sin(this.animTimer * walkSpeed)) * 2.0;
    }

    this.visualCorrectionX = (this.visualCorrectionX || 0) * 0.75;
    this.visualCorrectionY = (this.visualCorrectionY || 0) * 0.75;

    const px = this.x + this.visualCorrectionX;
    const py = this.y + this.visualCorrectionY - walkBobY;

    ctx.fillStyle = "#3b82f6";
    const leg1X = px + 4 + strideX;
    const leg1Height = 6 - liftY1;
    ctx.fillRect(leg1X, py + 22, 5, leg1Height);

    ctx.fillStyle = "#1d4ed8";
    const boot1X = this.facingRight ? leg1X : leg1X - 1;
    ctx.fillRect(boot1X, py + 22 + leg1Height - 2, 6, 2);

    ctx.fillStyle = "#7f8c8d";
    const packX = this.facingRight ? px - 4 : px + this.width - 2;
    ctx.fillRect(packX, py + 6, 6, 16);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(packX + 1, py + 8, 4, 4);

    if (this.isThrusting) {
      const flameLen = 8 + Math.random() * 8;
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.moveTo(packX + 1, py + 22);
      ctx.lineTo(packX + 5, py + 22);
      ctx.lineTo(packX + 3, py + 22 + flameLen);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.moveTo(packX + 2, py + 22);
      ctx.lineTo(packX + 4, py + 22);
      ctx.lineTo(packX + 3, py + 22 + flameLen * 0.6);
      ctx.closePath();
      ctx.fill();

      if (!this.isLocal && this.tileMap) {
        const smokeX = packX + 3;
        const smokeY = py + 22;
        this.tileMap.addSparkles(smokeX, smokeY, "#ff6600", 1);
        if (Math.random() < 0.3) {
          this.tileMap.addSparkles(smokeX, smokeY, "#aaaaaa", 1);
        }
      }
    }

    ctx.fillStyle = this.color || "#00ffcc";
    ctx.fillRect(px + 4, py + 8, 14, 14);

    ctx.fillStyle = "#ecf0f1";
    ctx.beginPath();
    ctx.arc(px + 11, py + 6, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3498db";
    const visorX = this.facingRight ? px + 11 : px + 5;
    ctx.fillRect(visorX, py + 3, 6, 5);

    ctx.fillStyle = "#60a5fa";
    const leg2X = px + 13 - strideX;
    const leg2Height = 6 - liftY2;
    ctx.fillRect(leg2X, py + 22, 5, leg2Height);

    ctx.fillStyle = "#2563eb";
    const boot2X = this.facingRight ? leg2X : leg2X - 1;
    ctx.fillRect(boot2X, py + 22 + leg2Height - 2, 6, 2);

    if (this.isPhasing) {
      if (!this.isLocal && this.tileMap) {
        const dir = this.facingRight ? 1 : -1;
        const startX = this.facingRight ? px + this.width : px;
        const startY = py + 12;
        this.phaseBeamLength = 160;
        for (let dist = 0; dist <= 160; dist += 8) {
          const targetX = startX + dir * dist;
          const targetCol = Math.floor(targetX / TILE_SIZE);
          const targetRow = Math.floor(startY / TILE_SIZE);
          if (this.tileMap.isSolid(targetCol, targetRow)) {
            this.phaseBeamLength = dist;
            break;
          }
        }
      }

      const beamStartX = this.facingRight ? px + this.width : px;
      const beamStartY = py + 12;
      const beamEndX = this.facingRight
        ? beamStartX + this.phaseBeamLength
        : beamStartX - this.phaseBeamLength;

      ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(beamStartX, beamStartY);
      ctx.lineTo(beamEndX, beamStartY);
      ctx.stroke();

      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(beamStartX, beamStartY);
      ctx.lineTo(beamEndX, beamStartY);
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(beamStartX, beamStartY);
      ctx.lineTo(beamEndX, beamStartY);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(beamStartX, beamStartY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(beamEndX, beamStartY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.arc(beamEndX, beamStartY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.respawnInvulnerability > 0) {
      ctx.save();
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + this.height / 2, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.name && this.showNameTag) {
      ctx.save();
      ctx.font = "bold 9px Orbitron, sans-serif";
      ctx.textAlign = "center";

      const tagText = this.name;
      const textWidth = ctx.measureText(tagText).width;
      const tagX = px + this.width / 2;
      const tagY = py - 10;

      ctx.fillStyle = "rgba(10, 15, 25, 0.75)";
      ctx.fillRect(tagX - textWidth / 2 - 5, tagY - 9, textWidth + 10, 12);
      ctx.strokeStyle = this.color || "#00f0ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(tagX - textWidth / 2 - 5, tagY - 9, textWidth + 10, 12);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(tagText, tagX, tagY);
      ctx.restore();
    }

    ctx.restore();
  }
}
