import assert from "node:assert/strict";

// Setup global mock environment for DOM/localStorage
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem(key: string): string | null {
    return storage.has(key) ? storage.get(key)! : null;
  },
  setItem(key: string, val: string): void {
    storage.set(key, String(val));
  },
  removeItem(key: string): void {
    storage.delete(key);
  },
  clear(): void {
    storage.clear();
  },
};

const mockElement = {
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
  addEventListener: () => {},
  removeEventListener: () => {},
  style: {},
  dataset: {},
  children: [],
  appendChild: (c: unknown) => c,
  removeChild: (c: unknown) => c,
  querySelector: () => null,
  querySelectorAll: () => [],
  showModal: () => {},
  close: () => {},
  getContext: () => ({
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    measureText: () => ({ width: 10 }),
    save: () => {},
    restore: () => {},
    drawImage: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
  }),
};

const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = mockLocalStorage;
g.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, levels: [] }) });
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.window = {
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame: g.requestAnimationFrame,
  cancelAnimationFrame: g.cancelAnimationFrame,
  location: { hostname: "localhost", href: "http://localhost:3000" },
  innerWidth: 960,
  innerHeight: 576,
  AudioContext: class {
    state = "running";
    sampleRate = 44100;
    currentTime = 0;
    destination = {};
    resume = () => Promise.resolve();
    createGain = () => ({
      gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
    });
    createOscillator = () => ({
      type: "sine",
      frequency: { value: 440, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    });
    createBiquadFilter = () => ({
      type: "lowpass",
      frequency: { value: 350, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      Q: { value: 1, setValueAtTime: () => {} },
      connect: () => {},
    });
    createBufferSource = () => ({ buffer: null, loop: false, connect: () => {}, start: () => {}, stop: () => {} });
    createBuffer = () => ({ getChannelData: () => new Float32Array(4410) });
  },
};
g.document = {
  getElementById: () => mockElement,
  querySelector: () => mockElement,
  querySelectorAll: () => [],
  createElement: () => mockElement,
  addEventListener: () => {},
  removeEventListener: () => {},
  body: mockElement,
};

const { TileMap } = await import("../js/world/tilemap/tileMapClass.js");
const { TILES, TILE_SIZE, GRID_COLS, GRID_ROWS } = await import("../js/shared/constants.js");
const { CAMPAIGN_LEVELS } = await import("../js/levels/campaign.js");
const { RoomManager } = await import("../server/roomManager.js");
const { Game } = await import("../js/game.js");

console.log("🧪 Starting Level Change & Spawn Safety Test Suite...\n");

// 1. Campaign Levels Spawn Position Verification
console.log("1️⃣  Verifying All Campaign Levels Spawn Locations...");
const tileMap = new TileMap({ effectsEnabled: false });

CAMPAIGN_LEVELS.forEach((level, idx) => {
  tileMap.loadLevelData(level);
  const primarySpawn = tileMap.getPrimarySpawnPoint();

  assert.ok(
    tileMap.spawnPoints.length > 0,
    `Level ${idx + 1} (${level.name}) must have at least 1 spawn point`,
  );
  assert.equal(
    tileMap.isAreaSolid(primarySpawn.x, primarySpawn.y),
    false,
    `Level ${idx + 1} (${level.name}) spawn at (${primarySpawn.x}, ${primarySpawn.y}) MUST NOT be inside a solid wall`,
  );

  // Check tile type at player center
  const centerCol = Math.floor((primarySpawn.x + 11) / TILE_SIZE);
  const centerRow = Math.floor((primarySpawn.y + 14) / TILE_SIZE);
  assert.equal(
    tileMap.isSolid(centerCol, centerRow),
    false,
    `Level ${idx + 1} center tile (${centerCol}, ${centerRow}) must not be solid`,
  );
});
console.log("   ✅ All campaign levels verified: spawn points are clear of solid walls.");

// 2. Custom Level with Grid Spawn vs Stale spawnX/spawnY (100, 100)
console.log("2️⃣  Testing Custom Level with Stale spawnX/spawnY (100, 100)...");
const customGridWithWallAt100 = new Array(GRID_COLS * GRID_ROWS).fill(TILES.AIR);

// Place boundary walls
for (let c = 0; c < GRID_COLS; c++) {
  customGridWithWallAt100[0 * GRID_COLS + c] = TILES.BRICK;
  customGridWithWallAt100[(GRID_ROWS - 1) * GRID_COLS + c] = TILES.BRICK;
}
for (let r = 0; r < GRID_ROWS; r++) {
  customGridWithWallAt100[r * GRID_COLS + 0] = TILES.BRICK;
  customGridWithWallAt100[r * GRID_COLS + (GRID_COLS - 1)] = TILES.BRICK;
}

// Place a solid wall at row 3, col 3 (which covers coordinate 100, 100)
customGridWithWallAt100[3 * GRID_COLS + 3] = TILES.BRICK;
customGridWithWallAt100[3 * GRID_COLS + 4] = TILES.BRICK;
customGridWithWallAt100[4 * GRID_COLS + 3] = TILES.BRICK;
customGridWithWallAt100[4 * GRID_COLS + 4] = TILES.BRICK;

// Place a SPAWN tile at row 1, col 1 (coordinate 36, 34)
customGridWithWallAt100[1 * GRID_COLS + 1] = TILES.SPAWN;

const levelWithStaleSpawn = {
  name: "Custom Stale Test",
  grid: customGridWithWallAt100,
  spawnX: 100, // Stale default
  spawnY: 100, // Stale default
};

tileMap.loadLevelData(levelWithStaleSpawn);
const resolvedSpawn = tileMap.getPrimarySpawnPoint();

assert.notEqual(
  resolvedSpawn.x,
  100,
  "Spawn point must not use stale (100, 100) when a valid grid SPAWN tile exists",
);
assert.equal(
  resolvedSpawn.x,
  1 * TILE_SIZE + 4,
  "Spawn point must resolve to the grid SPAWN tile X",
);
assert.equal(
  resolvedSpawn.y,
  1 * TILE_SIZE + 2,
  "Spawn point must resolve to the grid SPAWN tile Y",
);
assert.equal(
  tileMap.isAreaSolid(resolvedSpawn.x, resolvedSpawn.y),
  false,
  "Resolved spawn point must not be solid",
);
console.log("   ✅ Grid SPAWN tile properly takes precedence over stale (100, 100) coordinates.");

// 3. Fallback Spawn Search when Map Has No TILES.SPAWN
console.log("3️⃣  Testing Safe Spot Fallback on Map with No TILES.SPAWN...");
const mapNoSpawn = new Array(GRID_COLS * GRID_ROWS).fill(TILES.BRICK);

// Carve open a 2x2 air pocket at (col 5, row 5)
mapNoSpawn[5 * GRID_COLS + 5] = TILES.AIR;
mapNoSpawn[5 * GRID_COLS + 6] = TILES.AIR;
mapNoSpawn[6 * GRID_COLS + 5] = TILES.AIR;
mapNoSpawn[6 * GRID_COLS + 6] = TILES.AIR;

tileMap.loadLevelData({
  name: "No Spawn Map",
  grid: mapNoSpawn,
});

const fallbackSpawn = tileMap.getPrimarySpawnPoint();
assert.equal(
  tileMap.isAreaSolid(fallbackSpawn.x, fallbackSpawn.y),
  false,
  "Fallback spawn search must find an open air pocket and not place player in a wall",
);
console.log(`   ✅ Fallback search successfully located open pocket at (${fallbackSpawn.x}, ${fallbackSpawn.y}).`);

// 4. Server Room Level Change & Multiplayer Player Spawn Sync
console.log("4️⃣  Testing Server Room Level Change & Spawn Position Sync...");
const roomManager = new RoomManager();
const hostSocket = "sock_host_1";
const joinSocket = "sock_join_1";

const room = roomManager.createRoom(hostSocket, {
  levelIndex: 0,
});
roomManager.addPlayerToRoom(room, joinSocket, { name: "Player 2" });

const hostPlayer = room.players.get(hostSocket)!;
const joinPlayer = room.players.get(joinSocket)!;

// Verify initial spawn is not in a wall
assert.equal(
  room.tileMap.isAreaSolid(hostPlayer.x, hostPlayer.y),
  false,
  "Host player initial spawn must not be in a wall",
);
assert.equal(
  room.tileMap.isAreaSolid(joinPlayer.x, joinPlayer.y),
  false,
  "Join player initial spawn must not be in a wall",
);

// Host changes level to Level 2 (Phase Shift Labs)
roomManager.changeRoomLevel(hostSocket, {
  levelIndex: 1,
});

assert.equal(
  room.tileMap.isAreaSolid(hostPlayer.x, hostPlayer.y),
  false,
  "Host player spawn after level change must not be in a wall",
);
assert.equal(
  room.tileMap.isAreaSolid(joinPlayer.x, joinPlayer.y),
  false,
  "Join player spawn after level change must not be in a wall",
);
assert.equal(
  hostPlayer.tileMap,
  room.tileMap,
  "Player entity tileMap reference must be updated to new level tileMap",
);
assert.equal(
  joinPlayer.tileMap,
  room.tileMap,
  "Join player entity tileMap reference must be updated to new level tileMap",
);
console.log("   ✅ Server Room level change correctly synced spawn points and tileMap bindings without wall clipping.");

// 5. LevelManager Single Player Level Transitions
console.log("5️⃣  Testing LevelManager Single Player Level Transitions...");
const mockCanvas = {
  width: 960,
  height: 576,
  getContext: () => ({
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    measureText: () => ({ width: 10 }),
    save: () => {},
    restore: () => {},
    drawImage: () => {},
  }),
} as unknown as HTMLCanvasElement;

const game = new Game();
for (let i = 0; i < CAMPAIGN_LEVELS.length; i++) {
  game.levelManager.startLevel(i);
  assert.equal(
    game.tileMap.isAreaSolid(game.player.x, game.player.y),
    false,
    `Player must not spawn in a wall when LevelManager starts campaign level ${i + 1}`,
  );
}
game.loop.stop();
console.log("   ✅ Single-player level transitions verified across all campaign levels.");

console.log("\n🎉 ALL SPAWN SAFETY & LEVEL CHANGE TESTS PASSED CLEANLY!\n");
process.exit(0);
