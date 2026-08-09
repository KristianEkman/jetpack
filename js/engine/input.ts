/* ==========================================================================
   INPUT HANDLER MODULE
   ========================================================================== */

import { SerializedInputState } from "../shared/types";

export interface KeyState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    thrust: boolean;
    phase: boolean;
    pause: boolean;
    suicide: boolean;
    [key: string]: boolean;
}

export interface PlacerInput {
    
}

interface PlayerStateLike {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facingRight: boolean;
    isGrounded: boolean;
    isThrusting: boolean;
    isClimbing: boolean;
    isPhasing: boolean;
}

export class InputHandler {
    keys: KeyState;
    sequenceCounter: number;
    onPausePress: (() => void) | null;

    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            thrust: false,
            phase: false,
            pause: false,
            suicide: false
        };

        this.sequenceCounter = 0;
        this.onPausePress = null;

        if (typeof window !== 'undefined') {
            this.setupKeyboard();
            this.setupTouch();
        }
    }

    setupKeyboard(): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            // Prevent scrolling for game controls
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }

            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = true;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    this.keys.up = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.keys.down = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.keys.thrust = true;
                    break;
                case 'Space':
                case 'KeyZ':
                case 'KeyX':
                case 'KeyF':
                case 'ControlLeft':
                case 'ControlRight':
                    this.keys.phase = true;
                    break;
                case 'KeyK':
                case 'Backspace':
                    this.keys.suicide = true;
                    break;
                case 'KeyP':
                case 'Escape':
                    if (this.onPausePress) this.onPausePress();
                    break;
            }
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.keys.right = false;
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    this.keys.up = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.keys.down = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.keys.thrust = false;
                    break;
                case 'Space':
                case 'KeyZ':
                case 'KeyX':
                case 'KeyF':
                case 'ControlLeft':
                case 'ControlRight':
                    this.keys.phase = false;
                    break;
                case 'KeyK':
                case 'Backspace':
                    this.keys.suicide = false;
                    break;
            }
        });
    }

    setupTouch(): void {
        const touchGamepad = document.getElementById('touchGamepad');
        if (!touchGamepad) return;

        // Auto-show touch controls on touch devices
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            touchGamepad.classList.remove('hidden');
        }

        const bindBtn = (id: string, keyName: keyof KeyState) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const start = (e: Event) => {
                e.preventDefault();
                this.keys[keyName] = true;
            };
            const end = (e: Event) => {
                e.preventDefault();
                this.keys[keyName] = false;
            };

            btn.addEventListener('touchstart', start);
            btn.addEventListener('touchend', end);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
        };

        bindBtn('touchUp', 'up');
        bindBtn('touchLeft', 'left');
        bindBtn('touchRight', 'right');
        bindBtn('touchDown', 'down');
        bindBtn('touchJetpack', 'thrust');
        bindBtn('touchPhase', 'phase');
    }

    reset(): void {
        for (let key in this.keys) {
            this.keys[key] = false;
        }
    }

    serializeInputState(sequenceId: number | null = null): SerializedInputState {
        return {
            left: !!this.keys.left,
            right: !!this.keys.right,
            up: !!this.keys.up,
            down: !!this.keys.down,
            thrust: !!this.keys.thrust,
            phase: !!this.keys.phase,
            suicide: !!this.keys.suicide,
            sequenceId: sequenceId !== null ? sequenceId : ++this.sequenceCounter
        };
    }

    static deserializeInputState(payload: Partial<SerializedInputState> | null): SerializedInputState {
        if (!payload) return { left: false, right: false, up: false, down: false, thrust: false, phase: false, suicide: false, sequenceId: 0 };
        return {
            left: !!payload.left,
            right: !!payload.right,
            up: !!payload.up,
            down: !!payload.down,
            thrust: !!payload.thrust,
            phase: !!payload.phase,
            suicide: !!payload.suicide,
            sequenceId: payload.sequenceId || 0
        };
    }
}
