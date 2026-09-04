/* ====================================================================
 * pickupRenderer.ts — renders all collectible / weapon pickup tiles.
 *
 * Extracted from tileRenderer.ts.  Covers:
 *   EMERALD, FUEL, GOLD, EXTRA_LIFE,
 *   RAPID_FIRE, WEAPON_SPREAD, WEAPON_GRENADE, WEAPON_MISSILE
 *
 * The four weapon pickup cases shared identical boilerplate
 * (hover animation, radial glow aura, ground shadow, orbiting sparks).
 * That boilerplate is now captured in drawWeaponPickupBase() so each
 * case only specifies the colours and orbit configuration that make it
 * unique.
 * ==================================================================== */

import { TILES } from "../../shared/constants.js";

// ---------------------------------------------------------------------------
// Private weapon art helpers
// ---------------------------------------------------------------------------

function drawSpreadCannonPickup(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pulse: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.08);
  ctx.lineJoin = "round";

  // Stock, grip, and a clearly split three-barrel muzzle.
  ctx.fillStyle = "#35105c";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.lineTo(3, -4);
  ctx.lineTo(7, 0);
  ctx.lineTo(3, 4);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ff00dd";
  ctx.fillRect(-8, 4, 4, 7);
  ctx.strokeRect(-8, 4, 4, 7);

  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 5 + pulse * 3;
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 2.4;
  for (const offset of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(3, offset * 1.5);
    ctx.lineTo(12, offset * 5);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-2, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlasmaGrenadePickup(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pulse: number,
  now: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = "round";

  // Mechanical cap and segmented grenade casing.
  ctx.fillStyle = "#d9ffe5";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.fillRect(-4, -12, 8, 4);
  ctx.strokeRect(-4, -12, 8, 4);
  ctx.beginPath();
  ctx.moveTo(3, -11);
  ctx.quadraticCurveTo(11, -13, 9, -6);
  ctx.strokeStyle = "#ffff00";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  const shell = ctx.createRadialGradient(-3, -4, 1, 0, 0, 11);
  shell.addColorStop(0, "#baffcb");
  shell.addColorStop(0.28, "#00ff66");
  shell.addColorStop(1, "#006b35");
  ctx.fillStyle = shell;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 1, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 65, 35, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-9, -2);
  ctx.lineTo(9, -2);
  ctx.moveTo(-9, 4);
  ctx.lineTo(9, 4);
  ctx.moveTo(-4, -8);
  ctx.lineTo(-4, 10);
  ctx.moveTo(4, -8);
  ctx.lineTo(4, 10);
  ctx.stroke();

  // Animated chamber makes this read as plasma ordnance, not a plain bomb.
  const coreRadius = 3.2 + pulse;
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = 7 + pulse * 4;
  ctx.fillStyle = "#ffffaa";
  ctx.beginPath();
  ctx.arc(0, 1, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 1, 6, now / 180, now / 180 + Math.PI * 1.3);
  ctx.stroke();
  ctx.restore();
}

