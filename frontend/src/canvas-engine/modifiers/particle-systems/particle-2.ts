// modifiers/particle-systems/particle-2.ts
// Reusable puff emitter (snow / smoke / exhaust).
// Deterministic stratified pool, persistent RNG, edge fades, lifetime fades.
// Direction presets with angular spread. Dot-only (circles).

export type RGBA = { r: number; g: number; b: number; a?: number };
export type PuffDir = "none" | "up" | "down" | "left" | "right";

export type PuffEmitterOpts = {
  key: string;
  rect: { x: number; y: number; w: number; h: number };

  dir?: PuffDir;
  spreadAngle?: number;

  angle?: { min?: number; max?: number };

  spawnMode?: "random" | "stratified";
  respawnStratified?: boolean;
  spawn?: { x0?: number; x1?: number; y0?: number; y1?: number };

  speed?: { min?: number; max?: number };
  accel?: { x?: number; y?: number };
  gravity?: number;
  jitter?: { pos?: number; velAngle?: number };
  drag?: number;

  count?: number;
  size?: { min?: number; max?: number };
  sizeHz?: number;

  lifetime?: { min?: number; max?: number };
  fadeInFrac?: number;
  fadeOutFrac?: number;

  edgeFadePx?: { left?: number; right?: number; top?: number; bottom?: number };

  color?: RGBA | ((pr: Particle) => RGBA);

  respawn?: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  uSlot: number;
};

type EmitterState = {
  particles: Particle[];
  rnd: () => number;
};

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function smoothstep01(t: number) {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}
function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function makePRNG(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rnd: () => number, a: number, b: number) {
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  return mix(lo, hi, rnd());
}

function hzLerp(current: number, target: number, hz: number, dt: number) {
  if (!(hz > 0) || !(dt > 0)) return target;
  const k = 1 - Math.exp(-hz * dt);
  return current + (target - current) * k;
}

function dirToAngleSpan(dir: PuffDir, spread: number): { min: number; max: number } {
  const BASES: Record<PuffDir, number> = {
    none: Number.NaN,
    down: Math.PI / 2,
    up: -Math.PI / 2,
    right: 0,
    left: Math.PI,
  };
  const base = BASES[dir] ?? Number.NaN;
  if (Number.isNaN(base)) return { min: -Math.PI, max: Math.PI };
  return { min: base - spread, max: base + spread };
}

function spawnOne(
  rnd: () => number,
  rect: { x: number; y: number; w: number; h: number },
  jPos: number,
  sx0: number,
  sx1: number,
  sy0: number,
  sy1: number,
  spMin: number,
  spMax: number,
  angMin: number,
  angMax: number,
  jAng: number,
  rMin: number,
  rMax: number,
  lifeMin: number,
  lifeMax: number,
  uSlot: number
): Particle {
  const ux = mix(sx0, sx1, uSlot);
  const uy = randRange(rnd, sy0, sy1);
  const x = rect.x + ux * rect.w + (rnd() * 2 - 1) * jPos;
  const y = rect.y + uy * rect.h + (rnd() * 2 - 1) * jPos;

  const sp = randRange(rnd, spMin, spMax);
  const ang = randRange(rnd, angMin - jAng, angMax + jAng);
  const vx = Math.cos(ang) * sp;
  const vy = Math.sin(ang) * sp;

  const life = randRange(rnd, lifeMin, lifeMax);
  const size = randRange(rnd, rMin, rMax);

  const age = rnd() * life;
  return { x, y, vx, vy, age, life, size, uSlot };
}

const EMITTERS_2: Map<string, EmitterState> =
  (globalThis as any).__GP_EMITTERS2__ ||
  ((globalThis as any).__GP_EMITTERS2__ = new Map<string, EmitterState>());

function ensureEmitter(opts: PuffEmitterOpts): EmitterState {
  const key = opts.key;
  let st = EMITTERS_2.get(key);

  const wantCount = Math.max(1, Math.floor(opts.count ?? 32));
  const seed = hashStr(key);

  const mk = () => {
    const rnd = makePRNG(seed);
    const particles = new Array(wantCount).fill(0).map((_, i) => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      size: 1,
      uSlot: (i + rnd()) / wantCount,
    })) as Particle[];
    return { particles, rnd };
  };

  if (!st) {
    st = mk();
    EMITTERS_2.set(key, st);
  } else if (st.particles.length !== wantCount) {
    if (st.particles.length < wantCount) {
      const rnd = st.rnd;
      for (let i = st.particles.length; i < wantCount; i++) {
        st.particles.push({
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          age: 0,
          life: 1,
          size: 1,
          uSlot: (i + rnd()) / wantCount,
        });
      }
    } else {
      st.particles.length = wantCount;
    }
  }

  return st;
}

