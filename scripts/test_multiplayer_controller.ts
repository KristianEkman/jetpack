/* ==========================================================================
   MULTIPLAYER CONTROLLER (js/network/multiplayerController.ts) UNIT TEST SUITE
   ========================================================================== */

import assert from "node:assert/strict";
import {
  MockElement,
  createMockElement,
  getOrRegisterMockElement,
  setupMockDom,
  mockDocument,
  mockLocalStorage,
} from "./test_mock_dom.js";


// ── 1. Headless DOM & Web API Mock Harness ─────────────────────────────────
setupMockDom({ playerColor: "#00ffcc", playerName: "TestPilot" });

// ── 2. Imports ─────────────────────────────────────────────────────────────

const { Game, GAME_STATES } = await import("../js/game.js");
const { MultiplayerController } = await import("../js/network/multiplayerController.js");
const { CAMPAIGN_LEVELS } = await import("../js/levels/campaign.js");
const { MULTIPLAYER_MODES } = await import("../js/shared/constants.js");
const { TILES } = await import("../js/world/tilemap.js");
import type {
  CustomLevelHeader,
  CustomLevelRecord,
  EnemyDestroyedPayload,
  GameOverPayload,
  ItemCollectedPayload,
  LevelCompletePayload,
  MultiplayerLevelData,
  MultiplayerPlayer,
  MultiplayerRoomInfo,
  NetworkWorldSnapshotPayload,
  PublicRoomInfo,
} from "../js/shared/payloads.js";

console.log("🧪 Starting MultiplayerController Unit Test Suite...\n");

// ── Test 1: Constructor & Initialization ────────────────────────────────────
console.log("1️⃣  Testing MultiplayerController Construction & Initial State...");
const game = new Game();
const controller = new MultiplayerController(game);

assert.strictEqual(controller.game, game, "Controller must store game instance");
assert.strictEqual(controller.customMapDataPayload, null, "customMapDataPayload must default to null");
console.log("   ✅ Controller constructor and initial state verified.\n");

// ── Test 2: Network Event Handler Bindings (initNetwork) ────────────────────
console.log("2️⃣  Testing Network Event Callbacks (initNetwork)...");
controller.initNetwork();

// Check all callbacks were bound
assert.ok(game.network.onRoomCreatedCb, "onRoomCreatedCb must be bound");
assert.ok(game.network.onRoomJoinedCb, "onRoomJoinedCb must be bound");
assert.ok(game.network.onPlayerJoinedCb, "onPlayerJoinedCb must be bound");
assert.ok(game.network.onPlayerLeftCb, "onPlayerLeftCb must be bound");
assert.ok(game.network.onRoomUpdatedCb, "onRoomUpdatedCb must be bound");
assert.ok(game.network.onGameStartedCb, "onGameStartedCb must be bound");
assert.ok(game.network.onTilePhasedCb, "onTilePhasedCb must be bound");
assert.ok(game.network.onTileRestoredCb, "onTileRestoredCb must be bound");
assert.ok(game.network.onItemCollectedCb, "onItemCollectedCb must be bound");
assert.ok(game.network.onEnemyDestroyedCb, "onEnemyDestroyedCb must be bound");
assert.ok(game.network.onLevelCompleteCb, "onLevelCompleteCb must be bound");
assert.ok(game.network.onGameOverCb, "onGameOverCb must be bound");
assert.ok(game.network.onWorldSnapshotCb, "onWorldSnapshotCb must be bound");
assert.ok(game.network.onRoomListCb, "onRoomListCb must be bound");
assert.ok(game.network.onErrorCb, "onErrorCb must be bound");

// Test onRoomCreatedCb & onRoomJoinedCb
game.network.socketId = "sock_host_123";
let bannerMessage = "";
game.uiManager.showBanner = (msg: string): void => {
  bannerMessage = msg;
};

const sampleRoom: MultiplayerRoomInfo = {
  id: "ROOM_A1",
  hostSocketId: "sock_host_123",
  mapName: "Stage 1: Cavern",
  levelIndex: 0,
  maxPlayers: 4,
  gameMode: MULTIPLAYER_MODES.COOP,
  status: "lobby",
  players: [
    { id: "p1", name: "HostPilot", socketId: "sock_host_123", color: "#ff4444", isHost: true },
  ],
};

