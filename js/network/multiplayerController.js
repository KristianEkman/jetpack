/* ==========================================================================
   MULTIPLAYER CONTROLLER
   Handles Socket.IO network event bindings, lobby views, room lists, and multiplayer match lifecycle.
   ========================================================================== */

import { GAME_STATES } from '../game.js';
import { CAMPAIGN_LEVELS } from '../levels/campaign.js';
import { TILE_SIZE, TILES } from '../world/tilemap.js';

export class MultiplayerController {
    constructor(game) {
        this.game = game;
        this.customMapDataPayload = null;
    }

    initNetwork() {
        const game = this.game;

        game.network.onRoomCreatedCb = (data) => {
            game.playerManager.setLocalSocketId(game.network.socketId);
            this.updateLobbyUI(data.room);
            this.showLobbyView();
            game.uiManager.showBanner(`ROOM ${data.roomId} CREATED!`);
        };

        game.network.onRoomJoinedCb = (data) => {
            game.playerManager.setLocalSocketId(game.network.socketId);
            this.updateLobbyUI(data.room);
            this.showLobbyView();
            game.uiManager.showBanner(`JOINED ROOM ${data.room.id}!`);
        };

        game.network.onPlayerJoinedCb = (data) => {
            if (data.room) this.updateLobbyUI(data.room);
            if (data.player) game.uiManager.showBanner(`${data.player.name.toUpperCase()} JOINED!`);
        };

        game.network.onPlayerLeftCb = (data) => {
            if (data.room) this.updateLobbyUI(data.room);
            if (data.leavingPlayer) game.uiManager.showBanner(`${data.leavingPlayer.name.toUpperCase()} LEFT`);
        };

        game.network.onGameStartedCb = (payload) => {
            this.startMultiplayerMatch(payload);
        };

        game.network.onTilePhasedCb = (data) => {
            if (game.isMultiplayer && game.tileMap && data) {
                game.tileMap.phaseTile(data.col, data.row);
            }
        };

        game.network.onTileRestoredCb = (data) => {
            if (game.isMultiplayer && game.tileMap && data) {
                game.tileMap.restoreTile(data.col, data.row);
            }
        };

        game.network.onItemCollectedCb = (data) => {
            if (game.isMultiplayer && game.tileMap && data) {
                game.tileMap.setTile(data.col, data.row, TILES.AIR);
                game.tileMap.collectedEmeralds = data.collectedEmeralds;
                if (data.tileType === TILES.EMERALD) {
                    if (data.isAllCaught) {
                        game.audio?.playAllDiamondsCaught?.();
                        game.tileMap.addSparkles(data.col * TILE_SIZE + 16, data.row * TILE_SIZE + 16, '#00e5ff', 25);
                        game.tileMap.addSparkles(data.col * TILE_SIZE + 16, data.row * TILE_SIZE + 16, '#00ff77', 25);
                    } else {
                        game.audio?.playEmeraldPickup?.();
                        game.tileMap.addSparkles(data.col * TILE_SIZE + 16, data.row * TILE_SIZE + 16, '#00e5ff', 12);
                    }
                } else if (data.tileType === TILES.FUEL) {
                    game.audio?.playFuelPickup?.();
                    game.tileMap.addSparkles(data.col * TILE_SIZE + 16, data.row * TILE_SIZE + 16, '#ffaa00', 14);
                } else if (data.tileType === TILES.GOLD) {
                    game.audio?.playEmeraldPickup?.();
                    game.tileMap.addSparkles(data.col * TILE_SIZE + 16, data.row * TILE_SIZE + 16, '#f1c40f', 10);
                }
            }
        };

        game.network.onLevelCompleteCb = (data) => {
            if (game.isMultiplayer) {
                this.triggerMultiplayerLevelComplete(data);
            }
        };

        game.network.onWorldSnapshotCb = (snapshot) => {
            if (game.isMultiplayer && game.gameState === GAME_STATES.PLAYING) {
                game.playerManager.updateFromSnapshot(snapshot.players);
                const localPlayer = game.playerManager.getLocalPlayer();
                if (localPlayer) {
                    game.player = localPlayer;
                }
            }
        };

        game.network.onRoomListCb = (list) => {
            this.renderPublicRoomsList(list);
        };

        game.network.onErrorCb = (errMsg) => {
            alert(`Multiplayer Error: ${errMsg}`);
        };
    }

