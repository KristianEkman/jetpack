import { kongregateService } from "./kongregateService.js";

export interface UserProfile {
  id: string;
  name: string;
}

export interface UserAuthResponse {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

export const USER_ID_KEY = "jetpack_user_id";
export const USER_NAME_KEY = "jetpack_user_name";
export const AUTH_PROVIDER_KEY = "jetpack_auth_provider";

export class UserService {
  private static instance: UserService | null = null;
  private currentUser: UserProfile | null = null;

  private constructor() {
    const savedId = this.getLoggedInUserId();
    const savedName = typeof localStorage !== "undefined" ? localStorage.getItem(USER_NAME_KEY) : null;
    if (savedId && savedName) {
      this.currentUser = { id: savedId, name: savedName };
    }

    // Auto-sync whenever Kongregate signals a login event
    kongregateService.onLogin((username, userId) => {
      this.loginWithKongregate(username, userId, kongregateService.getGameAuthToken() || undefined);
    });
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public getLoggedInUserId(): string | null {
    return typeof localStorage !== "undefined" ? localStorage.getItem(USER_ID_KEY) : null;
  }

  public getLoggedInUser(): UserProfile | null {
    return this.currentUser;
  }

  public isLoggedIn(): boolean {
    return !!this.getLoggedInUserId();
  }

  public async loginWithKongregate(
    username: string,
    userId: number | string,
    token?: string,
  ): Promise<UserAuthResponse> {
    const profile: UserProfile = {
      id: `kong_${userId}`,
      name: username,
    };
    this.saveSession(profile);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(AUTH_PROVIDER_KEY, "kongregate");
    }

    try {
      const response = await fetch("/api/users/kongregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, userId, token }),
      });
      if (response.ok) {
        const data = (await response.json()) as UserAuthResponse;
        if (data.success && data.user) {
          this.saveSession(data.user);
          return data;
        }
      }
    } catch (err: unknown) {
      console.warn("Could not sync Kongregate user with server, using local profile:", err);
    }

    return { success: true, user: profile };
  }

  public async register(name: string, password: string): Promise<UserAuthResponse> {
    try {
      const response = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = (await response.json()) as UserAuthResponse;
      if (data.success && data.user) {
        this.saveSession(data.user);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(AUTH_PROVIDER_KEY, "custom");
        }
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during registration.";
      return { success: false, error: msg };
    }
  }

  public async login(name: string, password: string): Promise<UserAuthResponse> {
    try {
      const response = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = (await response.json()) as UserAuthResponse;
      if (data.success && data.user) {
        this.saveSession(data.user);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(AUTH_PROVIDER_KEY, "custom");
        }
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during login.";
      return { success: false, error: msg };
    }
  }

  public logout(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem(USER_NAME_KEY);
      localStorage.removeItem(AUTH_PROVIDER_KEY);
    }
    this.currentUser = null;
  }

  public async validateSession(): Promise<UserProfile | null> {
    // If running within Kongregate, prioritize Kongregate player state
    if (kongregateService.isAvailable()) {
      if (!kongregateService.isGuest()) {
        const kUsername = kongregateService.getUsername();
        const kUserId = kongregateService.getUserId();
        if (kUsername && kUserId !== null) {
          const res = await this.loginWithKongregate(
            kUsername,
            kUserId,
            kongregateService.getGameAuthToken() || undefined,
          );
          return res.user ?? this.currentUser;
        }
      } else {
        if (typeof localStorage !== "undefined" && localStorage.getItem(AUTH_PROVIDER_KEY) === "kongregate") {
          this.logout();
          return null;
        }
      }
    }

    const userId = this.getLoggedInUserId();
    if (!userId) {
      this.currentUser = null;
      return null;
    }

    if (userId.startsWith("kong_")) {
      const savedName = typeof localStorage !== "undefined" ? localStorage.getItem(USER_NAME_KEY) : null;
      if (savedName) {
        this.currentUser = { id: userId, name: savedName };
        return this.currentUser;
      }
    }

    try {
      const response = await fetch(`/api/users/me/${encodeURIComponent(userId)}`);
      if (!response.ok) {
        this.logout();
        return null;
      }
      const data = (await response.json()) as { success: boolean; user?: UserProfile };
      if (data.success && data.user) {
        this.saveSession(data.user);
        return data.user;
      } else {
        this.logout();
        return null;
      }
    } catch {
      return this.currentUser;
    }
  }

  private saveSession(user: UserProfile): void {
    this.currentUser = user;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USER_ID_KEY, user.id);
      localStorage.setItem(USER_NAME_KEY, user.name);
      localStorage.setItem("jetpack_player_name", user.name);
    }
  }
}

export const userService = UserService.getInstance();