game.network.onRoomCreatedCb!({ success: true, roomId: "ROOM_A1", room: sampleRoom });
assert.strictEqual(game.playerManager.localSocketId, "sock_host_123", "Local socket ID must be set");
assert.strictEqual(bannerMessage, "ROOM ROOM_A1 CREATED!", "Banner message must announce room creation");

game.network.onRoomJoinedCb!({ success: true, room: sampleRoom });
assert.strictEqual(bannerMessage, "JOINED ROOM ROOM_A1!", "Banner message must announce joining room");

// Test onPlayerJoinedCb & onPlayerLeftCb
const newPlayer: MultiplayerPlayer = {
  id: "p2",
  name: "Wingman",
  socketId: "sock_client_456",
  color: "#00ffcc",
  isHost: false,
};
game.network.onPlayerJoinedCb!({
  room: { ...sampleRoom, players: [...sampleRoom.players, newPlayer] },
  player: newPlayer,
});
assert.strictEqual(bannerMessage, "WINGMAN JOINED!", "Banner must announce player joined");

game.network.onPlayerLeftCb!({
  room: sampleRoom,
  leavingPlayer: newPlayer,
});
assert.strictEqual(bannerMessage, "WINGMAN LEFT", "Banner must announce player left");

// Test onRoomUpdatedCb
game.network.onRoomUpdatedCb!({
  room: { ...sampleRoom, mapName: "Stage 2: Conveyor" },
});
assert.strictEqual(bannerMessage, "MAP UPDATED TO STAGE 2: CONVEYOR!", "Banner must announce map update");

// Test onTilePhasedCb & onTileRestoredCb
game.isMultiplayer = true;
let phaseImpactPlayed = false;
game.audio.playPhaseImpact = (): void => {
  phaseImpactPlayed = true;
};
let phasedCol = -1;
let phasedRow = -1;
game.tileMap.phaseTile = (col: number, row: number): boolean => {
  phasedCol = col;
  phasedRow = row;
  return true;
};
game.network.onTilePhasedCb!({ col: 5, row: 8 });
assert.strictEqual(phasedCol, 5, "Tile phase col must match");
assert.strictEqual(phasedRow, 8, "Tile phase row must match");
assert.strictEqual(phaseImpactPlayed, true, "Phase impact SFX must be triggered");

let restoredCol = -1;
let restoredRow = -1;
game.tileMap.restoreTile = (col: number, row: number): boolean => {
  restoredCol = col;
  restoredRow = row;
  return true;
};
game.network.onTileRestoredCb!({ col: 5, row: 8 });
assert.strictEqual(restoredCol, 5, "Tile restored col must match");
assert.strictEqual(restoredRow, 8, "Tile restored row must match");

// Test onItemCollectedCb for different item types
let sfxPlayed = "";
let sparkleColor = "";
let sparkleCount = 0;
game.audio.playEmeraldPickup = (): void => {
  sfxPlayed = "emerald";
};
game.audio.playAllDiamondsCaught = (): void => {
  sfxPlayed = "all_caught";
};
game.audio.playFuelPickup = (): void => {
  sfxPlayed = "fuel";
};
game.audio.playExtraLifePickup = (): void => {
  sfxPlayed = "extra_life";
};
game.audio.playRapidFirePickup = (): void => {
  sfxPlayed = "rapid_fire";
};
game.tileMap.addSparkles = (_x: number, _y: number, color: string, count: number): void => {
  sparkleColor = color;
  sparkleCount = count;
};

// Item: Emerald (single)
const emeraldPayload: ItemCollectedPayload = {
  col: 10,
  row: 12,
  tileType: TILES.EMERALD,
  collectedEmeralds: 3,
  isAllCaught: false,
};
game.network.onItemCollectedCb!(emeraldPayload);
assert.strictEqual(game.tileMap.collectedEmeralds, 3, "collectedEmeralds must update");
assert.strictEqual(sfxPlayed, "emerald", "Emerald SFX must play");
assert.strictEqual(sparkleColor, "#00e5ff", "Emerald sparkle color must match");
assert.strictEqual(sparkleCount, 12, "Emerald sparkle count must match");

// Item: Emerald (all caught)
emeraldPayload.isAllCaught = true;
game.network.onItemCollectedCb!(emeraldPayload);
assert.strictEqual(sfxPlayed, "all_caught", "All caught SFX must play");
assert.strictEqual(sparkleColor, "#00ff77", "All caught sparkle color must match");
assert.strictEqual(sparkleCount, 25, "All caught sparkle count must match");

