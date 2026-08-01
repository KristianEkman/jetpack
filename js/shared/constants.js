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
    PLAYER_DIED: 'player_died'
};

