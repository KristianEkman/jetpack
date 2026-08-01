/* ==========================================================================
   SHARED GAME CONSTANTS & PHYSICS PARAMETERS
   ========================================================================== */

export const TILE_SIZE = 32;
export const GRID_COLS = 30; // 30 * 32 = 960 px
export const GRID_ROWS = 18; // 18 * 32 = 576 px

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
    TELEPORTER: 15,
    ENEMY_FLITZER: 16,
    ENEMY_MISSILE: 17,
    ENEMY_TURRET: 18
};

export const PLAYER_PHYSICS = {
    WIDTH: 22,
    HEIGHT: 28,
    MAX_FUEL: 100,
    FUEL_BURN_RATE: 18, // % per second
    INITIAL_LIVES: 3,
    WALK_ACCEL: 1200,
    ICE_ACCEL: 400,
    WALK_FRICTION: 0.82,
    ICE_FRICTION: 0.96,
    MAX_SPEED: 200,
    THRUST_ACCEL: 1400,
    GRAVITY: 950,
    TERMINAL_VELOCITY: 450,
    CLIMB_SPEED: 140,
    CORNER_NUDGE_SLOP: 8,
    FOOT_INSET: 5,
    PHASE_BEAM_LENGTH: 160,
    PHASE_BEAM_PERSIST_TIME: 0.14,
    PHASE_COOLDOWN_TIME: 0.12,
    PHASE_BRICK_REGEN_TIME: 5.0
};

export const GAME_EVENTS = {
    TILE_PHASED: 'tile_phased',
    TILE_RESTORED: 'tile_restored',
    PLAYER_INPUT: 'player_input',
    WORLD_SNAPSHOT: 'world_snapshot',
    START_MATCH: 'start_match',
    GAME_STARTED: 'game_started',
    ITEM_COLLECTED: 'item_collected',
    LEVEL_COMPLETE: 'level_complete',
    COMPLETE_LEVEL: 'complete_level',
    NEXT_LEVEL: 'next_level',
    PLAYER_DIED: 'player_died',
    ENEMY_DESTROYED: 'enemy_destroyed',
    GAME_OVER: 'game_over'
};

export const PLAYER_FLAGS = {
    FACING_RIGHT: 1 << 0, // 1
    IS_GROUNDED:  1 << 1, // 2
    IS_THRUSTING: 1 << 2, // 4
    IS_CLIMBING:  1 << 3, // 8
    IS_PHASING:   1 << 4, // 16
    IS_DEAD:      1 << 5  // 32
};

export const NETWORK_SETTINGS = {
    SNAPSHOT_INTERVAL_TICKS: 6, // 60 Hz / 6 = 10 Hz snapshot rate
    DEFAULT_INTERPOLATION_DELAY: 100, // ms render delay for remote entities
    MAX_EXTRAPOLATION_TIME: 100, // ms max extrapolation duration when packets are late
    SNAP_THRESHOLD_SQ: 64 * 64, // 4096 sq px max error distance before hard snap
    INPUT_HEARTBEAT_INTERVAL: 100 // ms heartbeat rate when input unchanged
};

