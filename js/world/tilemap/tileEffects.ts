import { TILE_SIZE } from "../../shared/constants.js";
import { ParticleSpec } from "../../shared/types.js";
import { DebrisObject } from "./types.js";

export function addDeathExplosion(
  debris: DebrisObject[],
  x: number,
  y: number,
  facingRight: boolean = true,
  effectsEnabled: boolean = true,
): void {
  if (!effectsEnabled) return;

  const packX = facingRight ? x - 4 : x + 18;
  const packY = y + 6;

  // 1. JETPACK BREAKING INTO PARTS:
  debris.push({
    type: "jetpack_top",
    x: packX,
    y: packY,
    vx: (facingRight ? -70 : 70) + (Math.random() - 0.5) * 30,
    vy: -150 - Math.random() * 40,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 14,
    gravity: 450,
    life: 2.0,
    maxLife: 2.0,
    bounce: 0.5,
  });

  debris.push({
    type: "jetpack_bottom",
    x: packX,
    y: packY + 8,
    vx: (facingRight ? -40 : 40) + (Math.random() - 0.5) * 40,
    vy: -110 - Math.random() * 40,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 16,
    gravity: 480,
    life: 2.0,
    maxLife: 2.0,
    bounce: 0.5,
  });

  debris.push({
    type: "fuel_cell",
    x: packX + 1,
    y: packY + 2,
    vx: (facingRight ? -110 : 110) + (Math.random() - 0.5) * 50,
    vy: -180 - Math.random() * 50,
    rot: 0,
    rotSpeed: (facingRight ? -1 : 1) * (15 + Math.random() * 10),
    gravity: 500,
    life: 2.0,
    maxLife: 2.0,
    bounce: 0.6,
  });

  debris.push({
    type: "nozzle",
    x: packX + 1,
    y: packY + 14,
    vx: (facingRight ? -30 : 30) + (Math.random() - 0.5) * 50,
    vy: -90 - Math.random() * 30,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 20,
    gravity: 520,
    life: 1.8,
    maxLife: 1.8,
    bounce: 0.4,
  });

  // 2. CHARACTER / SUIT PARTS:
  debris.push({
    type: "helmet",
    x: x + 11,
    y: y + 6,
    vx: (facingRight ? 30 : -30) + (Math.random() - 0.5) * 40,
    vy: -130 - Math.random() * 40,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 10,
    gravity: 450,
    life: 2.0,
    maxLife: 2.0,
    bounce: 0.55,
  });

  debris.push({
    type: "suit",
    x: x + 4,
    y: y + 8,
    vx: (Math.random() - 0.5) * 30,
    vy: -60 - Math.random() * 30,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 6,
    gravity: 500,
    life: 1.8,
    maxLife: 1.8,
    bounce: 0.4,
  });

  debris.push({
    type: "boot",
    x: x + 4,
    y: y + 22,
    vx: -35 + (Math.random() - 0.5) * 20,
    vy: -80 - Math.random() * 30,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 12,
    gravity: 550,
    life: 1.8,
    maxLife: 1.8,
    bounce: 0.5,
  });
  debris.push({
    type: "boot",
    x: x + 13,
    y: y + 22,
    vx: 35 + (Math.random() - 0.5) * 20,
    vy: -90 - Math.random() * 30,
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 12,
    gravity: 550,
    life: 1.8,
    maxLife: 1.8,
    bounce: 0.5,
  });
}

export function addSparkles(
  particles: ParticleSpec[],
  x: number,
  y: number,
  color: string = "#00ffcc",
  count: number = 8,
  effectsEnabled: boolean = true,
): void {
  if (!effectsEnabled || !particles) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 60 + 20;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed * 0.016,
      vy: Math.sin(angle) * speed * 0.016,
      color,
      size: Math.random() * 4 + 2,
      life: Math.random() * 0.4 + 0.2,
      maxLife: 0.6,
    });
  }
}

export function updateParticles(particles: ParticleSpec[], dt: number): void {
  if (!particles) return;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;

    if (p.isSmoke) {
      p.size = Math.min(10, p.size + dt * 6);
      p.vy -= dt * 12; // Gently float upward
    } else {
      p.size = Math.max(0, p.size - dt * 2);
    }

    if (p.life <= 0) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
    }
  }
}

export function updateDebris(
  debris: DebrisObject[],
  dt: number,
  isSolidFn: (col: number, row: number) => boolean,
): void {
  if (!debris) return;
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;
    if (d.life <= 0) {
      debris[i] = debris[debris.length - 1];
      debris.pop();
      continue;
    }

    if (d.type === "shockwave") {
      if (d.radius !== undefined && d.speed !== undefined) {
        d.radius += d.speed * dt;
      }
      continue;
    }

    // Gravity & Velocity
    if (d.gravity) {
      d.vy += d.gravity * dt;
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.rotSpeed) {
      d.rot += d.rotSpeed * dt;
    }

    // Tile Collision & Bouncing for physical debris
    if (d.bounce) {
      const col = Math.floor(d.x / TILE_SIZE);
      const row = Math.floor(d.y / TILE_SIZE);
      if (isSolidFn(col, row)) {
        d.vy = -d.vy * d.bounce;
        d.vx *= 0.65;
        d.y += d.vy * dt * 2;
        d.rotSpeed *= -0.4;
        if (Math.abs(d.vy) < 20) d.vy = 0;
      }
    }
  }
}