// Item: Fuel
const fuelPayload: ItemCollectedPayload = {
  col: 10,
  row: 12,
  tileType: TILES.FUEL,
  collectedEmeralds: 3,
  isAllCaught: false,
};
game.network.onItemCollectedCb!(fuelPayload);
assert.strictEqual(sfxPlayed, "fuel", "Fuel pickup SFX must play");
assert.strictEqual(sparkleColor, "#ffaa00", "Fuel sparkle color must match");
assert.strictEqual(sparkleCount, 14, "Fuel sparkle count must match");

// Item: Extra Life
const lifePayload: ItemCollectedPayload = {
  col: 10,
  row: 12,
  tileType: TILES.EXTRA_LIFE,
  collectedEmeralds: 3,
  isAllCaught: false,
};
game.network.onItemCollectedCb!(lifePayload);
assert.strictEqual(sfxPlayed, "extra_life", "Extra life SFX must play");
assert.strictEqual(sparkleColor, "#ff88a5", "Extra life sparkle color must match");
assert.strictEqual(sparkleCount, 12, "Extra life sparkle count must match");

// Item: Rapid Fire
const rapidPayload: ItemCollectedPayload = {
  col: 10,
  row: 12,
  tileType: TILES.RAPID_FIRE,
  collectedEmeralds: 3,
  isAllCaught: false,
};
game.network.onItemCollectedCb!(rapidPayload);
assert.strictEqual(sfxPlayed, "rapid_fire", "Rapid fire SFX must play");
assert.strictEqual(sparkleColor, "#00f0ff", "Rapid fire sparkle color must match");
assert.strictEqual(sparkleCount, 15, "Rapid fire sparkle count must match");

// Test onEnemyDestroyedCb
let explosionPlayed = false;
game.audio.playExplosion = (): void => {
  explosionPlayed = true;
};
game.enemyManager.clear();
game.enemyManager.addFlitzer(100, 150, 2, 2);
const addedEnemy = game.enemyManager.enemies[0];
const enemyPayload: EnemyDestroyedPayload = {
  enemyId: addedEnemy.id,
};
game.network.onEnemyDestroyedCb!(enemyPayload);
assert.strictEqual(game.enemyManager.enemies.length, 0, "Enemy must be removed from EnemyManager");
assert.strictEqual(explosionPlayed, true, "Explosion audio must play");
assert.strictEqual(sparkleColor, "#ff0055", "Enemy destruction sparkles must match");

// Test onWorldSnapshotCb
game.gameState = GAME_STATES.PLAYING;
game.network.interpolationDelay = 80;
let snapshotApplied = false;
game.playerManager.updateFromSnapshot = (): void => {
  snapshotApplied = true;
};
const snapshotPayload: NetworkWorldSnapshotPayload = {
  timestamp: Date.now(),
  players: [
    ["sock_host_123", "p1", 120, 200, 1, 0, 90, 3, 500, 0, 0, 1],
  ],
  enemies: [],
  projectiles: [],
};
game.network.onWorldSnapshotCb!(snapshotPayload);
assert.strictEqual(snapshotApplied, true, "Snapshot must be applied to player manager");
assert.strictEqual(game.playerManager.interpolationDelay, 80, "Interpolation delay must update");

console.log("   ✅ All network event callbacks verified.\n");

// ── Test 3: Lobby View & Dropdown Management ────────────────────────────────
console.log("3️⃣  Testing Lobby View & Dropdown Management...");

// showLobbyView
controller.showLobbyView();
const viewCreate = mockDocument.getElementById("viewCreateRoom");
const viewPublic = mockDocument.getElementById("viewPublicRooms");
const viewLobby = mockDocument.getElementById("viewRoomLobby");
const mpTabs = mockDocument.getElementById("mpTabs");
const mpProfileSetup = mockDocument.getElementById("mpProfileSetup");

assert.strictEqual(viewCreate?.classList.contains("hidden"), true, "viewCreateRoom must be hidden");
assert.strictEqual(viewPublic?.classList.contains("hidden"), true, "viewPublicRooms must be hidden");
assert.strictEqual(viewLobby?.classList.contains("hidden"), false, "viewRoomLobby must be visible");
assert.strictEqual(mpTabs?.classList.contains("hidden"), true, "mpTabs must be hidden in lobby");
assert.strictEqual(mpProfileSetup?.classList.contains("hidden"), true, "mpProfileSetup must be hidden in lobby");

