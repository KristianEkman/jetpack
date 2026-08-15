/* ==========================================================================
   SERVER HEALTH MONITOR UI CONTROLLER
   Fetches and visualizes telemetry from the GET /health backend endpoint,
   supports live polling, latency tracking, console reporting, and JSON export.
   ========================================================================== */

export interface ServerHealthVersion {
  commitHash?: string;
  deployedAt?: string;
}

export interface ServerHealthRooms {
  totalRooms: number;
  lobbyRooms?: number;
  playingRooms?: number;
  finishedRooms?: number;
  waitingRooms?: number;
  inGameRooms?: number;
  totalPlayers: number;
  inGamePlayers: number;
}

export interface ServerHealthPlayers {
  connectedSockets: number;
  totalInRooms: number;
  inActiveGame: number;
}

export interface ServerHealthGameLoop {
  isRunning?: boolean;
  tickRate: number;
  ticksTotal?: number;
  avgTickMs?: number;
  avgTickDurationMs?: number;
  maxTickMs?: number;
  maxTickDurationMs?: number;
  lastTickMs?: number;
  activeRooms?: number;
  activePlayingRoomsCount?: number;
}

export interface ServerHealthMemory {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
}

export interface ServerHealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  version?: ServerHealthVersion;
  activeRooms?: number;
  rooms?: ServerHealthRooms;
  players?: ServerHealthPlayers;
  gameLoop?: ServerHealthGameLoop;
  memory?: ServerHealthMemory;
}

