/* ==========================================================================
   CAMPAIGN LEADERBOARD UI CONTROLLER
   Manages the Top 10 High Scores dialog (#dlgLeaderboard).
   ========================================================================== */

import { leaderboardService } from "../network/leaderboardService.js";
import { userService } from "../network/userService.js";
import { CampaignLeaderboardEntry } from "../shared/payloads.js";

export class LeaderboardUI {
  private static instance: LeaderboardUI | null = null;

  private modal: HTMLDialogElement | null = null;
  private tableBody: HTMLElement | null = null;
  private statusBanner: HTMLElement | null = null;
  private qualificationNote: HTMLElement | null = null;
  private btnClose: HTMLButtonElement | null = null;

  private constructor() {}

  public static getInstance(): LeaderboardUI {
    if (!LeaderboardUI.instance) {
      LeaderboardUI.instance = new LeaderboardUI();
    }
    return LeaderboardUI.instance;
  }

  public init(): void {
    this.modal = document.getElementById("dlgLeaderboard") as HTMLDialogElement | null;
    this.tableBody = document.getElementById("leaderboardTableBody");
    this.statusBanner = document.getElementById("leaderboardStatusBanner");
    this.qualificationNote = document.getElementById("leaderboardQualificationNote");
    this.btnClose = document.getElementById("btnCloseLeaderboard") as HTMLButtonElement | null;

    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.closeModal());
    }
  }

  public async openModal(highlightUserId?: string, bannerMessage?: string): Promise<void> {
    if (!this.modal) return;

    if (this.statusBanner) {
      if (bannerMessage) {
        this.statusBanner.innerHTML = bannerMessage;
        this.statusBanner.classList.remove("hidden");
      } else {
        this.statusBanner.textContent = "";
        this.statusBanner.classList.add("hidden");
      }
    }

    if (this.qualificationNote) {
      this.qualificationNote.textContent = "";
    }

    if (this.tableBody) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #00ffcc; padding: 24px; font-family: 'Rajdhani', sans-serif; font-size: 1rem;">
            📡 RETRIEVING TOP PILOT RECORDS...
          </td>
        </tr>
      `;
    }

    this.modal.showModal();

    await this.refresh(highlightUserId);
  }

  public closeModal(): void {
    if (!this.modal) return;
    this.modal.close();
  }

  public async refresh(highlightUserId?: string): Promise<void> {
    const currentUserId = highlightUserId || userService.getLoggedInUserId() || undefined;
    const response = await leaderboardService.getLeaderboard();

    if (!this.tableBody) return;

    if (!response.success) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #ff4444; padding: 24px; font-family: 'Rajdhani', sans-serif;">
            ⚠️ Unable to load leaderboard: ${response.error || "Connection error"}
          </td>
        </tr>
      `;
      return;
    }

    const scores = response.scores;
    if (scores.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #888; padding: 24px; font-family: 'Rajdhani', sans-serif;">
            No pilot records registered yet. Conquer the campaign to become #1!
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = "";
    scores.forEach((entry: CampaignLeaderboardEntry, index: number) => {
      const rank = index + 1;
      let rankDisplay = `${rank}`;
      if (rank === 1) rankDisplay = "🥇 1ST";
      else if (rank === 2) rankDisplay = "🥈 2ND";
      else if (rank === 3) rankDisplay = "🥉 3RD";
      else rankDisplay = `${rank}TH`;

      const isCurrentPilot = currentUserId && entry.userId === currentUserId;
      const rowClass = isCurrentPilot ? "leaderboard-row current-pilot" : "leaderboard-row";

      const formattedScore = entry.score.toLocaleString();
      const stageText = entry.completedCampaign
        ? `<span class="stage-victory">Stage 10 (VICTORY 🏆)</span>`
        : `Stage ${entry.levelReached}`;

      const dateStr = entry.timestamp
        ? new Date(entry.timestamp).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "--";

      rowsHtml += `
        <tr class="${rowClass}">
          <td class="col-rank">${rankDisplay}</td>
          <td class="col-pilot">${this.escapeHtml(entry.userName)}${isCurrentPilot ? ' <span class="tag-you">(YOU)</span>' : ""}</td>
          <td class="col-score">${formattedScore}</td>
          <td class="col-stage">${stageText}</td>
          <td class="col-date">${dateStr}</td>
        </tr>
      `;
    });

    this.tableBody.innerHTML = rowsHtml;

    if (this.qualificationNote) {
      if (response.minScoreToQualify > 1) {
        this.qualificationNote.innerHTML = `Minimum score to enter Top 10: <strong>${response.minScoreToQualify.toLocaleString()}</strong>`;
      } else {
        this.qualificationNote.innerHTML = `Open Top 10 slots available! Any completed run qualifies.`;
      }
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

export const leaderboardUI = LeaderboardUI.getInstance();