// populateLevelDropdown
const mockSelect = createMockElement("testSelectLevel", "select");
let fetchedCustomLevels = false;
game.levelManager.fetchCustomLevels = async (): Promise<CustomLevelHeader[]> => {
  fetchedCustomLevels = true;
  return [
    {
      id: "custom_1",
      name: "Sky Fortress",
      authorId: "user_1",
      authorName: "Captain",
      createdAt: 1000,
      updatedAt: 1000,
      highScore: 5000,
      highScoreUser: "Ace",
      averageRating: 4.8,
      ratingCount: 5,
      isReleased: true,
    },
  ];
};

await controller.populateLevelDropdown(mockSelect as unknown as HTMLSelectElement);
assert.strictEqual(fetchedCustomLevels, true, "fetchCustomLevels must be called");
const optgroups = mockSelect.children.filter((c) => c.tagName === "OPTGROUP");
assert.strictEqual(optgroups.length, 2, "Must contain Campaign Levels and Saved Custom Levels optgroups");
assert.strictEqual(optgroups[0].label, "Campaign Levels", "First group should be Campaign Levels");
assert.strictEqual(optgroups[0].children.length, CAMPAIGN_LEVELS.length, "Must include all campaign levels");
assert.strictEqual(optgroups[1].label, "Saved Custom Levels", "Second group should be Saved Custom Levels");
assert.strictEqual(optgroups[1].children.length, 1, "Must include 1 custom level");
assert.strictEqual(optgroups[1].children[0].value, "custom_db_custom_1", "Custom level option value must match format");

// handleLevelSelectChange with custom level
let fetchedCustomId = "";
game.levelManager.fetchCustomLevelById = async (id: string): Promise<CustomLevelRecord | null> => {
  fetchedCustomId = id;
  return {
    id,
    name: "Sky Fortress",
    authorId: "user_1",
    authorName: "Captain",
    createdAt: 1000,
    updatedAt: 1000,
    grid: new Array(540).fill(0),
    highScore: 5000,
    highScoreUser: "Ace",
    averageRating: 4.8,
    ratingCount: 5,
    ratingSum: 24,
    isReleased: true,
  };
};

mockSelect.value = "custom_db_custom_1";
await controller.handleLevelSelectChange(mockSelect as unknown as HTMLSelectElement);
assert.strictEqual(fetchedCustomId, "custom_1", "Custom level ID must be extracted and fetched");
const mapPayload = controller.customMapDataPayload as MultiplayerLevelData | null;
assert.ok(mapPayload, "customMapDataPayload must be populated");
assert.strictEqual(mapPayload?.name, "Sky Fortress", "Map payload name must match");

// handleLevelSelectChange with campaign level
mockSelect.value = "2";
await controller.handleLevelSelectChange(mockSelect as unknown as HTMLSelectElement);
assert.strictEqual(controller.customMapDataPayload, null, "customMapDataPayload must reset to null for campaign level");

console.log("   ✅ Lobby view and level dropdown population verified.\n");

// ── Test 4: updateLobbyUI for Host & Client ─────────────────────────────────
console.log("4️⃣  Testing updateLobbyUI (Host & Non-Host States)...");

const lobbyRoom: MultiplayerRoomInfo = {
  id: "MP99",
  hostSocketId: "sock_host_123",
  mapName: "Stage 3: Conveyor",
  levelIndex: 2,
  maxPlayers: 4,
  gameMode: MULTIPLAYER_MODES.COMPETE,
  status: "lobby",
  players: [
    { id: "p1", name: "HostPilot", socketId: "sock_host_123", color: "#ff4444", isHost: true },
    { id: "p2", name: "RivalPilot", socketId: "sock_client_456", color: "#00ffcc", isHost: false },
  ],
};

// Host Perspective with 2 players (can start)
game.network.socketId = "sock_host_123";
controller.updateLobbyUI(lobbyRoom);

const displayRoomCode = mockDocument.getElementById("displayRoomCode");
const lobbyPlayerCount = mockDocument.getElementById("lobbyPlayerCount");
const displayRoomGameMode = mockDocument.getElementById("displayRoomGameMode");
const btnStartMultiplayerGame = mockDocument.getElementById("btnStartMultiplayerGame");
const lobbyPlayerList = mockDocument.getElementById("lobbyPlayerList");