export function stepAndDrawPuffs(p: any, opts: PuffEmitterOpts, dtSec: number) {
  const state = ensureEmitter(opts);
  const rect = opts.rect;

  const spawnMode = opts.spawnMode ?? "stratified";
  const keepLane = opts.respawnStratified ?? true;
  const respawn = opts.respawn !== false;

  const accX = opts.accel?.x ?? 0;
  const accY = (opts.accel?.y ?? 0) + (opts.gravity ?? 0);
  const drag = Math.max(0, opts.drag ?? 0);

  const fadeInFrac = clamp01(opts.fadeInFrac ?? 0.12);
  const fadeOutFrac = clamp01(opts.fadeOutFrac ?? 0.25);

  const ef = opts.edgeFadePx || {};
  const fL = Math.max(0, ef.left ?? 0);
  const fR = Math.max(0, ef.right ?? 0);
  const fT = Math.max(0, ef.top ?? 0);
  const fB = Math.max(0, ef.bottom ?? 0);

  const rnd = state.rnd;

  const spawn = opts.spawn || {};
  const sx0 = spawn.x0 ?? 0,
    sx1 = spawn.x1 ?? 1;
  const sy0 = spawn.y0 ?? 0,
    sy1 = spawn.y1 ?? 0;

  const speed = opts.speed || {};
  const spMin = speed.min ?? 12;
  const spMax = speed.max ?? 48;

  let angMin: number, angMax: number;
  if (Number.isFinite(opts.angle?.min as number) || Number.isFinite(opts.angle?.max as number)) {
    angMin = opts.angle?.min ?? 0;
    angMax = opts.angle?.max ?? 0;
  } else {
    const dir = opts.dir ?? "none";
    const spread = Number.isFinite(opts.spreadAngle) ? (opts.spreadAngle as number) : 0.35;
    const span = dirToAngleSpan(dir, spread);
    angMin = span.min;
    angMax = span.max;
  }

  const jPos = opts.jitter?.pos ?? 0;
  const jAng = opts.jitter?.velAngle ?? 0;

  const rMin = opts.size?.min ?? 1.2;
  const rMax = Math.max(rMin, opts.size?.max ?? 3.2);

  const lifeMin = Math.max(0.1, opts.lifetime?.min ?? 0.8);
  const lifeMax = Math.max(lifeMin, opts.lifetime?.max ?? 2.2);

  const wantSizeFollow = Number.isFinite(opts.sizeHz as number) && rMax !== rMin;
  const sizeHz = (opts.sizeHz as number) || 0;

  function laneTargetSize(uSlot: number) {
    return rMin + (rMax - rMin) * uSlot;
  }

  function respawnParticle(pr: Particle, idx: number, total: number) {
    if (!(spawnMode === "stratified" && keepLane)) {
      pr.uSlot = spawnMode === "stratified" ? (idx + rnd()) / Math.max(1, total) : rnd();
    }

    const ux = mix(sx0, sx1, pr.uSlot);
    const uy = randRange(rnd, sy0, sy1);

    pr.x = rect.x + ux * rect.w + (rnd() * 2 - 1) * jPos;
    pr.y = rect.y + uy * rect.h + (rnd() * 2 - 1) * jPos;

    const sp = randRange(rnd, spMin, spMax);
    const ang = randRange(rnd, angMin - jAng, angMax + jAng);
    pr.vx = Math.cos(ang) * sp;
    pr.vy = Math.sin(ang) * sp;

    pr.life = randRange(rnd, lifeMin, lifeMax);
    pr.age = rnd() * pr.life;

    pr.size = randRange(rnd, rMin, rMax);
  }

  for (let i = 0; i < state.particles.length; i++) {
    const pr = state.particles[i];
    if (pr.life <= 0) respawnParticle(pr, i, state.particles.length);
  }

  for (let i = 0; i < state.particles.length; i++) {
    const pr = state.particles[i];

    if (drag > 0 && dtSec > 0) {
      const k = Math.exp(-drag * dtSec);
      pr.vx *= k;
      pr.vy *= k;
    }

    pr.vx += accX * dtSec;
    pr.vy += accY * dtSec;
    pr.x += pr.vx * dtSec;
    pr.y += pr.vy * dtSec;
    pr.age += dtSec;

    if (wantSizeFollow) {
      pr.size = hzLerp(pr.size, laneTargetSize(pr.uSlot), sizeHz, dtSec);
    }

    const alive = pr.age <= pr.life;
    const inside =
      pr.x >= rect.x &&
      pr.x <= rect.x + rect.w &&
      pr.y >= rect.y &&
      pr.y <= rect.y + rect.h;

    if ((!alive || !inside) && respawn) {
      respawnParticle(pr, i, state.particles.length);
    }
  }

  p.push();
  p.noStroke();

  for (let i = 0; i < state.particles.length; i++) {
    const pr = state.particles[i];

    let baseColor: RGBA;
    if (typeof opts.color === "function") {
      baseColor = (opts.color as (pr: Particle) => RGBA)(pr) || { r: 255, g: 255, b: 255, a: 255 };
    } else if (opts.color) {
      baseColor = opts.color as RGBA;
    } else {
      baseColor = { r: 235, g: 240, b: 245, a: 180 };
    }

    const aBase = baseColor.a ?? 255;

    const tLife = clamp01(pr.age / pr.life);
    const fIn = fadeInFrac > 0 ? smoothstep01(tLife / Math.max(1e-6, fadeInFrac)) : 1;
    const fOut = fadeOutFrac > 0 ? smoothstep01((1 - tLife) / Math.max(1e-6, fadeOutFrac)) : 1;

    const dL = pr.x - rect.x;
    const dR = rect.x + rect.w - pr.x;
    const dT = pr.y - rect.y;
    const dB = rect.y + rect.h - pr.y;

    const eL = fL > 0 ? smoothstep01(dL / fL) : 1;
    const eR = fR > 0 ? smoothstep01(dR / fR) : 1;
    const eT = fT > 0 ? smoothstep01(dT / fT) : 1;
    const eB = fB > 0 ? smoothstep01(dB / fB) : 1;

    let alpha = aBase * fIn * fOut * eL * eR * eT * eB;
    alpha = Math.max(0, Math.min(255, alpha));

    p.fill(baseColor.r, baseColor.g, baseColor.b, alpha);
    p.circle(pr.x, pr.y, pr.size * 2);
  }

  p.pop();
}
