/* ==========================================================================
   PREBUILT CAMPAIGN LEVELS
   ========================================================================== */

import { TILES, GRID_COLS, GRID_ROWS } from '../world/tilemap.js';

export interface CampaignLevelConfig {
    name: string;
    grid: number[];
    flitzers?: Array<{ x: number; y: number; vx: number; vy: number }>;
    missiles?: Array<{ x: number; y: number }>;
    turrets?: Array<{ x: number; y: number; fireInterval: number }>;
}

const CHAR_TO_TILE: Record<string, number> = {
    '.': TILES.AIR,
    '#': TILES.BRICK,
    'P': TILES.PHASE_BRICK,
    'I': TILES.ICE,
    '<': TILES.CONVEYOR_LEFT,
    '>': TILES.CONVEYOR_RIGHT,
    'H': TILES.LADDER,
    'V': TILES.VINE,
    'X': TILES.SPIKE,
    'D': TILES.ENERGY_DRAIN,
    'E': TILES.EMERALD,
    'F': TILES.FUEL,
    'G': TILES.GOLD,
    'S': TILES.SPAWN,
    'O': TILES.EXIT_PORTAL,
    'T': TILES.TELEPORTER,
    '1': TILES.ENEMY_FLITZER,
    '2': TILES.ENEMY_MISSILE,
    '3': TILES.ENEMY_TURRET
};

function parseLevelString(str: string): number[] {
    const lines = str.trim().split('\n').map(l => l.trim());
    const grid: number[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        const line = lines[r] || '.'.repeat(GRID_COLS);
        for (let c = 0; c < GRID_COLS; c++) {
            const ch = line[c] || '.';
            grid.push(CHAR_TO_TILE[ch] !== undefined ? CHAR_TO_TILE[ch] : TILES.AIR);
        }
    }
    return grid;
}

// Level 1: Genesis
const LEVEL_1_STR = `
##############################
#S..........#..............E.#
####.######...##############.#
#.........#.#..............#.#
#.#######.#...############.#.#
#.#.....#........E.........#.#
#.#.F...#.##################.#
#.#.#####....................#
#.#.......#.################.#
#.#########....E...........#.#
#...........#.############.#.#
######.######.#............#.#
#E............#.##########.#.#
#.######.######.#..........#.#
#.......H.......#.########.#.#
#.#####.H.#####.#...F.....O..#
#.....F.H.....F.#..........###
##############################
`;

// Level 2: Phase Shift Caverns
const LEVEL_2_STR = `
##############################
#S......PPP..............E...#
######.PPPP#.#################
#......PPPP#.........E.......#
#.PPPPPPPPPP.###############.#
#.#..........................#
#.#.PPPPPPP.################.#
#.#.P.E...P.#.F............#.#
#.#.P..F..P.#.############.#.#
#.#.PPPPPPP.#.#............#.#
#.#.........#.#.IIIIIIIIII.#.#
#.###########.#.IIIIIIIIII.#.#
#...........#.#............#.#
#.#########.#...############.#
#.#.E.....#.#................#
#...#####...#.##############.#
#...F.......#...F..........O.#
##############################
`;

// Level 3: Conveyor Factory
const LEVEL_3_STR = `
##############################
#S..........E..............E.#
#####.>>>>>>>>>>>>.###########
#..........H...........H.....#
#.<<<<<<<<<H<<<<<<<<<<<H<<<<.#
#..........H...........H.....#
#.##########.#########.#####.#
#.#..........................#
#.#.>>>>>>>>>>>>>>>.########.#
#.#..........................#
#.#.################.#######.#
#.#.F.......E........#.....#.#
#.##########.#########.###.#.#
#...........H..............#.#
#.#########.H.############.#.#
#...........H...E..........#.O
#.........F.H............F..##
##############################
`;

// Level 4: Teleporter Matrix
const LEVEL_4_STR = `
##############################
#S....T.....#......E...T.....#
#####.#####.#.################
#...E.......#........E.......#
#.#########.################.#
#.........#.#................#
#.#######.#.#.##############.#
#.#.F...#.#.#.#...F...D....#.#
#.#.###.#.#.#.#.##########.#.#
#.#...#.#...#.#.#..........#.#
#.###.#.#####.#.#.########.#.#
#.....#.......#.#...E......#.#
#.#############.##########.#.#
#...X...X...X............#.O.#
#.######################.#.###
#...F..................#.F...#
#............................#
##############################
`;

