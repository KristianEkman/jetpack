/* ==========================================================================
   GAME LOOP ENGINE MODULE
   ========================================================================== */

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (dt: number, alpha: number) => void;

export class GameLoop {
    update: UpdateCallback;
    render: RenderCallback;
    lastTime: number;
    accumulatedTime: number;
    step: number;
    isRunning: boolean;
    animationFrameId: number | null;
    fps: number;
    frameCount: number;
    fpsTimer: number;

    constructor(updateFn: UpdateCallback, renderFn: RenderCallback) {
        this.update = updateFn;
        this.render = renderFn;
        
        this.lastTime = 0;
        this.accumulatedTime = 0;
        this.step = 1 / 60; // 60 FPS target physics step
        this.isRunning = false;
        this.animationFrameId = null;

        this.fps = 60;
        this.frameCount = 0;
        this.fpsTimer = 0;
    }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    stop(): void {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    loop(currentTime: number): void {
        if (!this.isRunning) return;

        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // FPS calculation
        this.frameCount++;
        this.fpsTimer += deltaTime;
        if (this.fpsTimer >= 1.0) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        // Fixed timestep update loop for deterministic physics
        this.accumulatedTime += deltaTime;
        while (this.accumulatedTime >= this.step) {
            this.update(this.step);
            this.accumulatedTime -= this.step;
        }

        // Render current state with fixed-step interpolation fraction
        const alpha = this.step > 0 ? this.accumulatedTime / this.step : 1;
        this.render(deltaTime, alpha);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }
}