    bindMultiplayerUI() {
        const game = this.game;
        const tabCreate = document.getElementById('tabCreateRoom');
        const tabPublic = document.getElementById('tabPublicRooms');

        const viewCreate = document.getElementById('viewCreateRoom');
        const viewPublic = document.getElementById('viewPublicRooms');
        const viewLobby = document.getElementById('viewRoomLobby');

        const switchTab = (activeTab, activeView) => {
            [tabCreate, tabPublic].forEach(t => t?.classList.remove('active'));
            [viewCreate, viewPublic, viewLobby].forEach(v => v?.classList.add('hidden'));

            activeTab?.classList.add('active');
            activeView?.classList.remove('hidden');

            document.getElementById('mpTabs')?.classList.remove('hidden');
            document.getElementById('mpProfileSetup')?.classList.remove('hidden');
        };

        tabCreate?.addEventListener('click', () => switchTab(tabCreate, viewCreate));
        tabPublic?.addEventListener('click', () => {
            switchTab(tabPublic, viewPublic);
            game.network.listRooms();
        });

        // Level / Custom Map Selection Controls
        const selectLevel = document.getElementById('selectRoomLevel');
        const uploadGroup = document.getElementById('groupCustomMapUpload');
        const fileInput = document.getElementById('inputCustomMapFile');
        const statusText = document.getElementById('customMapStatusText');

        selectLevel?.addEventListener('change', () => {
            if (selectLevel.value === 'custom') {
                uploadGroup?.classList.remove('hidden');
                try {
                    const saved = localStorage.getItem('jetpack_custom_level');
                    if (saved && !this.customMapDataPayload) {
                        this.customMapDataPayload = JSON.parse(saved);
                        if (statusText) statusText.textContent = `Using Editor map: "${this.customMapDataPayload.name || 'Custom Level'}"`;
                    }
                } catch (e) { }
            } else {
                uploadGroup?.classList.add('hidden');
            }
        });

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (parsed && Array.isArray(parsed.grid) && parsed.grid.length === 540) {
                        this.customMapDataPayload = parsed;
                        if (statusText) statusText.textContent = `Loaded map: "${parsed.name || file.name}" (${parsed.grid.length} tiles)`;
                    } else {
                        alert('Invalid level JSON file! Grid must contain 540 tiles (30x18).');
                    }
                } catch (err) {
                    alert('Error parsing map JSON file.');
                }
            };
            reader.readAsText(file);
        });

        // Color Picker Chips
        document.querySelectorAll('.color-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                game.selectedColor = chip.dataset.color || '#ff4444';
            });
        });

        // Form Submit Buttons
        document.getElementById('btnCreateRoomSubmit')?.addEventListener('click', () => {
            const hostName = document.getElementById('inputHostName')?.value.trim() || 'Host Pilot';
            const levelVal = document.getElementById('selectRoomLevel')?.value || '0';

            const createOpts = {
                playerName: hostName,
                playerColor: game.selectedColor
            };

            if (levelVal === 'custom') {
                if (!this.customMapDataPayload) {
                    try {
                        const saved = localStorage.getItem('jetpack_custom_level');
                        if (saved) this.customMapDataPayload = JSON.parse(saved);
                    } catch (e) { }
                }
                if (!this.customMapDataPayload) {
                    alert('Please upload a valid custom map JSON file or build one in the Level Editor!');
                    return;
                }
                createOpts.customMapData = this.customMapDataPayload;
            } else {
                createOpts.levelIndex = parseInt(levelVal, 10);
            }

            game.network.createRoom(createOpts);
        });

        document.getElementById('btnRefreshRooms')?.addEventListener('click', () => {
            game.network.listRooms();
        });

        document.getElementById('btnLeaveRoom')?.addEventListener('click', () => {
            game.network.leaveRoom(() => {
                switchTab(tabCreate, viewCreate);
                game.uiManager.showBanner('LEFT ROOM');
            });
        });

        document.getElementById('btnStartMultiplayerGame')?.addEventListener('click', () => {
            game.network.startMatch();
        });

        document.getElementById('btnCloseMultiplayer')?.addEventListener('click', () => {
            game.network.leaveRoom();
            game.uiManager.showDialog('dlgMainMenu');
        });
    }

    showLobbyView() {
        const viewCreate = document.getElementById('viewCreateRoom');
        const viewPublic = document.getElementById('viewPublicRooms');
        const viewLobby = document.getElementById('viewRoomLobby');

        [viewCreate, viewPublic].forEach(v => v?.classList.add('hidden'));
        viewLobby?.classList.remove('hidden');

        document.getElementById('mpTabs')?.classList.add('hidden');
        document.getElementById('mpProfileSetup')?.classList.add('hidden');
    }

    updateLobbyUI(room) {
        if (!room) return;

        const codeEl = document.getElementById('displayRoomCode');
        if (codeEl) codeEl.textContent = room.id;

        const countEl = document.getElementById('lobbyPlayerCount');
        if (countEl) countEl.textContent = `${room.players.length}`;

        const mapNameEl = document.getElementById('displayRoomMapName');
        if (mapNameEl) {
            mapNameEl.textContent = room.mapName || `Level ${(room.levelIndex || 0) + 1}`;
        }

        const listEl = document.getElementById('lobbyPlayerList');
        if (!listEl) return;
        listEl.innerHTML = '';

        const isHost = (this.game.network.socketId === room.hostSocketId);
        const startBtn = document.getElementById('btnStartMultiplayerGame');

        if (startBtn) {
            if (isHost) {
                startBtn.classList.remove('hidden');
            } else {
                startBtn.classList.add('hidden');
            }
        }

        room.players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'lobby-player-card';
            card.innerHTML = `
                <div class="player-info-group">
                    <div class="player-color-dot" style="background: ${p.color};"></div>
                    <span class="player-name-text">${p.name} ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}</span>
                </div>
                <span style="font-size: 0.8rem; color: #00ffcc;">READY</span>
            `;
            listEl.appendChild(card);
        });
    }

    renderPublicRoomsList(list) {
        try {
            const container = document.getElementById('publicRoomsList');
            if (!container) {
                console.warn('publicRoomsList element not found in DOM');
                return;
            }
            container.innerHTML = '';

            if (!list || list.length === 0) {
                container.innerHTML = '<p class="empty-list-note">No active public rooms found. Create one!</p>';
                return;
            }

            list.forEach(r => {
                const row = document.createElement('div');
                row.className = 'lobby-player-card';
                row.style.cursor = 'pointer';
                const statusBadge = (r.status === 'playing') ?
                    '<span style="font-size: 0.75rem; color: #ffaa00; background: rgba(255,170,0,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">[PLAYING]</span>' :
                    '<span style="font-size: 0.75rem; color: #00ffcc; background: rgba(0,255,204,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">[LOBBY]</span>';

                row.innerHTML = `
                    <div class="player-info-group">
                        <strong style="color: #00f0ff; letter-spacing: 2px;">${r.id}</strong>
                        <span style="font-size: 0.85rem; color: #aaa;">(${r.playerCount}/${r.maxPlayers} Pilots)</span>
                        <span style="font-size: 0.8rem; color: #ffee55;">[${r.mapName || 'Map'}]</span>
                        ${statusBadge}
                    </div>
                    <button class="btn-editor primary">JOIN</button>
                `;

                row.addEventListener('click', () => {
                    const joinName = document.getElementById('inputHostName')?.value?.trim() || 'Wingman';
                    this.game.network.joinRoom(r.id, {
                        playerName: joinName,
                        playerColor: this.game.selectedColor
                    });
                });

                container.appendChild(row);
            });
        } catch (err) {
            console.error('❌ Error rendering public rooms list:', err);
        }
    }

    startMultiplayerMatch(payload = null) {
        const game = this.game;
        game.isMultiplayer = true;
        const room = payload?.room || game.network.currentRoom;

        let levelData = CAMPAIGN_LEVELS[0];
        if (payload?.customMapData) {
            levelData = payload.customMapData;
            game.isCustomLevel = true;
        } else if (room?.customMapData) {
            levelData = room.customMapData;
            game.isCustomLevel = true;
        } else if (payload?.levelIndex !== undefined) {
            game.currentLevelIndex = payload.levelIndex;
            levelData = CAMPAIGN_LEVELS[payload.levelIndex] || CAMPAIGN_LEVELS[0];
            game.isCustomLevel = false;
        } else if (room?.levelIndex !== undefined) {
            game.currentLevelIndex = room.levelIndex;
            levelData = CAMPAIGN_LEVELS[room.levelIndex] || CAMPAIGN_LEVELS[0];
            game.isCustomLevel = false;
        }

        game.tileMap.loadLevelData(levelData);
        game.enemyManager.clear();

        if (levelData.flitzers) {
            levelData.flitzers.forEach(f => game.enemyManager.addFlitzer(f.x, f.y, f.vx, f.vy));
        }
        if (levelData.missiles) {
            levelData.missiles.forEach(m => game.enemyManager.addHomingMissile(m.x, m.y));
        }
        if (levelData.turrets) {
            levelData.turrets.forEach(t => game.enemyManager.addTurret(t.x, t.y, t.fireInterval));
        }
        game.levelManager.spawnEnemiesFromGrid();

        game.playerManager.clear();
        game.playerManager.setLocalSocketId(game.network.socketId);

        if (room && room.players) {
            room.players.forEach(p => {
                game.playerManager.addPlayer(p.socketId, {
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    isLocal: p.socketId === game.network.socketId,
                    x: p.x || 128,
                    y: p.y || 100
                });
            });
        }

        const localPlayer = game.playerManager.getLocalPlayer();
        if (localPlayer) {
            game.player = localPlayer;
        }

        game.gameState = GAME_STATES.PLAYING;
        game.audio.startGameMusic(game.currentLevelIndex || 0);
        game.uiManager.closeAllDialogs();
        game.uiManager.showBanner('MULTIPLAYER MATCH STARTED!');
    }

    triggerMultiplayerLevelComplete(data) {
        const game = this.game;
        game.gameState = GAME_STATES.LEVEL_COMPLETE;
        game.audio.stopThrust();
        if (game.audio.stopEnergyDrain) game.audio.stopEnergyDrain();
        game.audio.stopMusic();
        game.audio.playPortalWarp();

        const fuelBonus = Math.floor((game.player ? game.player.fuel : 0) * 10);
        const levelScore = 1000 + fuelBonus;

        const statLevelScore = document.getElementById('statLevelScore');
        const statFuelBonus = document.getElementById('statFuelBonus');
        const statTotalScore = document.getElementById('statTotalScore');

        if (statLevelScore) statLevelScore.textContent = '1000';
        if (statFuelBonus) statFuelBonus.textContent = `${fuelBonus}`;
        if (statTotalScore) statTotalScore.textContent = `${(game.player ? game.player.score : 0) + levelScore}`;

        const sub = document.getElementById('dialogLevelCompleteSub');
        if (sub) {
            sub.textContent = `MATCH CLEARED BY ${data?.clearedBy ? data.clearedBy.toUpperCase() : 'TEAM'}!`;
        }

        game.uiManager.showDialog('dlgLevelComplete');
    }
}
