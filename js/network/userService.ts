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

export class UserService {
  private static instance: UserService | null = null;
  private currentUser: UserProfile | null = null;

  private constructor() {
    const savedId = this.getLoggedInUserId();
    const savedName = localStorage.getItem(USER_NAME_KEY);
    if (savedId && savedName) {
      this.currentUser = { id: savedId, name: savedName };
    }
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public getLoggedInUserId(): string | null {
    return localStorage.getItem(USER_ID_KEY);
  }

  public getLoggedInUser(): UserProfile | null {
    return this.currentUser;
  }

  public isLoggedIn(): boolean {
    return !!this.getLoggedInUserId();
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
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during login.";
      return { success: false, error: msg };
    }
  }

  public logout(): void {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    this.currentUser = null;
  }

  public async validateSession(): Promise<UserProfile | null> {
    const userId = this.getLoggedInUserId();
    if (!userId) {
      this.currentUser = null;
      return null;
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
    localStorage.setItem(USER_ID_KEY, user.id);
    localStorage.setItem(USER_NAME_KEY, user.name);
    localStorage.setItem("jetpack_player_name", user.name);
  }
}

export const userService = UserService.getInstance();
