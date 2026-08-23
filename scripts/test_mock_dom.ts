/* ==========================================================================
   HEADLESS DOM & WEB API TEST HARNESS
   Unified mock environment for Node.js / tsx unit tests
   ========================================================================== */

export interface MockElement {
  id: string;
  tagName: string;
  className: string;
  classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    contains: (token: string) => boolean;
    toggle: (token: string, force?: boolean) => boolean;
  };
  style: Record<string, string>;
  dataset: Record<string, string>;
  attributes?: Record<string, string>;
  setAttribute: (name: string, val: string) => void;
  getAttribute: (name: string) => string | null;
  textContent: string;
  innerHTML: string;
  text?: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  title?: string;
  colSpan?: number;
  label?: string;
  width: number;
  height: number;
  children: MockElement[];
  parentElement: MockElement | null;
  options?: MockElement[];
  addEventListener: (event: string, handler: (event?: unknown) => void) => void;
  removeEventListener: (event: string, handler: (event?: unknown) => void) => void;
  dispatchEvent: (event: unknown) => boolean;
  appendChild: <T extends MockElement>(child: T) => T;
  removeChild: <T extends MockElement>(child: T) => T;
  replaceChildren?: (...nodes: MockElement[]) => void;
  querySelector: (selector: string) => MockElement | null;
  querySelectorAll: (selector: string) => MockElement[];
  closest?: (selector: string) => MockElement | null;
  getBoundingClientRect: () => {

    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  focus: () => void;
  blur: () => void;
  click: () => void;
  showModal: () => void;
  close: () => void;
  getContext?: (type: string) => MockCanvasRenderingContext2D;
}

export interface MockCanvasRenderingContext2D {
  canvas: MockElement;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (x: number, y: number, r: number, sa: number, ea: number) => void;
  ellipse?: (...args: unknown[]) => void;
  roundRect?: (...args: unknown[]) => void;
  bezierCurveTo?: (...args: unknown[]) => void;
  quadraticCurveTo?: (...args: unknown[]) => void;
  fill: () => void;
  stroke: () => void;
  save: () => void;
  restore: () => void;
  fillText: (text: string, x: number, y: number) => void;
  strokeText: (text: string, x: number, y: number) => void;
  measureText: (text: string) => { width: number };
  drawImage: (...args: unknown[]) => void;
  createLinearGradient: (...args: unknown[]) => unknown;
  createRadialGradient: (...args: unknown[]) => unknown;
  setLineDash: (...args: unknown[]) => void;
  translate: (...args: unknown[]) => void;
  scale: (...args: unknown[]) => void;
  rotate: (...args: unknown[]) => void;
  filledRects?: Array<{ x: number; y: number; w: number; h: number; style: string }>;
  filledTexts?: Array<{ text: string; x: number; y: number; style: string }>;
}

export const elementCache = new Map<string, MockElement>();
export const allMockElements = new Set<MockElement>();

export function createMockContext2D(canvas: MockElement): MockCanvasRenderingContext2D {
  const filledRects: Array<{ x: number; y: number; w: number; h: number; style: string }> = [];
  const filledTexts: Array<{ text: string; x: number; y: number; style: string }> = [];

  return {
    canvas,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number): void {
      this.filledRects?.push({ x, y, w, h, style: this.fillStyle });
    },
    strokeRect(): void {},
    clearRect(): void {},
    beginPath(): void {},
    closePath(): void {},
    moveTo(): void {},
    lineTo(): void {},
    arc(): void {},
    ellipse(): void {},
    roundRect(): void {},
    bezierCurveTo(): void {},
    quadraticCurveTo(): void {},
    fill(): void {},
    stroke(): void {},
    save(): void {},
    restore(): void {},
    fillText(text: string, x: number, y: number): void {
      this.filledTexts?.push({ text, x, y, style: this.fillStyle });
    },
    strokeText(): void {},
    measureText(): { width: number } {
      return { width: 10 };
    },
    drawImage(): void {},
    createLinearGradient(): unknown {
      return { addColorStop(): void {} };
    },
    createRadialGradient(): unknown {
      return { addColorStop(): void {} };
    },
    setLineDash(): void {},
    translate(): void {},
    scale(): void {},
    rotate(): void {},
    filledRects,
    filledTexts,
  };
}