assert.strictEqual(displayRoomCode?.textContent, "MP99", "Room code must display MP99");
assert.strictEqual(lobbyPlayerCount?.textContent, "2", "Player count must display 2");
assert.strictEqual(displayRoomGameMode?.textContent, "⚔️ COMPETE", "Game mode text must indicate COMPETE");
assert.strictEqual(btnStartMultiplayerGame?.classList.contains("hidden"), false, "Start button must be visible for host");
assert.strictEqual(btnStartMultiplayerGame?.disabled, false, "Start button must be enabled with 2 players");
assert.strictEqual(btnStartMultiplayerGame?.textContent, "🚀 START MULTIPLAYER", "Start button text must be START MULTIPLAYER");
assert.strictEqual(lobbyPlayerList?.children.length, 2, "2 player cards must be rendered");

// Host Perspective with 1 player (waiting for players)
const singlePlayerRoom: MultiplayerRoomInfo = {
  ...lobbyRoom,
  players: [lobbyRoom.players[0]],
};
controller.updateLobbyUI(singlePlayerRoom);
assert.strictEqual(btnStartMultiplayerGame?.disabled, true, "Start button must be disabled with 1 player");
assert.strictEqual(btnStartMultiplayerGame?.textContent, "⌛ WAITING FOR PLAYERS", "Button text must indicate waiting for players");

// Non-Host / Client Perspective
game.network.socketId = "sock_client_456";
controller.updateLobbyUI(lobbyRoom);
assert.strictEqual(btnStartMultiplayerGame?.classList.contains("hidden"), true, "Start button must be hidden for non-host");
const displayRoomMapName = mockDocument.getElementById("displayRoomMapName");
assert.strictEqual(displayRoomMapName?.textContent, "Stage 3: Conveyor", "Map name must display for client");

console.log("   ✅ updateLobbyUI host and non-host logic verified.\n");

// ── Test 5: Public Rooms List Rendering ─────────────────────────────────────
console.log("5️⃣  Testing renderPublicRoomsList...");

const publicRoomsList = mockDocument.getElementById("publicRoomsList");

// Empty List
controller.renderPublicRoomsList([]);
assert.strictEqual(
  publicRoomsList?.innerHTML,
  '<p class="empty-list-note">No active public rooms found. Create one!</p>',
  "Empty list note must be rendered when 0 rooms",
);

// Active Rooms List
const samplePublicRooms: PublicRoomInfo[] = [
  {
    id: "PUB1",
    mapName: "Stage 1: Cavern",
    levelIndex: 0,
    gameMode: MULTIPLAYER_MODES.COOP,
    playerCount: 1,
    maxPlayers: 4,
    status: "lobby",
  },
  {
    id: "PUB2",
    mapName: "Stage 4: Core",
    levelIndex: 3,
    gameMode: MULTIPLAYER_MODES.COMPETE,
    playerCount: 2,
    maxPlayers: 2,
    status: "playing",
  },
];

let joinedRoomId = "";
game.network.joinRoom = (roomId: string): void => {
  joinedRoomId = roomId;
};

controller.renderPublicRoomsList(samplePublicRooms);
assert.strictEqual(publicRoomsList?.children.length, 2, "Must render 2 room cards");

// Simulate clicking on the first public room
const firstRoomCard = publicRoomsList?.children[0];
firstRoomCard?.click();
assert.strictEqual(joinedRoomId, "PUB1", "Clicking room card must trigger network.joinRoom for PUB1");

console.log("   ✅ Public rooms list rendering and click handlers verified.\n");

// ── Test 6: Starting Multiplayer Match (startMultiplayerMatch) ──────────────
console.log("6️⃣  Testing startMultiplayerMatch Lifecycle...");

let musicStartedLevel: number | null = null;
game.audio.startGameMusic = (levelIndex: number): void => {
  musicStartedLevel = levelIndex;
};
let closedDialogs = false;
game.uiManager.closeAllDialogs = (): void => {
  closedDialogs = true;
};

