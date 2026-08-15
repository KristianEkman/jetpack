/* ==========================================================================
   PLAYER ENTITY CLASS
   ========================================================================== */

import { AudioLike, AudioManager, SoundEffects } from "../../audio/index.js";
import { PLAYER_PHYSICS } from "../../shared/constants.js";
import { SerializedInputState } from "../../shared/types.js";
import { TileMap } from "../../world/tilemap.js";
import { EnemyManager } from "../enemy/index.js";
import { UnpackedPlayerSnapshot } from "../playerManager.js";
import { PlayerOptions } from "./types.js";

import { simulateMovement, moveAndCollide } from "./playerPhysics.js";
import { performPhaseBeam, setPhasing } from "./playerCombat.js";
import { checkCollectibles, addScore, checkTeleporter } from "./playerCollectibles.js";
import { checkStuck } from "./playerStuck.js";
import { processLocalEffects } from "./playerEffects.js";
import { renderPlayer } from "./playerRenderer.js";

export class Player {
  audio: AudioManager | SoundEffects | AudioLike | null;
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
  rapidFireTimer: number;

  animTimer: number;
  walkPhase: number;
  stuckTimer: number;
  isStuck: boolean;
  teleportCooldown: number;

  pendingInputs: SerializedInputState[];
  visualCorrectionX: number;
  visualCorrectionY: number;
  deathTimer: number;

  constructor(
    audioManager: AudioManager | SoundEffects | AudioLike | null = null,
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
    this.rapidFireTimer = 0;

    this.animTimer = 0;
    this.walkPhase = 0;
    this.stuckTimer = 0;
    this.isStuck = false;
    this.teleportCooldown = 0;

    this.pendingInputs = [];
    this.visualCorrectionX = 0;
    this.visualCorrectionY = 0;
    this.deathTimer = 0;
  }

  isRapidFireActive(): boolean {
    return this.rapidFireTimer > 0;
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
    this.rapidFireTimer = 0;
    this.stuckTimer = 0;
    this.isStuck = false;
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
    isReplay: boolean = false,
  ): void {
    simulateMovement(this, dt, input, enemyManager, playerTargets, isReplay);
  }

  moveAndCollide(dt: number): void {
    moveAndCollide(this, dt);
  }

  performPhaseBeam(
    enemyManager: EnemyManager | null = null,
    playerTargets: Iterable<Player> | null = null,
  ): Player | null {
    return performPhaseBeam(this, enemyManager, playerTargets);
  }

  setPhasing(isPhasing: boolean): void {
    setPhasing(this, isPhasing);
  }

  processLocalEffects(
    dt: number,
    input: SerializedInputState,
    enemyManager: EnemyManager | null,
  ): void {
    processLocalEffects(this, dt, input, enemyManager);
  }

  update(
    dt: number,
    input: SerializedInputState,
    enemyManager: EnemyManager | null = null,
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

    // Save current client-predicted state
    const clientX = this.x;
    const clientY = this.y;
    const clientVx = this.vx;
    const clientVy = this.vy;
    const clientCooldown = this.phaseCooldown;
    const clientBeamTimer = this.phaseBeamTimer;

    // Reset to server-authoritative state and replay unacknowledged inputs
    this.x = serverPlayer.x;
    this.y = serverPlayer.y;
    this.vx = serverPlayer.vx;
    this.vy = serverPlayer.vy;

    this.pendingInputs = this.pendingInputs.filter(
      (inp) => (inp.sequenceId || 0) > acknowledgedSeq,
    );

    for (const inp of this.pendingInputs) {
      this.simulateMovement(1 / 60, inp, null, null, true);
    }

    // Preserve local weapon cooldowns so replay doesn't alter combat timers
    this.phaseCooldown = clientCooldown;
    this.phaseBeamTimer = clientBeamTimer;

    // this.x/y now holds the reconciled position (server + replayed inputs)
    const reconciledX = this.x;
    const reconciledY = this.y;
    const reconciledVx = this.vx;
    const reconciledVy = this.vy;

    // Measure prediction error
    const errX = clientX - reconciledX;
    const errY = clientY - reconciledY;
    const errSq = errX * errX + errY * errY;

    if (errSq > 4096 || serverPlayer.isDead || this.isDead) {
      // Large error (>64px) or death state change: hard snap to reconciled
      this.x = reconciledX;
      this.y = reconciledY;
      this.vx = reconciledVx;
      this.vy = reconciledVy;
    } else if (errSq > 4) {
      // Small drift (>2px): nudge 20% toward reconciled position per snapshot
      this.x = clientX - errX * 0.2;
      this.y = clientY - errY * 0.2;
      this.vx = reconciledVx;
      this.vy = reconciledVy;
    } else {
      // Negligible error (≤2px): keep client prediction as-is
      this.x = clientX;
      this.y = clientY;
      this.vx = clientVx;
      this.vy = clientVy;
    }

    // Always sync non-positional authoritative state from server
    this.fuel = serverPlayer.fuel;
    this.lives = serverPlayer.lives;
    this.score = serverPlayer.score;
    this.facingRight = serverPlayer.facingRight;
    this.isGrounded = serverPlayer.isGrounded;
    this.isThrusting = serverPlayer.isThrusting;
    this.isClimbing = serverPlayer.isClimbing;
    this.isPhasing = serverPlayer.isPhasing;
  }

  checkCollectibles(): void {
    checkCollectibles(this);
  }

  addScore(points: number): void {
    addScore(this, points);
  }

  checkTeleporter(): void {
    checkTeleporter(this);
  }

  takeDamage(): void {
    if (this.isDead || (this.respawnInvulnerability || 0) > 0) return;
    this.isDead = true;
    this.serverAcknowledgedDeath = false;
    this._localDeathTimestamp = Date.now();
    this.lives--;
    this.stuckTimer = 0;
    this.isStuck = false;
    this.audio?.stopThrust?.();
    this.audio?.stopEnergyDrain?.();
    this.audio?.playExplosion?.();

    if (this.tileMap) {
      this.tileMap.addDeathExplosion(this.x, this.y, this.facingRight);
    }
  }

  checkStuck(dt: number, enemyManager?: EnemyManager | null): void {
    checkStuck(this, dt, enemyManager);
  }

  applySnapshot(player: Partial<Player> | UnpackedPlayerSnapshot): void {
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
    if (player.isPhasing !== undefined) this.setPhasing(player.isPhasing);
    if (player.isDead !== undefined) this.isDead = player.isDead;
    if (player.respawnInvulnerability !== undefined)
      this.respawnInvulnerability = player.respawnInvulnerability;
    if (player.color) this.color = player.color;
    if (player.name) this.name = player.name;
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderPlayer(this, ctx);
  }
}