function drawSeekerMissilePickup(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pulse: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  ctx.lineJoin = "round";

  // Exhaust flame and fins establish direction before the rocket body.
  ctx.shadowColor = "#ff6600";
  ctx.shadowBlur = 6 + pulse * 4;
  ctx.fillStyle = "#ff6600";
  ctx.beginPath();
  ctx.moveTo(-10, -3);
  ctx.lineTo(-16 - pulse * 2, 0);
  ctx.lineTo(-10, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffff66";
  ctx.beginPath();
  ctx.moveTo(-10, -1.5);
  ctx.lineTo(-14 - pulse, 0);
  ctx.lineTo(-10, 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#26384b";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.lineTo(6, -4);
  ctx.lineTo(13, 0);
  ctx.lineTo(6, 4);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ff3300";
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-4, -9);
  ctx.lineTo(1, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.lineTo(-4, 9);
  ctx.lineTo(1, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cyan seeker eye is visually separate from the orange warhead.
  ctx.fillStyle = "#ff6600";
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.lineTo(13, 0);
  ctx.lineTo(6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 7;
  ctx.fillStyle = "#bfffff";
  ctx.beginPath();
  ctx.arc(8.5, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared boilerplate for animated weapon pickup tiles
// ---------------------------------------------------------------------------

interface OrbitNode {
  /** CSS colour string for this orbiting spark. */
  color: string;
}

interface WeaponPickupBaseOptions {
  /** Radial-glow inner colour (stop 0). */
  auraInner: string;
  /** Radial-glow outer colour (stop 0.4–0.5). */
  auraOuter: string;
  /** Orbit speed divisor (ms per full revolution). */
  orbitSpeed: number;
  /** Orbit nodes — one per spark, evenly spaced. */
  orbitNodes: OrbitNode[];
}

/**
 * Draws the shared animated frame that all weapon pickup tiles use:
 *   • radial glow aura
 *   • ground shadow ellipse
 *   • orbiting spark nodes
 *
 * The caller is responsible for ctx.save() / ctx.restore() and for
 * drawing the actual weapon icon on top afterwards.
 */
function drawWeaponPickupBase(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  y: number,
  hoverY: number,
  pulse: number,
  now: number,
  opts: WeaponPickupBaseOptions,
): void {
  const glowRadius = 18 + pulse * 4.0;
  const plasmaGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRadius);
  plasmaGlow.addColorStop(0, opts.auraInner.replace(")", `, ${0.7 + pulse * 0.25})`).replace("rgb", "rgba"));
  plasmaGlow.addColorStop(0.4, opts.auraOuter.replace(")", `, ${0.4 + pulse * 0.2})`).replace("rgb", "rgba"));
  plasmaGlow.addColorStop(1, opts.auraInner.replace(")", ", 0)").replace("rgb", "rgba"));
  ctx.fillStyle = plasmaGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Ground shadow
  const shadowScale = Math.max(0.6, 1 - hoverY * 0.12);
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.ellipse(cx, y + 29, 8 * shadowScale, 2.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting spark nodes
  const nodeCount = opts.orbitNodes.length;
  const orbitAngle = now / opts.orbitSpeed;
  for (let i = 0; i < nodeCount; i++) {
    const angle = orbitAngle + (i * Math.PI * 2) / nodeCount;
    const ox = cx + Math.cos(angle) * 14;
    const oy = cy + Math.sin(angle) * 6;
    ctx.fillStyle = opts.orbitNodes[i].color;
    ctx.beginPath();
    ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Renders a single pickup / collectible tile.
 * Called by renderTile() in tileRenderer.ts for cases that belong here.
 */
export function renderPickupTile(
  ctx: CanvasRenderingContext2D,
  tile: number,
  x: number,
  y: number,
  c: number,
  _r: number,
): void {
  switch (tile) {
    case TILES.EMERALD: {
      const hoverOffset = Math.sin(Date.now() / 250) * 1.5;
      const cx = x + 16;
      const cy = y + 16 + hoverOffset;
      const pulseGlow = (Math.sin(Date.now() / 180) + 1) * 0.5;

      const glowRadius = 17 + pulseGlow * 2.5;
      const outerGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRadius);
      outerGlow.addColorStop(0, `rgba(0, 255, 136, ${0.55 + pulseGlow * 0.25})`);
      outerGlow.addColorStop(0.5, `rgba(16, 185, 129, ${0.25 + pulseGlow * 0.15})`);
      outerGlow.addColorStop(1, "rgba(5, 150, 105, 0)");
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const pTL = { x: cx - 6.5, y: cy - 10 };
      const pTR = { x: cx + 6.5, y: cy - 10 };
      const pML = { x: cx - 11,  y: cy - 3  };
      const pMR = { x: cx + 11,  y: cy - 3  };
      const pB  = { x: cx,       y: cy + 11 };
      const pC  = { x: cx,       y: cy - 2  };

      const pCrownL = { x: cx - 3.5, y: cy - 3 };
      const pCrownR = { x: cx + 3.5, y: cy - 3 };

      ctx.fillStyle = "#024220";
      ctx.beginPath();
      ctx.moveTo(pML.x, pML.y);
      ctx.lineTo(pCrownL.x, pCrownL.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#046633";
      ctx.beginPath();
      ctx.moveTo(pCrownL.x, pCrownL.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#058744";
      ctx.beginPath();
      ctx.moveTo(pCrownR.x, pCrownR.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0a9b4f";
      ctx.beginPath();
      ctx.moveTo(pMR.x, pMR.y);
      ctx.lineTo(pCrownR.x, pCrownR.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0eab58";
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pML.x, pML.y);
      ctx.lineTo(pCrownL.x, pCrownL.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pCrownL.x, pCrownL.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.moveTo(pTR.x, pTR.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.lineTo(pCrownR.x, pCrownR.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(pTR.x, pTR.y);
      ctx.lineTo(pCrownR.x, pCrownR.y);
      ctx.lineTo(pMR.x, pMR.y);
      ctx.closePath();
      ctx.fill();

      const tableGrad = ctx.createLinearGradient(pTL.x, pTL.y, pTR.x, pC.y);
      tableGrad.addColorStop(0, "#ffffff");
      tableGrad.addColorStop(0.3, "#d1fae5");
      tableGrad.addColorStop(0.65, "#6ee7b7");
      tableGrad.addColorStop(1, "#10b981");
      ctx.fillStyle = tableGrad;
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(230, 255, 240, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.lineTo(pMR.x, pMR.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.lineTo(pML.x, pML.y);
      ctx.closePath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pCrownL.x, pCrownL.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.moveTo(pTR.x, pTR.y);
      ctx.lineTo(pCrownR.x, pCrownR.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.moveTo(pML.x, pML.y);
      ctx.lineTo(pCrownL.x, pCrownL.y);
      ctx.moveTo(pMR.x, pMR.y);
      ctx.lineTo(pCrownR.x, pCrownR.y);
      ctx.moveTo(pCrownL.x, pCrownL.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.lineTo(pCrownR.x, pCrownR.y);
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pC.x, pC.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.moveTo(pC.x, pC.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();

      const flareTime = Date.now() / 180;
      const flareSize = (Math.sin(flareTime) + 1) * 3 + 2.5;
      const flareAlpha = (Math.sin(flareTime) + 1) * 0.4 + 0.5;
      const fx = pTL.x + 1;
      const fy = pTL.y + 1;

      ctx.strokeStyle = `rgba(235, 255, 245, ${flareAlpha})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(fx - flareSize, fy);
      ctx.lineTo(fx + flareSize, fy);
      ctx.moveTo(fx, fy - flareSize);
      ctx.lineTo(fx, fy + flareSize);
      const diag = flareSize * 0.6;
      ctx.moveTo(fx - diag, fy - diag);
      ctx.lineTo(fx + diag, fy + diag);
      ctx.moveTo(fx + diag, fy - diag);
      ctx.lineTo(fx - diag, fy + diag);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Subtle crystal glimmer
      const glimmerAlpha = (Math.sin(flareTime + 2.0) + 1) * 0.35;
      if (glimmerAlpha > 0.35) {
        ctx.fillStyle = `rgba(209, 250, 229, ${glimmerAlpha})`;
        ctx.beginPath();
        ctx.arc(pCrownR.x, pCrownR.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case TILES.FUEL: {
      const now = Date.now();
      const hoverY = Math.sin(now / 220) * 1.5;
      const pulse = (Math.sin(now / 180) + 1) * 0.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      ctx.save();

      const outerGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16 + pulse * 2);
      outerGlow.addColorStop(0, `rgba(255, 170, 0, ${0.45 + pulse * 0.2})`);
      outerGlow.addColorStop(0.6, `rgba(255, 80, 0, ${0.15 + pulse * 0.1})`);
      outerGlow.addColorStop(1, "rgba(255, 80, 0, 0)");
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 16 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      const shadowScale = Math.max(0.6, 1 - hoverY * 0.12);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, y + 29, 8 * shadowScale, 2.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      const w = 16;
      const h = 18;
      const bx = cx - w / 2;
      const by = cy - h / 2 + 2;

      ctx.fillStyle = "#1c2833";
      ctx.fillRect(cx - 6, by - 5, 12, 3);

      ctx.fillStyle = "#bdc3c7";
      ctx.fillRect(cx - 5, by - 5, 3, 2);
      ctx.fillRect(cx - 1, by - 5, 3, 2);
      ctx.fillRect(cx + 3, by - 5, 3, 2);

      ctx.fillStyle = "#d35400";
      ctx.fillRect(bx + 1, by - 4, 4, 3);
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(bx + 1.5, by - 5, 3, 1.5);

      const bodyGrad = ctx.createLinearGradient(bx, 0, bx + w, 0);
      bodyGrad.addColorStop(0, "#b02a00");
      bodyGrad.addColorStop(0.25, "#e74c3c");
      bodyGrad.addColorStop(0.55, "#ff5522");
      bodyGrad.addColorStop(0.75, "#ff8800");
      bodyGrad.addColorStop(1, "#800c2f");

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      if ("roundRect" in ctx && typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, by, w, h, 2);
      } else {
        ctx.rect(bx, by, w, h);
      }
      ctx.fill();

      ctx.strokeStyle = "#200500";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx + 3, by + 3);
      ctx.lineTo(bx + w - 3, by + h - 3);
      ctx.moveTo(bx + w - 3, by + 3);
      ctx.lineTo(bx + 3, by + h - 3);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 3.5, by + 4);
      ctx.lineTo(bx + w - 3.5, by + h - 2);
      ctx.moveTo(bx + w - 3.5, by + 4);
      ctx.lineTo(bx + 3.5, by + h - 2);
      ctx.stroke();

      const fx = cx;
      const fy = by + h / 2 - 0.5;

      ctx.fillStyle = "#ff2200";
      ctx.beginPath();
      ctx.moveTo(fx, fy - 5);
      ctx.bezierCurveTo(fx + 4, fy - 1, fx + 4, fy + 4, fx, fy + 4);
      ctx.bezierCurveTo(fx - 4, fy + 4, fx - 4, fy - 1, fx, fy - 5);
      ctx.fill();

      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.moveTo(fx, fy - 3);
      ctx.bezierCurveTo(fx + 2.5, fy, fx + 2.5, fy + 3, fx, fy + 3);
      ctx.bezierCurveTo(fx - 2.5, fy + 3, fx - 2.5, fy, fx, fy - 3);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(fx, fy - 1);
      ctx.bezierCurveTo(fx + 1.2, fy + 0.8, fx + 1.2, fy + 2, fx, fy + 2);
      ctx.bezierCurveTo(fx - 1.2, fy + 2, fx - 1.2, fy + 0.8, fx, fy - 1);
      ctx.fill();

      const gw = 2.5;
      const gh = 10;
      const gx = bx + w - 3.5;
      const gy = by + 4;

      ctx.fillStyle = "#100500";
      ctx.fillRect(gx, gy, gw, gh);

      const slosh = Math.sin(now / 150) * 0.5;
      const fillH = 7 + slosh;
      const fillY = gy + (gh - fillH);

      const fuelGrad = ctx.createLinearGradient(0, fillY, 0, gy + gh);
      fuelGrad.addColorStop(0, "#ffee00");
      fuelGrad.addColorStop(1, "#ff5500");

      ctx.fillStyle = fuelGrad;
      ctx.fillRect(gx, fillY, gw, gh - (fillY - gy));

      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(bx + 1.5, by + 2, 1.2, h - 4);

      const glintTime = now / 180;
      const glintAlpha = (Math.sin(glintTime) + 1) * 0.45 + 0.1;
      const glintSize = (Math.sin(glintTime) + 1) * 1.5 + 1;
      const capGx = bx + 3;
      const capGy = by - 4;

      ctx.strokeStyle = `rgba(255, 255, 255, ${glintAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(capGx - glintSize, capGy);
      ctx.lineTo(capGx + glintSize, capGy);
      ctx.moveTo(capGx, capGy - glintSize);
      ctx.lineTo(capGx, capGy + glintSize);
      ctx.stroke();

      ctx.restore();
      break;
    }

    case TILES.GOLD: {
      const now = Date.now();
      const hoverY = Math.sin(now / 220 + c * 0.5) * 1.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      // 3D Coin Spin (perspective scale X)
      const rotAngle = now / 300 + c * 0.7;
      const scaleX = Math.abs(Math.cos(rotAngle));
      const coinWidth = Math.max(2.2, 10 * scaleX);
      const coinHeight = 10;

      ctx.save();

      // Soft ground shadow beneath spinning coin
      const shadowScaleX = Math.max(0.3, scaleX);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, y + 28, 7 * shadowScaleX, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Golden outer glow pulse
      const glowAlpha = 0.2 + (Math.sin(now / 200) + 1) * 0.15;
      const goldGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
      goldGlow.addColorStop(0, `rgba(255, 215, 0, ${glowAlpha})`);
      goldGlow.addColorStop(1, "rgba(255, 170, 0, 0)");
      ctx.fillStyle = goldGlow;
      ctx.beginPath();
      ctx.ellipse(cx, cy, coinWidth + 4, coinHeight + 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer coin body with rich 3D gold gradient
      const goldGrad = ctx.createLinearGradient(
        cx - coinWidth, cy - coinHeight,
        cx + coinWidth, cy + coinHeight,
      );
      goldGrad.addColorStop(0, "#fff4a3");
      goldGrad.addColorStop(0.3, "#ffd700");
      goldGrad.addColorStop(0.7, "#d4af37");
      goldGrad.addColorStop(1, "#996515");

      ctx.fillStyle = goldGrad;
      ctx.strokeStyle = "#855805";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, coinWidth, coinHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner coin rim and star emblem if coin is wide enough
      if (scaleX > 0.35) {
        const innerWidth = coinWidth * 0.72;
        const innerHeight = coinHeight * 0.72;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, innerWidth, innerHeight, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#855805";
        ctx.font = `bold ${Math.max(7, Math.round(10 * scaleX))}px Orbitron, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", cx, cy + 0.5);
      }

      // Specular sheen light reflection
      if (scaleX > 0.25) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(
          cx - coinWidth * 0.3,
          cy - coinHeight * 0.3,
          coinWidth * 0.4,
          coinHeight * 0.4,
          -0.4,
          Math.PI * 0.7,
          Math.PI * 1.3,
        );
        ctx.stroke();
      }

      // Occasional sparkle on coin edge
      const sparklePhase = Math.sin(now / 300 + c * 3);
      if (sparklePhase > 0.84) {
        const sx = cx + (Math.cos(rotAngle) > 0 ? coinWidth * 0.7 : -coinWidth * 0.7);
        const sy = cy - coinHeight * 0.5;
        const sSize = (sparklePhase - 0.84) * 20;

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx - sSize, sy);
        ctx.lineTo(sx + sSize, sy);
        ctx.moveTo(sx, sy - sSize);
        ctx.lineTo(sx, sy + sSize);
        ctx.stroke();
      }

      ctx.restore();
      break;
    }

    case TILES.EXTRA_LIFE: {
      const now = Date.now();
      const hoverY = Math.sin(now / 220) * 1.8;
      const pulse = (Math.sin(now / 180) + 1) * 0.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      ctx.save();

      const glowRadius = 16 + pulse * 2.5;
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRadius);
      glow.addColorStop(0, `rgba(255, 45, 85, ${0.5 + pulse * 0.25})`);
      glow.addColorStop(0.5, `rgba(255, 120, 160, ${0.25 + pulse * 0.15})`);
      glow.addColorStop(1, "rgba(255, 45, 85, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const shadowScale = Math.max(0.6, 1 - hoverY * 0.12);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(cx, y + 29, 7 * shadowScale, 2.2 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      const heartGrad = ctx.createLinearGradient(cx - 8, cy - 8, cx + 8, cy + 8);
      heartGrad.addColorStop(0, "#ff5e83");
      heartGrad.addColorStop(0.5, "#ff2d55");
      heartGrad.addColorStop(1, "#c0002d");

      ctx.fillStyle = heartGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.bezierCurveTo(cx - 10, cy + 2, cx - 11, cy - 6, cx - 5, cy - 8);
      ctx.bezierCurveTo(cx - 2, cy - 8, cx, cy - 5, cx, cy - 4);
      ctx.bezierCurveTo(cx, cy - 5, cx + 2, cy - 8, cx + 5, cy - 8);
      ctx.bezierCurveTo(cx + 11, cy - 6, cx + 10, cy + 2, cx, cy + 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.arc(cx - 3.5, cy - 4.5, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    case TILES.RAPID_FIRE: {
      const now = Date.now();
      const hoverY = Math.sin(now / 160 + c) * 2.5;
      const pulse = (Math.sin(now / 120) + 1) * 0.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      ctx.save();
      drawWeaponPickupBase(ctx, cx, cy, y, hoverY, pulse, now, {
        auraInner: "rgb(255, 50, 0)",
        auraOuter: "rgb(255, 0, 85)",
        orbitSpeed: 200,
        orbitNodes: [{ color: "#ffff00" }, { color: "#ff0055" }],
      });

      // Angular Hexagonal / Diamond Shield Badge Core
      const w = 11;
      const h = 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + w, cy - h * 0.4);
      ctx.lineTo(cx + w, cy + h * 0.4);
      ctx.lineTo(cx, cy + h);
      ctx.lineTo(cx - w, cy + h * 0.4);
      ctx.lineTo(cx - w, cy - h * 0.4);
      ctx.closePath();

      // High contrast gradient: Crimson -> Fiery Orange -> Neon Yellow
      const badgeGrad = ctx.createLinearGradient(cx - w, cy - h, cx + w, cy + h);
      badgeGrad.addColorStop(0, "#ff0055");
      badgeGrad.addColorStop(0.5, "#ff5500");
      badgeGrad.addColorStop(1, "#ffcc00");
      ctx.fillStyle = badgeGrad;
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner double lightning icon
      ctx.font = "900 11px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 8;
      ctx.fillText("⚡⚡", cx, cy + 0.5);

      ctx.restore();
      break;
    }

    case TILES.WEAPON_SPREAD: {
      const now = Date.now();
      const hoverY = Math.sin(now / 150 + c) * 2.5;
      const pulse = (Math.sin(now / 110) + 1) * 0.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      ctx.save();
      drawWeaponPickupBase(ctx, cx, cy, y, hoverY, pulse, now, {
        auraInner: "rgb(255, 0, 221)",
        auraOuter: "rgb(0, 240, 255)",
        orbitSpeed: 180,
        orbitNodes: [
          { color: "#00f0ff" },
          { color: "#ff00dd" },
          { color: "#ff00dd" },
        ],
      });

      drawSpreadCannonPickup(ctx, cx, cy, pulse);

      ctx.restore();
      break;
    }

    case TILES.WEAPON_GRENADE: {
      const now = Date.now();
      const hoverY = Math.sin(now / 170 + c) * 2.5;
      const pulse = (Math.sin(now / 130) + 1) * 0.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      ctx.save();
      drawWeaponPickupBase(ctx, cx, cy, y, hoverY, pulse, now, {
        auraInner: "rgb(0, 255, 102)",
        auraOuter: "rgb(255, 230, 0)",
        orbitSpeed: 210,
        orbitNodes: [{ color: "#ffff00" }, { color: "#00ff66" }],
      });

      drawPlasmaGrenadePickup(ctx, cx, cy, pulse, now);

      ctx.restore();
      break;
    }

    case TILES.WEAPON_MISSILE: {
      const now = Date.now();
      const hoverY = Math.sin(now / 160 + c) * 2.5;
      const pulse = (Math.sin(now / 100) + 1) * 0.5;
      const cx = x + 16;
      const cy = y + 16 + hoverY;

      ctx.save();
      drawWeaponPickupBase(ctx, cx, cy, y, hoverY, pulse, now, {
        auraInner: "rgb(255, 102, 0)",
        auraOuter: "rgb(255, 0, 51)",
        orbitSpeed: 190,
        orbitNodes: [{ color: "#ffcc00" }, { color: "#ff3300" }],
      });

      drawSeekerMissilePickup(ctx, cx, cy, pulse);

      ctx.restore();
      break;
    }
  }
}
