import { userService, UserProfile } from "../network/userService.js";

export class UserAuthUI {
  private static instance: UserAuthUI | null = null;

  private isRegisterMode: boolean = false;

  private modal: HTMLDialogElement | null = null;
  private btnAuthToggleTabLogin: HTMLButtonElement | null = null;
  private btnAuthToggleTabRegister: HTMLButtonElement | null = null;
  private inputUsername: HTMLInputElement | null = null;
  private inputPassword: HTMLInputElement | null = null;
  private btnSubmit: HTMLButtonElement | null = null;
  private btnLogout: HTMLButtonElement | null = null;
  private btnClose: HTMLButtonElement | null = null;
  private statusMsg: HTMLElement | null = null;
  private authFormContainer: HTMLElement | null = null;

  private loggedInUserCard: HTMLElement | null = null;
  private loggedInUserName: HTMLElement | null = null;
  private loggedInUserId: HTMLElement | null = null;

  private btnHUDAuth: HTMLButtonElement | null = null;
  private btnMenuAccount: HTMLButtonElement | null = null;
  private hudBadge: HTMLElement | null = null;

  private constructor() {}

  public static getInstance(): UserAuthUI {
    if (!UserAuthUI.instance) {
      UserAuthUI.instance = new UserAuthUI();
    }
    return UserAuthUI.instance;
  }

  public init(): void {
    this.modal = document.getElementById("userAuthModal") as HTMLDialogElement | null;
    this.btnAuthToggleTabLogin = document.getElementById("btnAuthTabLogin") as HTMLButtonElement | null;
    this.btnAuthToggleTabRegister = document.getElementById("btnAuthTabRegister") as HTMLButtonElement | null;
    this.inputUsername = document.getElementById("authUserUsername") as HTMLInputElement | null;
    this.inputPassword = document.getElementById("authUserPassword") as HTMLInputElement | null;
    this.btnSubmit = document.getElementById("btnAuthSubmit") as HTMLButtonElement | null;
    this.btnLogout = document.getElementById("btnAuthLogout") as HTMLButtonElement | null;
    this.btnClose = document.getElementById("btnCloseUserAuth") as HTMLButtonElement | null;
    this.statusMsg = document.getElementById("userAuthStatus");
    this.authFormContainer = document.getElementById("userAuthFormContainer");

    this.loggedInUserCard = document.getElementById("loggedInUserCard");
    this.loggedInUserName = document.getElementById("loggedInUserName");
    this.loggedInUserId = document.getElementById("loggedInUserId");

    this.btnHUDAuth = document.getElementById("btnUserAuth") as HTMLButtonElement | null;
    this.btnMenuAccount = document.getElementById("btnMenuAccount") as HTMLButtonElement | null;
    this.hudBadge = document.getElementById("userAccountBadge");

    this.setupEventListeners();
    this.updateHUD();

    // Validate stored session on launch: restore a persisted login if present.
    // Guests are never prompted — campaign is playable without an account;
    // login is only requested by features that need it (multiplayer, level upload).
    userService.validateSession().then(() => {
      this.updateHUD();
      this.refreshLoggedInState();
    });
  }

  private setupEventListeners(): void {
    if (this.btnHUDAuth) {
      this.btnHUDAuth.addEventListener("click", () => this.openModal());
    }

    if (this.btnMenuAccount) {
      this.btnMenuAccount.addEventListener("click", () => this.openModal());
    }

    if (this.btnAuthToggleTabLogin) {
      this.btnAuthToggleTabLogin.addEventListener("click", () => {
        this.setMode(false);
      });
    }

    if (this.btnAuthToggleTabRegister) {
      this.btnAuthToggleTabRegister.addEventListener("click", () => {
        this.setMode(true);
      });
    }

    if (this.btnSubmit) {
      this.btnSubmit.addEventListener("click", () => this.handleSubmit());
    }

    if (this.btnLogout) {
      this.btnLogout.addEventListener("click", () => this.handleLogout());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.closeModal());
    }
  }

  public openModal(): void {
    if (!this.modal) return;
    this.clearForm();
    this.setMode(false);
    this.modal.showModal();
  }

  public closeModal(): void {
    if (!this.modal) return;
    this.modal.close();
  }

  private setMode(isRegister: boolean): void {
    this.isRegisterMode = isRegister;
    if (this.btnAuthToggleTabLogin) {
      this.btnAuthToggleTabLogin.classList.toggle("active", !isRegister);
    }
    if (this.btnAuthToggleTabRegister) {
      this.btnAuthToggleTabRegister.classList.toggle("active", isRegister);
    }

    if (this.btnSubmit) {
      this.btnSubmit.textContent = isRegister ? "✨ CREATE ACCOUNT" : "🔑 LOG IN";
    }

    if (this.statusMsg) {
      this.statusMsg.textContent = "";
    }

    this.refreshLoggedInState();
  }

  private refreshLoggedInState(): void {
    const user = userService.getLoggedInUser();
    if (user) {
      if (this.loggedInUserCard) this.loggedInUserCard.classList.remove("hidden");
      if (this.loggedInUserName) this.loggedInUserName.textContent = user.name;
      if (this.loggedInUserId) this.loggedInUserId.textContent = `ID: ${user.id}`;
      if (this.authFormContainer) this.authFormContainer.style.display = "none";
      if (this.btnLogout) this.btnLogout.style.display = "block";
    } else {
      if (this.loggedInUserCard) this.loggedInUserCard.classList.add("hidden");
      if (this.authFormContainer) this.authFormContainer.style.display = "block";
      if (this.btnLogout) this.btnLogout.style.display = "none";
    }
  }

  private async handleSubmit(): Promise<void> {
    const username = this.inputUsername?.value || "";
    const password = this.inputPassword?.value || "";

    if (username.length < 1 || password.length < 1) {
      this.showStatus("Username and password must be at least 1 character.", true);
      return;
    }

    this.showStatus("Processing...", false);

    const result = this.isRegisterMode
      ? await userService.register(username, password)
      : await userService.login(username, password);

    if (result.success && result.user) {
      this.showStatus(
        this.isRegisterMode
          ? `User "${result.user.name}" created and logged in!`
          : `Welcome back, ${result.user.name}!`,
        false
      );
      this.updateHUD();
      this.refreshLoggedInState();
      setTimeout(() => this.closeModal(), 1200);
    } else {
      this.showStatus(result.error || "An error occurred.", true);
    }
  }

  private handleLogout(): void {
    userService.logout();
    this.updateHUD();
    this.refreshLoggedInState();
    this.showStatus("Logged out successfully. Removed session from local storage.", false);
    this.clearForm();
  }

  private clearForm(): void {
    if (this.inputUsername) this.inputUsername.value = "";
    if (this.inputPassword) this.inputPassword.value = "";
  }

  private showStatus(msg: string, isError: boolean): void {
    if (!this.statusMsg) return;
    this.statusMsg.textContent = msg;
    this.statusMsg.style.color = isError ? "#ff4444" : "#00ffcc";
  }

  public updateHUD(): void {
    const user = userService.getLoggedInUser();
    if (this.hudBadge) {
      this.hudBadge.textContent = user ? user.name : "Guest";
    }
  }
}

export const userAuthUI = UserAuthUI.getInstance();