export function formatUptime(seconds: number): string {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) {
    return "0s";
  }
  const sec = Math.floor(seconds);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSec = sec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${remainingSec}s`);

  return parts.join(" ");
}

export function formatBytes(mb: number): string {
  if (typeof mb !== "number" || isNaN(mb)) return "0.0 MB";
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export class ServerHealthUI {
  private static instance: ServerHealthUI | null = null;

  private modal: HTMLDialogElement | null = null;
  private statusBadge: HTMLElement | null = null;
  private pingBadge: HTMLElement | null = null;
  private uptimeValue: HTMLElement | null = null;
  private versionValue: HTMLElement | null = null;

  // Game Loop Elements
  private loopTickRate: HTMLElement | null = null;
  private loopAvgTick: HTMLElement | null = null;
  private loopMaxTick: HTMLElement | null = null;
  private loopStatus: HTMLElement | null = null;

  // Multiplayer Elements
  private roomsTotal: HTMLElement | null = null;
  private roomsLobby: HTMLElement | null = null;
  private roomsPlaying: HTMLElement | null = null;
  private socketsConnected: HTMLElement | null = null;
  private playersInGame: HTMLElement | null = null;

  // Memory Elements
  private memHeapUsed: HTMLElement | null = null;
  private memHeapTotal: HTMLElement | null = null;
  private memRss: HTMLElement | null = null;
  private memExternal: HTMLElement | null = null;
  private memProgressBar: HTMLElement | null = null;
  private memPercentText: HTMLElement | null = null;

  // Controls & Action Buttons
  private btnRefresh: HTMLButtonElement | null = null;
  private btnCopyJson: HTMLButtonElement | null = null;
  private btnLogConsole: HTMLButtonElement | null = null;
  private btnClose: HTMLButtonElement | null = null;
  private chkAutoRefresh: HTMLInputElement | null = null;
  private selectRefreshRate: HTMLSelectElement | null = null;
  private lastUpdatedText: HTMLElement | null = null;
  private actionNotice: HTMLElement | null = null;

  // Polling State
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isFetching: boolean = false;
  private latestData: ServerHealthResponse | null = null;
  private latestLatencyMs: number = 0;

  private constructor() {}

  public static getInstance(): ServerHealthUI {
    if (!ServerHealthUI.instance) {
      ServerHealthUI.instance = new ServerHealthUI();
    }
    return ServerHealthUI.instance;
  }

  public init(): void {
    this.modal = document.getElementById("dlgServerHealth") as HTMLDialogElement | null;
    if (!this.modal) return;

    this.statusBadge = document.getElementById("shStatusBadge");
    this.pingBadge = document.getElementById("shPingBadge");
    this.uptimeValue = document.getElementById("shUptimeValue");
    this.versionValue = document.getElementById("shVersionValue");

    this.loopTickRate = document.getElementById("shLoopTickRate");
    this.loopAvgTick = document.getElementById("shLoopAvgTick");
    this.loopMaxTick = document.getElementById("shLoopMaxTick");
    this.loopStatus = document.getElementById("shLoopStatus");

    this.roomsTotal = document.getElementById("shRoomsTotal");
    this.roomsLobby = document.getElementById("shRoomsLobby");
    this.roomsPlaying = document.getElementById("shRoomsPlaying");
    this.socketsConnected = document.getElementById("shSocketsConnected");
    this.playersInGame = document.getElementById("shPlayersInGame");

    this.memHeapUsed = document.getElementById("shMemHeapUsed");
    this.memHeapTotal = document.getElementById("shMemHeapTotal");
    this.memRss = document.getElementById("shMemRss");
    this.memExternal = document.getElementById("shMemExternal");
    this.memProgressBar = document.getElementById("shMemProgressBar");
    this.memPercentText = document.getElementById("shMemPercentText");

    this.btnRefresh = document.getElementById("btnShRefresh") as HTMLButtonElement | null;
    this.btnCopyJson = document.getElementById("btnShCopyJson") as HTMLButtonElement | null;
    this.btnLogConsole = document.getElementById("btnShLogConsole") as HTMLButtonElement | null;
    this.btnClose = document.getElementById("btnShClose") as HTMLButtonElement | null;
    this.chkAutoRefresh = document.getElementById("chkShAutoRefresh") as HTMLInputElement | null;
    this.selectRefreshRate = document.getElementById("selectShRefreshRate") as HTMLSelectElement | null;
    this.lastUpdatedText = document.getElementById("shLastUpdatedText");
    this.actionNotice = document.getElementById("shActionNotice");

    this.setupEventListeners();

    // Attach to global window for convenience and console usage
    if (typeof window !== "undefined") {
      (window as unknown as { serverHealth: ServerHealthUI; logServerHealth: () => void }).serverHealth = this;
      (window as unknown as { serverHealth: ServerHealthUI; logServerHealth: () => void }).logServerHealth = () => {
        this.logToConsole();
      };
    }
  }

  private setupEventListeners(): void {
    if (this.btnRefresh) {
      this.btnRefresh.addEventListener("click", () => {
        this.fetchHealth();
      });
    }

    if (this.btnCopyJson) {
      this.btnCopyJson.addEventListener("click", () => {
        this.copyJson();
      });
    }

    if (this.btnLogConsole) {
      this.btnLogConsole.addEventListener("click", () => {
        this.logToConsole();
        this.showNotice("Logged telemetry to browser DevTools console!");
      });
    }

    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => {
        this.closeModal();
      });
    }

    if (this.chkAutoRefresh) {
      this.chkAutoRefresh.addEventListener("change", () => {
        if (this.chkAutoRefresh?.checked) {
          const rate = parseInt(this.selectRefreshRate?.value || "2000", 10);
          this.startPolling(rate);
        } else {
          this.stopPolling();
        }
      });
    }

    if (this.selectRefreshRate) {
      this.selectRefreshRate.addEventListener("change", () => {
        if (this.chkAutoRefresh?.checked) {
          const rate = parseInt(this.selectRefreshRate?.value || "2000", 10);
          this.startPolling(rate);
        }
      });
    }

    // Version badge shortcut click
    const versionBadge = document.getElementById("gameVersionBadge");
    if (versionBadge) {
      versionBadge.style.cursor = "pointer";
      versionBadge.addEventListener("click", (e) => {
        // Prevent opening if error badge specifically clicked
        const target = e.target as HTMLElement;
        if (target && target.closest("#errorMonitorBadge")) return;
        this.openModal();
      });
    }

    // Main menu server health button
    const btnMenuHealth = document.getElementById("btnServerHealth");
    if (btnMenuHealth) {
      btnMenuHealth.addEventListener("click", () => {
        this.openModal();
      });
    }
  }

  public async fetchHealth(): Promise<ServerHealthResponse | null> {
    if (this.isFetching) return this.latestData;
    this.isFetching = true;

    if (this.btnRefresh) {
      this.btnRefresh.classList.add("spinning");
    }

    const startTime = performance.now();
    try {
      const response = await fetch("/health", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const latency = Math.round(performance.now() - startTime);
      this.latestLatencyMs = latency;

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: ServerHealthResponse = await response.json();
      this.latestData = data;
      this.render(data, latency);
      return data;
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      this.latestLatencyMs = latency;
      this.renderError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.isFetching = false;
      if (this.btnRefresh) {
        this.btnRefresh.classList.remove("spinning");
      }
    }
  }

  public render(data: ServerHealthResponse, latencyMs: number): void {
    if (this.statusBadge) {
      this.statusBadge.className = "sh-status-badge online";
      this.statusBadge.innerHTML = `<span class="sh-status-dot"></span> ONLINE`;
    }

    if (this.pingBadge) {
      const pingClass = latencyMs < 50 ? "good" : latencyMs < 150 ? "medium" : "poor";
      this.pingBadge.className = `sh-ping-badge ${pingClass}`;
      this.pingBadge.textContent = `⚡ ${latencyMs}ms RTT`;
    }

    if (this.uptimeValue) {
      this.uptimeValue.textContent = formatUptime(data.uptime);
    }

    if (this.versionValue) {
      const commit = data.version?.commitHash || "--";
      this.versionValue.textContent = commit;
      this.versionValue.title = `Deployed: ${data.version?.deployedAt || "Unknown"}`;
    }

    // Game Loop Telemetry
    const loop = data.gameLoop;
    if (this.loopTickRate) {
      this.loopTickRate.textContent = loop?.tickRate ? `${loop.tickRate} Hz` : "60 Hz";
    }

    const avgTick = loop?.avgTickMs ?? loop?.avgTickDurationMs ?? 0;
    if (this.loopAvgTick) {
      this.loopAvgTick.textContent = `${avgTick.toFixed(2)} ms`;
      this.loopAvgTick.style.color = avgTick < 5 ? "#33ff77" : avgTick < 12 ? "#ffcc00" : "#ff2a5f";
    }

    const maxTick = loop?.maxTickMs ?? loop?.maxTickDurationMs ?? 0;
    if (this.loopMaxTick) {
      this.loopMaxTick.textContent = `${maxTick.toFixed(2)} ms`;
      this.loopMaxTick.style.color = maxTick < 10 ? "#33ff77" : maxTick < 16 ? "#ffcc00" : "#ff2a5f";
    }

    if (this.loopStatus) {
      const isRunning = loop?.isRunning !== false;
      this.loopStatus.textContent = isRunning ? "RUNNING (60 FPS)" : "IDLE";
      this.loopStatus.style.color = isRunning ? "#00ffcc" : "#80a0bd";
    }

    // Multiplayer Rooms & Players
    const rooms = data.rooms;
    const players = data.players;

    if (this.roomsTotal) {
      this.roomsTotal.textContent = String(rooms?.totalRooms ?? data.activeRooms ?? 0);
    }

    const lobbyCount = rooms?.lobbyRooms ?? rooms?.waitingRooms ?? 0;
    if (this.roomsLobby) {
      this.roomsLobby.textContent = String(lobbyCount);
    }

    const playingCount = rooms?.playingRooms ?? rooms?.inGameRooms ?? 0;
    if (this.roomsPlaying) {
      this.roomsPlaying.textContent = String(playingCount);
    }

    if (this.socketsConnected) {
      this.socketsConnected.textContent = String(players?.connectedSockets ?? 0);
    }

    if (this.playersInGame) {
      this.playersInGame.textContent = String(players?.inActiveGame ?? rooms?.inGamePlayers ?? 0);
    }

    // Memory Breakdown
    const mem = data.memory;
    if (mem) {
      const used = mem.heapUsedMB ?? 0;
      const total = mem.heapTotalMB ?? Math.max(used, 1);
      const percent = Math.min(100, Math.round((used / total) * 100));

      if (this.memHeapUsed) this.memHeapUsed.textContent = formatBytes(used);
      if (this.memHeapTotal) this.memHeapTotal.textContent = formatBytes(total);
      if (this.memRss) this.memRss.textContent = formatBytes(mem.rssMB ?? 0);
      if (this.memExternal) this.memExternal.textContent = formatBytes(mem.externalMB ?? 0);

      if (this.memProgressBar) {
        this.memProgressBar.style.width = `${percent}%`;
        if (percent > 85) {
          this.memProgressBar.style.background = "linear-gradient(90deg, #ffcc00, #ff2a5f)";
        } else if (percent > 65) {
          this.memProgressBar.style.background = "linear-gradient(90deg, #00ffcc, #ffcc00)";
        } else {
          this.memProgressBar.style.background = "linear-gradient(90deg, #00ffcc, #33ff77)";
        }
      }

      if (this.memPercentText) {
        this.memPercentText.textContent = `${percent}% (${formatBytes(used)} / ${formatBytes(total)})`;
      }
    }

    if (this.lastUpdatedText) {
      const time = new Date().toLocaleTimeString();
      this.lastUpdatedText.textContent = `Last polled: ${time}`;
    }
  }

  public renderError(errorMessage: string): void {
    if (this.statusBadge) {
      this.statusBadge.className = "sh-status-badge offline";
      this.statusBadge.innerHTML = `<span class="sh-status-dot"></span> OFFLINE`;
    }

    if (this.pingBadge) {
      this.pingBadge.className = "sh-ping-badge poor";
      this.pingBadge.textContent = "⚡ DISCONNECTED";
    }

    if (this.uptimeValue) this.uptimeValue.textContent = "--";
    if (this.loopStatus) {
      this.loopStatus.textContent = `ERROR: ${errorMessage}`;
      this.loopStatus.style.color = "#ff2a5f";
    }

    if (this.lastUpdatedText) {
      this.lastUpdatedText.textContent = `Failed: ${new Date().toLocaleTimeString()} (${errorMessage})`;
    }
  }

  public startPolling(intervalMs: number = 2000): void {
    this.stopPolling();
    this.fetchHealth();
    this.pollTimer = setInterval(() => {
      if (this.modal?.open) {
        this.fetchHealth();
      }
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public openModal(): void {
    if (!this.modal) this.init();
    if (!this.modal) return;

    if (!this.modal.open) {
      this.modal.showModal();
    }

    const rate = parseInt(this.selectRefreshRate?.value || "2000", 10);
    const isAuto = this.chkAutoRefresh ? this.chkAutoRefresh.checked : true;
    if (isAuto) {
      this.startPolling(rate);
    } else {
      this.fetchHealth();
    }
  }

  public closeModal(): void {
    this.stopPolling();
    if (this.modal && this.modal.open) {
      this.modal.close();
    }
  }

  public async copyJson(): Promise<void> {
    if (!this.latestData) {
      await this.fetchHealth();
    }
    if (!this.latestData) {
      this.showNotice("No telemetry data available to copy.");
      return;
    }

    const jsonStr = JSON.stringify(this.latestData, null, 2);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonStr);
        this.showNotice("Telemetry JSON copied to clipboard! 📋");
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = jsonStr;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        this.showNotice("Telemetry JSON copied to clipboard! 📋");
      }
    } catch {
      this.showNotice("Could not copy JSON automatically.");
    }
  }

  public logToConsole(): void {
    const data = this.latestData;
    if (!data) {
      this.fetchHealth().then(() => this.logToConsole());
      return;
    }

    console.group(`%c🚀 JETPACK SERVER HEALTH & TELEMETRY REPORT [${new Date().toLocaleTimeString()}]`, "color:#00ffcc;font-weight:bold;font-size:13px;");
    console.log(`%cStatus: %c${data.status.toUpperCase()} %c| Uptime: %c${formatUptime(data.uptime)} %c| Latency: %c${this.latestLatencyMs}ms RTT`,
      "color:#80a0bd;", "color:#33ff77;font-weight:bold;",
      "color:#80a0bd;", "color:#00ffcc;font-weight:bold;",
      "color:#80a0bd;", "color:#ffcc00;font-weight:bold;"
    );

    console.table({
      "Game Loop": {
        "Tick Rate": `${data.gameLoop?.tickRate || 60} Hz`,
        "Avg Tick (ms)": data.gameLoop?.avgTickMs ?? data.gameLoop?.avgTickDurationMs ?? "N/A",
        "Max Tick (ms)": data.gameLoop?.maxTickMs ?? data.gameLoop?.maxTickDurationMs ?? "N/A",
        "State": data.gameLoop?.isRunning !== false ? "Running" : "Idle",
      },
      "Multiplayer": {
        "Total Rooms": data.rooms?.totalRooms ?? data.activeRooms ?? 0,
        "Lobby Rooms": data.rooms?.lobbyRooms ?? data.rooms?.waitingRooms ?? 0,
        "In-Game Rooms": data.rooms?.playingRooms ?? data.rooms?.inGameRooms ?? 0,
        "Connected Pilots": data.players?.connectedSockets ?? 0,
      },
      "Memory Allocation": {
        "Heap Used": formatBytes(data.memory?.heapUsedMB ?? 0),
        "Heap Total": formatBytes(data.memory?.heapTotalMB ?? 0),
        "RSS Resident": formatBytes(data.memory?.rssMB ?? 0),
        "External": formatBytes(data.memory?.externalMB ?? 0),
      },
    });

    console.log("%cRaw Server Response Payload:", "color:#80a0bd;", data);
    console.groupEnd();
  }

  private showNotice(msg: string): void {
    if (!this.actionNotice) return;
    this.actionNotice.textContent = msg;
    this.actionNotice.classList.remove("hidden");
    setTimeout(() => {
      if (this.actionNotice) {
        this.actionNotice.classList.add("hidden");
      }
    }, 2800);
  }
}

export const serverHealthUI = ServerHealthUI.getInstance();
