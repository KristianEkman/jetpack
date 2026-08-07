/* ==========================================================================
   BROWSER ERROR MONITOR
   Hooks into console.error, window.onerror, and unhandledrejection to
   show the #errorMonitorBadge in the bottom-right corner whenever
   errors are logged.

   The badge & tooltip elements live in index.html (inside #appContainer),
   styled via index.css — exactly like the version badge.
   ========================================================================== */

interface ErrorEntry {
  message: string;
  timestamp: number;
}

const MAX_ERRORS = 50;

let errors: ErrorEntry[] = [];
let badge: HTMLElement | null = null;
let tooltip: HTMLElement | null = null;
let countSpan: HTMLElement | null = null;
let isTooltipOpen = false;
let initialized = false;

function bindUI(): void {
  if (badge) return;
  badge = document.getElementById("errorMonitorBadge");
  tooltip = document.getElementById("errorMonitorTooltip");
  countSpan = document.getElementById("errorMonitorCount");
  if (!badge || !tooltip) return;

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTooltip();
  });

  tooltip.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (isTooltipOpen) closeTooltip();
  });
}

function toggleTooltip(): void {
  if (isTooltipOpen) {
    closeTooltip();
  } else {
    openTooltip();
  }
}

function openTooltip(): void {
  if (!tooltip) return;
  renderErrors();
  tooltip.classList.remove("hidden");
  isTooltipOpen = true;
}

function closeTooltip(): void {
  if (!tooltip) return;
  tooltip.classList.add("hidden");
  isTooltipOpen = false;
}

function renderErrors(): void {
  if (!tooltip) return;
  if (errors.length === 0) {
    tooltip.innerHTML = "<em>No errors</em>";
    return;
  }
  const html = errors
    .slice()
    .reverse()
    .map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const escaped = e.message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div style="border-bottom:1px solid rgba(255,68,102,0.2);padding:4px 0;word-break:break-word;">
        <span style="color:#ff6688;font-weight:bold;">[${time}]</span> ${escaped}
      </div>`;
    })
    .join("");
  tooltip.innerHTML = html;
}

function pushError(message: string): void {
  if (message.includes("errorMonitor")) return;

  errors.push({ message, timestamp: Date.now() });
  if (errors.length > MAX_ERRORS) {
    errors = errors.slice(-MAX_ERRORS);
  }

  // Lazily bind to the DOM elements on first error
  if (!badge) bindUI();
  updateBadge();
  if (isTooltipOpen) renderErrors();
}

function updateBadge(): void {
  if (!badge || !countSpan) return;
  const count = errors.length;
  countSpan.textContent = count > 99 ? "99+" : String(count);
  if (count > 0) {
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ── Self-initialising hooks ───────────────────────────────────────────

if (!initialized) {
  initialized = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalError(...args);
    const msg = args
      .map((a) => (typeof a === "string" ? a : String(a)))
      .join(" ");
    pushError(msg);
  };

  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      const msg = event.message || "Unknown error";
      const loc = event.filename
        ? ` (${event.filename.split("/").pop()}:${event.lineno})`
        : "";
      pushError(`${msg}${loc}`);
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : String(reason);
      pushError(`Unhandled rejection: ${msg}`);
    },
    true,
  );
}

/**
 * Eagerly bind to the DOM elements. Call once the DOM is ready.
 * If not called, binding happens lazily on the first error.
 */
export function initErrorMonitor(): void {
  bindUI();
}