const matchRoom: MultiplayerRoomInfo = {
  id: "MATCH1",
  hostSocketId: "sock_host_123",
  mapName: "Stage 2: Assembly",
  levelIndex: 1,
  maxPlayers: 4,
  gameMode: MULTIPLAYER_MODES.COOP,
  status: "playing",
  players: [
    { id: "p1", name: "HostPilot", socketId: "sock_host_123", color: "#ff4444", isHost: true },
    { id: "p2", name: "Wingman", socketId: "sock_client_456", color: "#00ffcc", isHost: false },
  ],
};

game.network.socketId = "sock_host_123";
game.network.currentRoom = matchRoom;

controller.startMultiplayerMatch({
  success: true,
  room: matchRoom,
  levelIndex: 1,
});

assert.strictEqual(game.isMultiplayer, true, "isMultiplayer must be set to true");
assert.strictEqual(game.isCustomLevel, false, "isCustomLevel must be false for campaign level");
assert.strictEqual(game.currentLevelIndex, 1, "currentLevelIndex must update to 1");
assert.strictEqual(game.gameState, GAME_STATES.PLAYING, "gameState must transition to PLAYING");
assert.strictEqual(musicStartedLevel, 1, "Game music must start for level 1");
assert.strictEqual(closedDialogs, true, "Dialogs must be closed on match start");
assert.strictEqual(bannerMessage, "CO-OP MATCH STARTED!", "Banner must announce CO-OP match start");
assert.ok(game.player, "Local player must be assigned to game.player");
assert.strictEqual(game.player?.name, "HostPilot", "Local player name must match HostPilot");

// Test Compete mode start banner
const competeMatchRoom: MultiplayerRoomInfo = {
  ...matchRoom,
  gameMode: MULTIPLAYER_MODES.COMPETE,
};
controller.startMultiplayerMatch({
  success: true,
  room: competeMatchRoom,
  levelIndex: 0,
});
assert.strictEqual(bannerMessage, "COMPETE MATCH STARTED - LAST PILOT STANDING!", "Banner must announce COMPETE match start");

console.log("   ✅ startMultiplayerMatch lifecycle verified.\n");

// ── Test 7: Match Completion & Results (renderMultiplayerResults) ────────────
console.log("7️⃣  Testing Match Completion, Results Ranking & Game Over...");

// renderMultiplayerResults
const testPlayers: MultiplayerPlayer[] = [
  { id: "p2", name: "Beta", socketId: "sock_beta", color: "#ffaa00", isHost: false, score: 850, fuel: 45, lives: 2 },
  { id: "p1", name: "Alpha", socketId: "sock_alpha", color: "#ff4444", isHost: true, score: 1200, fuel: 75, lives: 3 },
  { id: "p3", name: "Charlie", socketId: "sock_charlie", color: "#00ffcc", isHost: false, score: 850, fuel: 20, lives: 1 },
];

game.network.socketId = "sock_alpha";
controller.renderMultiplayerResults("multiplayerLevelResults", "levelResultsBody", testPlayers);

const resultsTableBody = mockDocument.getElementById("levelResultsBody");
assert.strictEqual(resultsTableBody?.children.length, 3, "Must render 3 player rows in results table");

// First row should be Alpha (highest score 1200) and have local-player class
const firstRow = resultsTableBody?.children[0];
assert.strictEqual(firstRow?.children[1].textContent, "Alpha", "Highest score player must be ranked 1st");
assert.strictEqual(firstRow?.classList.contains("local-player"), true, "Local player row must have local-player class");

// Second and third rows should be sorted alphabetically on score tie (Alpha < Beta < Charlie)
const secondRow = resultsTableBody?.children[1];
const thirdRow = resultsTableBody?.children[2];
assert.strictEqual(secondRow?.children[1].textContent, "Beta", "Tie-break should place Beta 2nd");
assert.strictEqual(thirdRow?.children[1].textContent, "Charlie", "Tie-break should place Charlie 3rd");

// triggerMultiplayerLevelComplete
let portalWarpPlayed = false;
game.audio.playPortalWarp = (): void => {
  portalWarpPlayed = true;
};
let dialogShown = "";
game.uiManager.showDialog = (dialogId: string): void => {
  dialogShown = dialogId;
};

const levelCompletePayload: LevelCompletePayload = {
  success: true,
  room: matchRoom,
  clearedBy: "HostPilot",
  players: testPlayers,
};

game.player.fuel = 50;
game.player.score = 2000;
controller.triggerMultiplayerLevelComplete(levelCompletePayload);