export function createMockElement(
  id: string = "",
  tagName: string = "div",
): MockElement {
  const classes = new Set<string>();
  const listeners: Record<string, Array<(event?: unknown) => void>> = {};
  const attrs: Record<string, string> = {};
  let innerHtml = "";
  let textCont = "";

  const el: MockElement = {
    id,
    tagName: tagName.toUpperCase(),
    className: "",
    classList: {
      add(...tokens: string[]): void {
        tokens.forEach((t) => classes.add(t));
        el.className = Array.from(classes).join(" ");
      },
      remove(...tokens: string[]): void {
        tokens.forEach((t) => classes.delete(t));
        el.className = Array.from(classes).join(" ");
      },
      contains(token: string): boolean {
        return classes.has(token);
      },
      toggle(token: string, force?: boolean): boolean {
        const next = force !== undefined ? force : !classes.has(token);
        if (next) classes.add(token);
        else classes.delete(token);
        el.className = Array.from(classes).join(" ");
        return next;
      },
    },
    style: {},
    dataset: {},
    attributes: attrs,
    setAttribute(name: string, val: string): void {
      attrs[name] = val;
    },
    getAttribute(name: string): string | null {
      return attrs[name] ?? null;
    },
    get innerHTML(): string {
      return innerHtml;
    },
    set innerHTML(val: string) {
      innerHtml = val;
      if (val === "") {
        el.children = [];
      }
    },
    get textContent(): string {
      return textCont;
    },
    set textContent(val: string) {
      textCont = val;
    },
    get text(): string {
      return textCont;
    },
    set text(val: string) {
      textCont = val;
    },
    value: "",
    checked: false,
    disabled: false,
    title: "",
    width: tagName.toLowerCase() === "canvas" ? 960 : 0,
    height: tagName.toLowerCase() === "canvas" ? 576 : 0,
    children: [],
    parentElement: null,
    get options(): MockElement[] {
      const opts: MockElement[] = [];
      function collect(node: MockElement): void {
        if (node.tagName === "OPTION") opts.push(node);
        node.children.forEach(collect);
      }
      collect(el);
      return opts;
    },
    addEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    dispatchEvent(event: unknown): boolean {
      const type = (event as { type?: string })?.type;
      if (type && listeners[type]) {
        listeners[type].forEach((h) => h(event));
      }
      return true;
    },
    appendChild<T extends MockElement>(child: T): T {
      el.children.push(child);
      child.parentElement = el;
      allMockElements.add(child);
      return child;
    },
    removeChild<T extends MockElement>(child: T): T {
      el.children = el.children.filter((c) => c !== child);
      child.parentElement = null;
      return child;
    },
    replaceChildren(...nodes: MockElement[]): void {
      el.children = [];
      nodes.forEach((n) => {
        el.children.push(n);
        n.parentElement = el;
        allMockElements.add(n);
      });
    },
    closest(selector: string): MockElement | null {
      if (
        selector === "#gameHud" &&
        (el.id === "gameHud" || el.parentElement?.id === "gameHud")
      ) {
        return el;
      }
      return null;
    },
    querySelector(selector: string): MockElement | null {
      if (selector === ".hud-toggle-text") {
        return (
          el.children.find((c) => c.className.includes("hud-toggle-text")) || null
        );
      }
      if (selector.startsWith("#")) {
        return getOrRegisterMockElement(selector.slice(1));
      }
      if (selector === 'input[name="mpGameMode"]:checked') {
        for (const item of allMockElements) {
          if (item.getAttribute("name") === "mpGameMode" && item.checked) {
            return item;
          }
        }
        return null;
      }
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        for (const item of allMockElements) {
          if (item.classList.contains(cls)) return item;
        }
      }
      return createMockElement("", selector);
    },

    querySelectorAll(selector: string = ""): MockElement[] {
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        const matches: MockElement[] = [];
        for (const item of allMockElements) {
          if (item.classList.contains(cls)) {
            matches.push(item);
          }
        }
        return matches;
      }
      return [];
    },
    getBoundingClientRect(): {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    } {
      return {
        left: 0,
        top: 0,
        right: el.width || 960,
        bottom: el.height || 576,
        width: el.width || 960,
        height: el.height || 576,
      };
    },
    focus(): void {},
    blur(): void {},
    click(): void {
      if (listeners["click"]) {
        listeners["click"].forEach((h) =>
          h({ target: el, stopPropagation(): void {} }),
        );
      }
    },
    showModal(): void {
      el.classList.remove("hidden");
    },
    close(): void {
      el.classList.add("hidden");
    },
  };

  if (tagName.toLowerCase() === "canvas") {
    const ctx = createMockContext2D(el);
    el.getContext = () => ctx;
  }

  if (id) {
    elementCache.set(id, el);
  }
  allMockElements.add(el);
  return el;
}

export function getOrRegisterMockElement(
  id: string,
  tagName: string = "div",
): MockElement {
  if (!elementCache.has(id)) {
    createMockElement(id, tagName);
  }
  return elementCache.get(id)!;
}

export let mockDocument: any = null;
export let mockWindow: any = null;
export let mockLocalStorage: any = null;

