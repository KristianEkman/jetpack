/* ==========================================================================
   KONGREGATE API INTEGRATION SERVICE
   ========================================================================== */

interface KongregateServices {
  getUsername(): string;
  getUserId(): number;
  getGameAuthToken(): string;
  isGuest(): boolean;
  showRegistrationBox(): void;
  addEventListener(event: string, callback: () => void): void;
}

interface KongregateStats {
  submit(statName: string, value: number): void;
}

interface KongregateAPIInstance {
  services: KongregateServices;
  stats: KongregateStats;
}

interface KongregateGlobalAPI {
  loadAPI(callback: () => void): void;
  getAPI(): KongregateAPIInstance;
}

declare global {
  interface Window {
    kongregateAPI?: KongregateGlobalAPI;
    kongregate?: KongregateAPIInstance;
  }
}

export class KongregateService {
  private kongregate: KongregateAPIInstance | null = null;
  private initialized = false;
  private loginCallbacks: Array<(username: string, userId: number) => void> = [];

  constructor() {
    this.init();
  }

  public init(): void {
    if (typeof window === "undefined" || this.initialized) return;

    if (window.kongregate) {
      this.kongregate = window.kongregate;
      this.initialized = true;
      this.bindLoginListener();
      console.log("🎮 Kongregate API already active for pilot:", this.getUsername() ?? "Guest");
      this.triggerLoginIfAuthenticated();
      return;
    }

    if (window.kongregateAPI) {
      try {
        window.kongregateAPI.loadAPI(() => {
          this.kongregate = window.kongregateAPI?.getAPI() ?? null;
          if (this.kongregate) {
            window.kongregate = this.kongregate;
            this.initialized = true;
            this.bindLoginListener();
            console.log(
              "🎮 Kongregate API loaded successfully for pilot:",
              this.getUsername() ?? "Guest",
            );
            this.triggerLoginIfAuthenticated();
          }
        });
      } catch (err: unknown) {
        console.warn("⚠️ Failed to initialize Kongregate API:", err);
      }
    }
  }

  private bindLoginListener(): void {
    if (!this.kongregate) return;
    try {
      this.kongregate.services.addEventListener("login", () => {
        console.log("🎮 Kongregate login event received for pilot:", this.getUsername() ?? "Guest");
        this.triggerLoginIfAuthenticated();
      });
    } catch (err: unknown) {
      console.warn("Failed to attach Kongregate login listener:", err);
    }
  }

  private triggerLoginIfAuthenticated(): void {
    if (!this.isGuest()) {
      const username = this.getUsername();
      const userId = this.getUserId();
      if (username && userId !== null) {
        for (const cb of this.loginCallbacks) {
          try {
            cb(username, userId);
          } catch (e: unknown) {
            console.warn("Error in Kongregate login callback:", e);
          }
        }
      }
    }
  }

  public onLogin(callback: (username: string, userId: number) => void): void {
    this.loginCallbacks.push(callback);
    if (this.isAvailable() && !this.isGuest()) {
      const username = this.getUsername();
      const userId = this.getUserId();
      if (username && userId !== null) {
        try {
          callback(username, userId);
        } catch (e: unknown) {
          console.warn("Error in immediate Kongregate onLogin callback:", e);
        }
      }
    }
  }

  public isAvailable(): boolean {
    return this.kongregate !== null;
  }

  public isGuest(): boolean {
    if (!this.kongregate) return true;
    try {
      return this.kongregate.services.isGuest();
    } catch {
      return true;
    }
  }

  public getUsername(): string | null {
    if (!this.kongregate) return null;
    try {
      const username = this.kongregate.services.getUsername();
      return username && username !== "Guest" ? username : null;
    } catch {
      return null;
    }
  }

  public getUserId(): number | null {
    if (!this.kongregate) return null;
    try {
      const id = this.kongregate.services.getUserId();
      return typeof id === "number" && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  public getGameAuthToken(): string | null {
    if (!this.kongregate) return null;
    try {
      return this.kongregate.services.getGameAuthToken() || null;
    } catch {
      return null;
    }
  }

  public showRegistrationBox(): void {
    if (!this.kongregate) {
      console.warn("Cannot show registration box: Kongregate API is not active.");
      return;
    }
    try {
      console.log("🎮 Invoking Kongregate showRegistrationBox()...");
      this.kongregate.services.showRegistrationBox();
    } catch (err: unknown) {
      console.warn("Failed to open Kongregate registration box:", err);
    }
  }

  public submitScore(score: number): void {
    if (!this.kongregate || score <= 0) return;
    try {
      this.kongregate.stats.submit("Score", Math.floor(score));
      console.log(`🏆 Kongregate stat submitted: Score = ${score}`);
    } catch (err: unknown) {
      console.warn("Failed to submit score to Kongregate:", err);
    }
  }

  public submitLevel(level: number): void {
    if (!this.kongregate || level <= 0) return;
    try {
      this.kongregate.stats.submit("Level", Math.floor(level));
      console.log(`🏆 Kongregate stat submitted: Level = ${level}`);
    } catch (err: unknown) {
      console.warn("Failed to submit level to Kongregate:", err);
    }
  }

  public submitCampaignComplete(): void {
    if (!this.kongregate) return;
    try {
      this.kongregate.stats.submit("CompletedCampaign", 1);
      console.log("🏆 Kongregate stat submitted: CompletedCampaign = 1");
    } catch (err: unknown) {
      console.warn("Failed to submit campaign complete to Kongregate:", err);
    }
  }
}

export const kongregateService = new KongregateService();