assert.strictEqual(game.gameState, GAME_STATES.LEVEL_COMPLETE, "gameState must transition to LEVEL_COMPLETE");
assert.strictEqual(portalWarpPlayed, true, "Portal warp SFX must play");
assert.strictEqual(dialogShown, "dlgLevelComplete", "dlgLevelComplete dialog must be shown");

const statLevelScore = mockDocument.getElementById("statLevelScore");
const statFuelBonus = mockDocument.getElementById("statFuelBonus");
const statTotalScore = mockDocument.getElementById("statTotalScore");
assert.strictEqual(statLevelScore?.textContent, "1000", "Base level score must be 1000");
assert.strictEqual(statFuelBonus?.textContent, "500", "Fuel bonus must be 50 * 10 = 500");
assert.strictEqual(statTotalScore?.textContent, "3500", "Total score must be 2000 + 1000 + 500 = 3500");

// updateLevelCompleteHostState (Host vs Non-Host)
const btnNextLevel = mockDocument.getElementById("btnNextLevel");
game.network.socketId = "sock_host_123";
controller.updateLevelCompleteHostState(matchRoom);
assert.strictEqual(btnNextLevel?.disabled, false, "Host must have Next Level button enabled");
assert.strictEqual(btnNextLevel?.textContent, "🚀 NEXT LEVEL", "Host button text must be NEXT LEVEL");

game.network.socketId = "sock_client_456";
controller.updateLevelCompleteHostState(matchRoom);
assert.strictEqual(btnNextLevel?.disabled, true, "Non-host must have Next Level button disabled");
assert.strictEqual(btnNextLevel?.textContent, "⌛ WAITING FOR HOST...", "Non-host text must be WAITING FOR HOST");

// triggerMultiplayerGameOver (Co-op vs Compete)
const coopGameOverPayload: GameOverPayload = {
  room: matchRoom,
  players: testPlayers,
};
controller.triggerMultiplayerGameOver(coopGameOverPayload);
assert.strictEqual(game.gameState, GAME_STATES.GAME_OVER, "gameState must transition to GAME_OVER");
assert.strictEqual(dialogShown, "dlgGameOver", "dlgGameOver dialog must be shown");
const gameOverTitle = mockDocument.getElementById("gameOverTitle");
assert.strictEqual(gameOverTitle?.textContent, "GAME OVER", "Co-op game over title must be GAME OVER");

const competeGameOverPayload: GameOverPayload = {
  room: competeMatchRoom,
  reason: "compete_match_complete",
  winnerName: "Alpha",
  players: testPlayers,
};
controller.triggerMultiplayerGameOver(competeGameOverPayload);
assert.strictEqual(gameOverTitle?.textContent, "MATCH OVER", "Compete game over title must be MATCH OVER");
const gameOverMessage = mockDocument.getElementById("gameOverMessage");
assert.strictEqual(gameOverMessage?.textContent, "🏆 ALPHA WINS!", "Compete winner message must display winner name");

// updateGameOverHostState
const btnRetryLevel = mockDocument.getElementById("btnRetryLevel");
game.network.socketId = "sock_host_123";
controller.updateGameOverHostState(matchRoom);
assert.strictEqual(btnRetryLevel?.disabled, false, "Host retry button must be enabled");
assert.strictEqual(btnRetryLevel?.textContent, "🔄 RETRY MATCH", "Multiplayer retry button text must be RETRY MATCH");

game.network.socketId = "sock_client_456";
controller.updateGameOverHostState(matchRoom);
assert.strictEqual(btnRetryLevel?.disabled, true, "Non-host retry button must be disabled");

console.log("   ✅ Match completion, results table and Game Over mechanics verified.\n");

// ── Test 8: UI Event Bindings (bindMultiplayerUI) ───────────────────────────
console.log("8️⃣  Testing bindMultiplayerUI Event Handlers...");

// Create color chips and radio buttons in mock DOM
const chipRed = createMockElement("chipRed", "div");
chipRed.classList.add("color-chip");
chipRed.dataset.color = "#ff4444";

const chipCyan = createMockElement("chipCyan", "div");
chipCyan.classList.add("color-chip");
chipCyan.dataset.color = "#00ffcc";

const radioCoop = createMockElement("radioCoop", "input");
radioCoop.setAttribute("name", "mpGameMode");
radioCoop.value = "coop";
radioCoop.checked = true;