export function setupMockDom(options: {
  playerColor?: string;
  playerName?: string;
} = {}): {
  mockDocument: any;
  mockWindow: any;
  mockLocalStorage: any;
} {

  elementCache.clear();
  allMockElements.clear();

  getOrRegisterMockElement("gameCanvas", "canvas");

  const storage = new Map<string, string>();
  storage.set("jetpack_player_color", options.playerColor || "#00ffcc");
  if (options.playerName) {
    storage.set("jetpack_player_name", options.playerName);
  }

  mockLocalStorage = {
    getItem(key: string): string | null {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, val: string): void {
      storage.set(key, String(val));
    },
    removeItem(key: string): void {
      storage.delete(key);
    },
    clear(): void {
      storage.clear();
    },
  };

  const windowListeners: Record<string, Array<(event?: unknown) => void>> = {};

  mockWindow = {
    location: {

      hostname: "localhost",
      href: "http://localhost:3000",
    },
    innerWidth: 960,
    innerHeight: 576,
    localStorage: mockLocalStorage,
    matchMedia: (query: string): { matches: boolean } => ({ matches: false }),
    requestAnimationFrame(cb: (time: number) => void): number {

      return setTimeout(() => cb(Date.now()), 16) as unknown as number;
    },
    cancelAnimationFrame(id: number): void {
      clearTimeout(id);
    },
    addEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(handler);
    },
    removeEventListener(event: string, handler: (event?: unknown) => void): void {
      if (!windowListeners[event]) return;
      windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
    },
    dispatchEvent(event: unknown): boolean {
      const type = (event as { type?: string })?.type;
      if (type && windowListeners[type]) {
        windowListeners[type].forEach((h) => h(event));
      }
      return true;
    },
    AudioContext: class {
      state = "running";
      sampleRate = 44100;
      currentTime = 0;
      destination = {};
      resume(): Promise<void> {
        return Promise.resolve();
      }
      createGain(): unknown {
        return {
          gain: {
            value: 1,
            setValueAtTime(): void {},
            exponentialRampToValueAtTime(): void {},
            linearRampToValueAtTime(): void {},
          },
          connect(): void {},
        };
      }
      createOscillator(): unknown {
        return {
          type: "sine",
          frequency: {
            value: 440,
            setValueAtTime(): void {},
            exponentialRampToValueAtTime(): void {},
            linearRampToValueAtTime(): void {},
          },
          connect(): void {},
          start(): void {},
          stop(): void {},
        };
      }
      createBiquadFilter(): unknown {
        return {
          type: "lowpass",
          frequency: {
            value: 350,
            setValueAtTime(): void {},
            exponentialRampToValueAtTime(): void {},
            linearRampToValueAtTime(): void {},
          },
          Q: {
            value: 1,
            setValueAtTime(): void {},
          },
          connect(): void {},
        };
      }
      createBufferSource(): unknown {
        return {
          buffer: null,
          loop: false,
          connect(): void {},
          start(): void {},
          stop(): void {},
        };
      }
      createBuffer(): unknown {
        return {
          getChannelData(): Float32Array {
            return new Float32Array(4410);
          },
        };
      }
    },
    webkitAudioContext: class {},
    gameInstance: null,
  };

  mockDocument = {
    getElementById(id: string): MockElement | null {
      if (id === "gameCanvas") {
        return getOrRegisterMockElement("gameCanvas", "canvas");
      }
      return getOrRegisterMockElement(id, "div");
    },
    querySelector(selector: string): MockElement | null {
      if (selector.startsWith("#")) {
        return this.getElementById(selector.slice(1));
      }
      if (selector === 'input[name="mpGameMode"]:checked') {
        for (const item of allMockElements) {
          if (item.getAttribute("name") === "mpGameMode" && item.checked) {
            return item;
          }
        }
        return null;
      }
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        for (const item of allMockElements) {
          if (item.classList.contains(cls)) return item;
        }
      }
      return createMockElement("", selector);
    },
    querySelectorAll(selector: string = ""): MockElement[] {
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        const matches: MockElement[] = [];
        for (const item of allMockElements) {
          if (item.classList.contains(cls)) {
            matches.push(item);
          }
        }
        return matches;
      }
      return [];
    },
    createElement(tagName: string): MockElement {
      return createMockElement("", tagName);
    },
    addEventListener(event: string, handler: (event?: unknown) => void): void {
      mockWindow.addEventListener(event, handler);
    },
    removeEventListener(event: string, handler: (event?: unknown) => void): void {
      mockWindow.removeEventListener(event, handler);
    },
    body: createMockElement("body", "body"),
  };

  const g = globalThis as unknown as Record<string, unknown>;
  g.window = mockWindow;
  g.document = mockDocument;
  g.localStorage = mockLocalStorage;
  g.requestAnimationFrame = mockWindow.requestAnimationFrame;
  g.cancelAnimationFrame = mockWindow.cancelAnimationFrame;
  g.HTMLCanvasElement = class HTMLCanvasElement {};
  g.HTMLElement = class HTMLElement {};
  g.HTMLButtonElement = class HTMLButtonElement {};
  g.HTMLInputElement = class HTMLInputElement {};
  g.HTMLSelectElement = class HTMLSelectElement {};
  g.HTMLDialogElement = class HTMLDialogElement {};
  g.fetch = async (): Promise<{ ok: boolean; json: () => Promise<unknown> }> => {
    return {
      ok: true,
      json: async (): Promise<unknown> => ({ success: true }),
    };
  };

  return {
    mockDocument,
    mockWindow,
    mockLocalStorage,
  };
}



