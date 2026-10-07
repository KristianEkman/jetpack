import { userService, UserProfile } from "../network/userService.js";
import { kongregateService } from "../network/kongregateService.js";

export class UserAuthUI {
  private static instance: UserAuthUI | null = null;

  private isRegisterMode: boolean = false;

  private modal: HTMLDialogElement | null = null;
  private userAuthTitle: HTMLElement | null = null;
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
  private authSubtitle: HTMLElement | null = null;

  private kongregateAuthCard: HTMLElement | null = null;
  private kongGuestPrompt: HTMLElement | null = null;
  private kongLoggedInInfo: HTMLElement | null = null;
  private btnKongregateSignIn: HTMLButtonElement | null = null;
  private kongPilotName: HTMLElement | null = null;
  private kongPilotId: HTMLElement | null = null;

  private btnHUDAuth: HTMLButtonElement | null = null;
  private btnMenuAccount: HTMLButtonElement | null = null;
  private hudBadge: HTMLElement | null = null;

  private onSuccessCallback: ((user: UserProfile) => void) | null = null;

  private constructor() {}

  public static getInstance(): UserAuthUI {
    if (!UserAuthUI.instance) {
      UserAuthUI.instance = new UserAuthUI();
    }
    return UserAuthUI.instance;
  }

  public init(): void {
    this.modal = document.getElementById("userAuthModal") as HTMLDialogElement | null;
    this.userAuthTitle = document.getElementById("userAuthTitle");
    this.btnAuthToggleTabLogin = document.getElementById("btnAuthTabLogin") as HTMLButtonElement | null;
    this.btnAuthToggleTabRegister = document.getElementById("btnAuthTabRegister") as HTMLButtonElement | null;
    this.inputUsername = document.getElementById("authUserUsername") as HTMLInputElement | null;
    this.inputPassword = document.getElementById("authUserPassword") as HTMLInputElement | null;
    this.btnSubmit = document.getElementById("btnAuthSubmit") as HTMLButtonElement | null;
    this.btnLogout = document.getElementById("btnAuthLogout") as HTMLButtonElement | null;
    this.btnClose = document.getElementById("btnCloseUserAuth") as HTMLButtonElement | null;
    this.statusMsg = document.getElementById("userAuthStatus");
    this.authFormContainer = document.getElementById("userAuthFormContainer");
    this.authSubtitle = document.getElementById("userAuthSubtitle");

    this.loggedInUserCard = document.getElementById("loggedInUserCard");
    this.loggedInUserName = document.getElementById("loggedInUserName");
    this.loggedInUserId = document.getElementById("loggedInUserId");

    this.kongregateAuthCard = document.getElementById("kongregateAuthCard");
    this.kongGuestPrompt = document.getElementById("kongGuestPrompt");
    this.kongLoggedInInfo = document.getElementById("kongLoggedInInfo");
    this.btnKongregateSignIn = document.getElementById("btnKongregateSignIn") as HTMLButtonElement | null;
    this.kongPilotName = document.getElementById("kongPilotName");
    this.kongPilotId = document.getElementById("kongPilotId");

    this.btnHUDAuth = document.getElementById("btnUserAuth") as HTMLButtonElement | null;
    this.btnMenuAccount = document.getElementById("btnMenuAccount") as HTMLButtonElement | null;
    this.hudBadge = document.getElementById("userAccountBadge");

    this.setupEventListeners();
    this.updateHUD();

    // Listen for Kongregate login events to update UI dynamically
    kongregateService.onLogin((username, userId) => {
      this.updateHUD();
      this.refreshLoggedInState();
      if (this.onSuccessCallback) {
        const user = userService.getLoggedInUser() || { id: `kong_${userId}`, name: username };
        const callback = this.onSuccessCallback;
        this.onSuccessCallback = null;
        callback(user);
      }
      this.closeModal();
    });

    // Validate stored session or auto-sync Kongregate session on launch
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

    if (this.btnKongregateSignIn) {
      this.btnKongregateSignIn.addEventListener("click", () => {
        kongregateService.showRegistrationBox();
        this.showStatus("Please complete sign in using the Kongregate dialog...", false);
      });
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

  public openModal(options?: { subtitle?: string; onSuccess?: (user: UserProfile) => void }): void {
    if (!this.modal) return;
    this.clearForm();
    this.onSuccessCallback = options?.onSuccess || null;

    if (kongregateService.isAvailable()) {
      if (this.userAuthTitle) this.userAuthTitle.textContent = "KONGREGATE ACCOUNT";
      if (this.authSubtitle) {
        this.authSubtitle.textContent =
          options?.subtitle ||
          (kongregateService.isGuest()
            ? "Sign in or register with Kongregate to access online features."
            : "Authenticated Kongregate pilot profile.");
        this.authSubtitle.style.display = "block";
      }
      if (kongregateService.isGuest()) {
        kongregateService.showRegistrationBox();
      }
      this.refreshLoggedInState();
      this.modal.showModal();
      return;
    }

    if (this.userAuthTitle) this.userAuthTitle.textContent = "USER ACCOUNT";
    if (this.authSubtitle) {
      this.authSubtitle.textContent =
        options?.subtitle || "Log in or register to record scores, access custom levels, and play online.";
      this.authSubtitle.style.display = "block";
    }
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
    if (kongregateService.isAvailable()) {
      if (this.userAuthTitle) this.userAuthTitle.textContent = "KONGREGATE ACCOUNT";
      if (this.authFormContainer) this.authFormContainer.style.display = "none";
      if (this.loggedInUserCard) this.loggedInUserCard.classList.add("hidden");
      if (this.kongregateAuthCard) this.kongregateAuthCard.classList.remove("hidden");
      if (this.btnLogout) this.btnLogout.style.display = "none";

      if (!kongregateService.isGuest() && kongregateService.getUsername()) {
        const username = kongregateService.getUsername()!;
        const userId = kongregateService.getUserId();
        if (this.kongLoggedInInfo) this.kongLoggedInInfo.classList.remove("hidden");
        if (this.kongGuestPrompt) this.kongGuestPrompt.classList.add("hidden");
        if (this.kongPilotName) this.kongPilotName.textContent = username;
        if (this.kongPilotId) this.kongPilotId.textContent = `Kongregate User ID: ${userId ?? "N/A"}`;
      } else {
        if (this.kongLoggedInInfo) this.kongLoggedInInfo.classList.add("hidden");
        if (this.kongGuestPrompt) this.kongGuestPrompt.classList.remove("hidden");
      }
      return;
    }

    // Standalone / Non-Kongregate environment fallback
    if (this.kongregateAuthCard) this.kongregateAuthCard.classList.add("hidden");
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
      const user = result.user;
      this.showStatus(
        this.isRegisterMode
          ? `User "${user.name}" created and logged in!`
          : `Welcome back, ${user.name}!`,
        false
      );
      this.updateHUD();
      this.refreshLoggedInState();
      const callback = this.onSuccessCallback;
      this.onSuccessCallback = null;
      setTimeout(() => {
        this.closeModal();
        if (callback) {
          callback(user);
        }
      }, 1000);
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
    if (kongregateService.isAvailable()) {
      if (!kongregateService.isGuest()) {
        const username = kongregateService.getUsername();
        if (this.hudBadge) {
          this.hudBadge.textContent = username || "Pilot";
        }
        return;
      }
      if (this.hudBadge) {
        this.hudBadge.textContent = "Guest";
      }
      return;
    }

    const user = userService.getLoggedInUser();
    if (this.hudBadge) {
      this.hudBadge.textContent = user ? user.name : "Guest";
    }
  }
}

export const userAuthUI = UserAuthUI.getInstance();