const inputHostName = createMockElement("inputHostName", "input");
inputHostName.value = "CommanderJet";

mockDocument.body.appendChild(chipRed);
mockDocument.body.appendChild(chipCyan);
mockDocument.body.appendChild(radioCoop);
mockDocument.body.appendChild(inputHostName);

controller.bindMultiplayerUI();

// Test Host Name Input & localStorage persistence
inputHostName.value = "CommanderJet";
inputHostName.dispatchEvent({ type: "input" });
assert.strictEqual(mockLocalStorage.getItem("jetpack_player_name"), "CommanderJet", "Player name must persist to localStorage");

// Test Color Chip Click
chipRed.click();
assert.strictEqual(game.selectedColor, "#ff4444", "selectedColor must update to #ff4444 on chip click");
assert.strictEqual(mockLocalStorage.getItem("jetpack_player_color"), "#ff4444", "Player color must persist to localStorage");

// Test Tab Switching (Create vs Public)
const tabCreate = mockDocument.getElementById("tabCreateRoom");
const tabPublic = mockDocument.getElementById("tabPublicRooms");
let listRoomsCalled = false;
game.network.listRooms = (): void => {
  listRoomsCalled = true;
};

tabPublic?.click();
assert.strictEqual(tabPublic?.classList.contains("active"), true, "Public tab must be active after click");
assert.strictEqual(listRoomsCalled, true, "Switching to Public tab must call listRooms");

tabCreate?.click();
assert.strictEqual(tabCreate?.classList.contains("active"), true, "Create tab must be active after click");

// Test Create Room Submission
let createRoomOptions: unknown = null;
game.network.createRoom = (opts): void => {
  createRoomOptions = opts;
};

const selectRoomLevel = mockDocument.getElementById("selectRoomLevel");
if (selectRoomLevel) selectRoomLevel.value = "3";
const btnCreateSubmit = mockDocument.getElementById("btnCreateRoomSubmit");
btnCreateSubmit?.click();

assert.ok(createRoomOptions, "createRoom must be called");
const parsedOpts = createRoomOptions as { playerName: string; playerColor: string; gameMode: string; levelIndex: number };
assert.strictEqual(parsedOpts.playerName, "CommanderJet", "Created room playerName must match inputHostName");
assert.strictEqual(parsedOpts.playerColor, "#ff4444", "Created room playerColor must match selectedColor");
assert.strictEqual(parsedOpts.levelIndex, 3, "Created room levelIndex must match selected level");
assert.strictEqual(parsedOpts.gameMode, MULTIPLAYER_MODES.COOP, "Created room gameMode must match radio");

// Test Leave Room Button
let leaveRoomCalled = false;
game.network.leaveRoom = (cb?: () => void): void => {
  leaveRoomCalled = true;
  if (cb) cb();
};
const btnLeaveRoom = mockDocument.getElementById("btnLeaveRoom");
btnLeaveRoom?.click();
assert.strictEqual(leaveRoomCalled, true, "btnLeaveRoom must call network.leaveRoom");

// Test Start Multiplayer Match Button (>= 2 players required)
let startMatchCalled = false;
game.network.startMatch = (): void => {
  startMatchCalled = true;
};
game.network.currentRoom = singlePlayerRoom; // 1 player
const btnStartMP = mockDocument.getElementById("btnStartMultiplayerGame");
btnStartMP?.click();
assert.strictEqual(startMatchCalled, false, "startMatch must NOT be called with only 1 player");
assert.strictEqual(bannerMessage, "NEED AT LEAST 2 PLAYERS TO START!", "Banner must warn when < 2 players");

game.network.currentRoom = matchRoom; // 2 players
btnStartMP?.click();
assert.strictEqual(startMatchCalled, true, "startMatch must be called with >= 2 players");

// Test Close Multiplayer Button
leaveRoomCalled = false;
const btnCloseMP = mockDocument.getElementById("btnCloseMultiplayer");
btnCloseMP?.click();
assert.strictEqual(leaveRoomCalled, true, "btnCloseMultiplayer must call network.leaveRoom");
assert.strictEqual(dialogShown, "dlgMainMenu", "btnCloseMultiplayer must show dlgMainMenu");

game.loop.stop();
console.log("🎉 ALL MULTIPLAYER CONTROLLER UNIT TESTS PASSED CLEANLY!");
process.exit(0);