// Level 5: The Emerald Core
const LEVEL_5_STR = `
##############################
#S....PPP....E....PPP......E.#
#####.PPP.########.PPP.#######
#.....PPP..........PPP.......#
#.PPPPPPPPPPPPPPPPPPPPPPPPPP.#
#............................#
#.##########################.#
#.#...E....F...E....F......#.#
#.#.######################.#.#
#.#.#.IIIIIIIIIIIIIIIIII.#.#.#
#.#.#.I................I.#.#.#
#.#.PPPPPP.DDDDDDDDDD.PPPPPP.#
#.#.#.I..D........D..I.#.#.#.#
#.#.#.I..D..E.....D..I.#.#.#.#
#.#.#.IIIIIIIIIIIIIIII.#.#.#.#
#...######################.#.O
#...F......................###
##############################
`;

// Level 6: Trickster Circuit
// A layered route-choice puzzle: the teleporter is fast but dangerous, while
// the vine and ladder routes trade speed for safer fuel and collectible paths.
const LEVEL_6_STR = `
##############################
#S....E...PPP....T....E......#
#####.###.PPP.######.#######.#
#....V#...PPP......#.........#
#.###V#.##########.#.#######.#
#...#V#....F.......#.#.......#
#.#.#V############.#.#.#####.#
#.#.#V...>>>>>>....#.#...E...#
#.#.#####XXGXXX#####.#######.#
#.#.....H......H...#.........#
#.#####.H.DDDD.H.###########.#
#.....#.H.D..D.H.#.....F.....#
#####.#.H.D.E..H.#.###########
#.....#.H.IIII.H.#...........#
#.###.T.H.<<<<.H.###########.#
#...F...H......H....E........O
#.##########################.#
##############################
`;

export const CAMPAIGN_LEVELS: CampaignLevelConfig[] = [
    {
        name: "Stage 1: Genesis Caverns",
        grid: parseLevelString(LEVEL_1_STR),
        flitzers: [{ x: 400, y: 100, vx: 120, vy: 0 }]
    },
    {
        name: "Stage 2: Phase Shift Labs",
        grid: parseLevelString(LEVEL_2_STR),
        flitzers: [
            { x: 300, y: 150, vx: 100, vy: 80 },
            { x: 600, y: 300, vx: -120, vy: 0 }
        ]
    },
    {
        name: "Stage 3: Conveyor Assembly",
        grid: parseLevelString(LEVEL_3_STR),
        flitzers: [
            { x: 200, y: 200, vx: 140, vy: 0 },
            { x: 500, y: 350, vx: -150, vy: 0 }
        ],
        missiles: [{ x: 800, y: 100 }]
    },
    {
        name: "Stage 4: Teleporter Matrix",
        grid: parseLevelString(LEVEL_4_STR),
        flitzers: [
            { x: 250, y: 250, vx: 120, vy: 120 },
            { x: 700, y: 150, vx: -130, vy: 100 }
        ],
        turrets: [{ x: 450, y: 180, fireInterval: 2.2 }]
    },
    {
        name: "Stage 5: The Emerald Core",
        grid: parseLevelString(LEVEL_5_STR),
        flitzers: [
            { x: 0, y: 400, vx: 160, vy: 120 },
            { x: 646, y: 518, vx: -160, vy: -120 }
        ],
        missiles: [{ x: 850, y: 80 }],
        turrets: [{ x: 480, y: 440, fireInterval: 1.8 }]
    },
    {
        name: "Stage 6: Trickster Circuit",
        grid: parseLevelString(LEVEL_6_STR),
        flitzers: [
            { x: 260, y: 105, vx: 165, vy: 70 },
            { x: 735, y: 240, vx: -185, vy: 0 },
            { x: 430, y: 465, vx: 155, vy: -90 }
        ],
        missiles: [{ x: 855, y: 335 }],
        turrets: [
            { x: 560, y: 180, fireInterval: 1.65 },
            { x: 770, y: 470, fireInterval: 2.1 }
        ]
    }
];
