// src/canvas-engine/shapes/clouds.js
import {
  oscillateSaturation,
  rgbToHsl,
  hslToRgb,
  cssToRgbViaCanvas,
  makeArchLobes,
  displacementOsc,
  blendRGB,
  stepAndDrawParticles,
  clamp01,
  val,
  applyShapeMods,
} from "../modifiers/index.ts";

/* ───────────────── Palettes ───────────────── */
export const CLOUDS_BASE_PALETTE = {
  default: { r: 236, g: 238, b: 242 },
  rain:    { r: 20,  g: 165, b: 255 },
};
const CLOUD_BASE = CLOUDS_BASE_PALETTE.default;

/* ───────────────── Defaults (tweakable) ───────────────── */
const RAIN = {
  enabled: true,
  spawnX0: 0.12, spawnX1: 0.88,
  spawnY0: 0.22, spawnY1: 0.0,

  angleMin: Math.PI * 0.48,
  angleMax: Math.PI * 0.52,
  speedMin: [280, 160],
  speedMax: [360, 220],
  gravity: 0,
  accelX: 0,
  accelY: 0,

  jitterPos: [3, 0],
  jitterAngle: [0.36, 0],

  count: [24, 18],
  sizeMin: [2, 2.1],
  sizeMax: [2.1, 2.3],
  lengthMin: [3, 9],
  lengthMax: [5, 12],

  lifeMin: 4,
  lifeMax: 5,
  fadeInFrac: 0.15,
  fadeOutFrac: 0.25,

  fadeLeft: 12,
  fadeRight: 12,
  fadeTop: 8,
  fadeBottom: 32,

  alpha: [100, 220],
  blend: [0.02, 0.1],
};

// lerp-able cloud tuning
const CLOUDS = {
  widthEnv:   [0.72, 0.86],
  heightEnv:  [0.24, 0.88],
  spreadX:    [0.72, 0.82],
  arcLift:    [0.12, 0.38],
  rBaseK:     [0.36, 0.46],
  rJitter:    [0.08, 0.14],
  lobeCount:  [6, 9],

  sCap:       [0.14, 0.24],
  oscAmp:     [0.2, 0.12],
  oscSpeed:   [0.32, 0.26],

  wobbleAmp:  [1.4, 1.0],
  blend:      [0.4, 0.08],
};

const WOBBLE = { ampScale: [0.8, 0.95] };

/* ───────────────── Draw ───────────────── */
export function drawClouds(p, _cx, _cy, _r, opts) {
  const cell = opts?.cell;
  const f = opts?.footprint;
  if (!cell || !f) return;

  const t = ((typeof opts?.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000);
  const seed = (opts?.seed ?? 0) | 0;
  const u = clamp01(opts?.liveAvg ?? 0.5);

  const ex = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct = typeof opts?.contrast === 'number' ? opts.contrast : 1;

  // Prefer the explicit dt from painter; fall back to p.deltaTime.
  const dt = Math.max(
    0.001,
    Number.isFinite(opts?.dtSec) ? opts.dtSec : ((p.deltaTime || 16) / 1000)
  );

  // ── Texture-pixel scaling for sprite textures ────────────────────────────
  const BASE_TILE = 124;
  const pxK = Math.max(0.5, (cell || BASE_TILE) / BASE_TILE);
  const pixelScale = Number.isFinite(opts?.particlePixelScale) ? Math.max(0.25, opts.particlePixelScale) : 1;
  const PARTICLE_PX_SCALE = pxK * pixelScale;

  /* ── Layout base ── */
  const x0 = f.c0 * cell;
  const y0 = f.r0 * cell;
  const wTop = f.w * cell;
  const hTop = cell;

  const anchorX = x0 + wTop / 2;
  const anchorY = y0 + hTop * 0.60;

  /* ── Resolve cloud geometry ── */
  const wEnv = wTop * val(CLOUDS.widthEnv,  u);
  const hEnv = hTop * val(CLOUDS.heightEnv, u);
  const spreadX = val(CLOUDS.spreadX, u);
  const arcLift = val(CLOUDS.arcLift, u);
  const rBase   = hTop * val(CLOUDS.rBaseK, u);
  const rJitter = val(CLOUDS.rJitter, u);
  const lobeCount = Math.max(3, Math.round(val(CLOUDS.lobeCount, u)));

  const lobes = makeArchLobes(
    anchorX, anchorY, wEnv, hEnv,
    { count: lobeCount, spreadX, arcLift, rBase, rJitter, seed }
  ) || [];

  /* ── Cloud color ── */
  const cloudBlendDefault = val(CLOUDS.blend, u);
  const cloudBlend = typeof opts?.cloudBlend === 'number' ? opts.cloudBlend : cloudBlendDefault;

  const baseTint =
    (typeof opts?.cloudCss === 'string' && opts.cloudCss.trim().length > 0)
      ? cssToRgbViaCanvas(p, opts.cloudCss)
      : blendRGB(CLOUD_BASE, opts?.gradientRGB, cloudBlend);

  const sMax = Math.max(0, Math.min(1, val(CLOUDS.sCap, u)));
  const { h, s, l } = rgbToHsl(baseTint);
  const capped = hslToRgb({ h, s: Math.min(s, sMax), l });

  let cloudRgb = oscillateSaturation(capped, t, {
    amp:   (typeof opts?.oscAmp === 'number' ? opts.oscAmp : val(CLOUDS.oscAmp, u)),
    speed: (typeof opts?.oscSpeed === 'number' ? opts.oscSpeed : val(CLOUDS.oscSpeed, u)),
    phase: opts?.oscPhase ?? 0,
  });

  /* ── Wobble ── */
  const wobbleK = val(CLOUDS.wobbleAmp, u) * val(WOBBLE.ampScale, u);
  const ampX = (opts?.dispAmp ?? Math.min(12, Math.max(6, Math.round(hTop * 0.12)))) * wobbleK;
  const ampY = ((typeof opts?.dispAmpY === 'number') ? opts.dispAmpY : Math.round(ampX * 0.85)) * wobbleK;
  const ampS = (Math.max(0, Math.min(0.25, opts?.dispScale ?? 0.12))) * wobbleK;
  const fX = Math.max(0.01, opts?.dispSpeed ?? 0.22);
  const fY = fX * 0.85;
  const fS = fX * 0.60;

  /* ── APPEAR envelope for the cloud *shape* ── */
  const appear = applyShapeMods({
    p,
    x: anchorX, y: anchorY, r: Math.min(wTop, hTop),
    opts: {
      alpha: Number.isFinite(opts?.cloudAlpha) ? opts.cloudAlpha : 235,
      timeMs: opts?.timeMs,
      liveAvg: opts?.liveAvg,
      rootAppearK: opts?.rootAppearK,
    },
    mods: {
      appear: {
        scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'center', ease: 'back', backOvershoot: 1.2,
      },
      sizeOsc: { mode: 'none' },
    }
  });

  const cloudAlpha = (typeof appear.alpha === 'number') ? appear.alpha : (Number.isFinite(opts?.cloudAlpha) ? opts.cloudAlpha : 235);

  /* ── RAIN under clouds ── */
  if (RAIN.enabled) {
    const rect = { x: x0, y: y0 + hTop * 0.5, w: wTop, h: hTop * 2.5 };

     const speedMin    = val(RAIN.speedMin, u) * PARTICLE_PX_SCALE;
    const speedMax    = val(RAIN.speedMax, u) * PARTICLE_PX_SCALE;
    const jitterPos   = val(RAIN.jitterPos, u);
    const jitterAngle = val(RAIN.jitterAngle, u);
    const count       = Math.max(8, Math.floor(val(RAIN.count, u)));

    const sizeMin     = val(RAIN.sizeMin, u)   * PARTICLE_PX_SCALE;
    const sizeMax     = Math.max(sizeMin, val(RAIN.sizeMax, u) * PARTICLE_PX_SCALE);
    const lengthMin   = val(RAIN.lengthMin, u) * PARTICLE_PX_SCALE;
    const lengthMax   = val(RAIN.lengthMax, u) * PARTICLE_PX_SCALE;

    const baseAlpha   = Math.round(val(RAIN.alpha, u));
    const syncedAlpha = Math.round(baseAlpha * (cloudAlpha / 255));

    const rainBlend =
      typeof opts?.rainBlend === 'number'
        ? opts.rainBlend
        : val(RAIN.blend, 1 - u);

    let rainTint =
      (typeof opts?.rainCss === 'string' && opts.rainCss.trim().length > 0)
        ? cssToRgbViaCanvas(p, opts.rainCss)
        : blendRGB(CLOUDS_BASE_PALETTE.rain, opts?.gradientRGB, rainBlend);

    const rainColor = { r: rainTint.r, g: rainTint.g, b: rainTint.b, a: syncedAlpha };

    stepAndDrawParticles(p, {
      key: `${f.r0}:${f.c0}:${f.w}x${f.h}:${seed}:rain`,
      rect,
      mode: 'line',
      color: rainColor,

      spawn: { x0: RAIN.spawnX0, x1: RAIN.spawnX1, y0: RAIN.spawnY0, y1: RAIN.spawnY1 },
      angle: { min: RAIN.angleMin, max: RAIN.angleMax },

      speed: { min: speedMin, max: speedMax },
      gravity: RAIN.gravity,
      accel: { x: RAIN.accelX, y: RAIN.accelY },

      jitter: { pos: jitterPos, velAngle: jitterAngle },

      count,
      size: { min: sizeMin, max: sizeMax },
      length: { min: lengthMin, max: lengthMax },
      sizeHz: 8,
      lenHz: 6,

      thicknessScale: PARTICLE_PX_SCALE,

      lifetime: { min: RAIN.lifeMin, max: RAIN.lifeMax },
      fadeInFrac: RAIN.fadeInFrac,
      fadeOutFrac: RAIN.fadeOutFrac,

      edgeFadePx: { left: RAIN.fadeLeft, right: RAIN.fadeRight, top: RAIN.fadeTop, bottom: RAIN.fadeBottom },
      respawn: true,
    }, dt);
  }

  /* ── CLOUDS above rain ── */
  p.push();
  p.translate(appear.x, appear.y);
  p.scale(appear.scaleX, appear.scaleY);
  p.translate(-anchorX, -anchorY);

  p.noStroke();
  p.fill(cloudRgb.r, cloudRgb.g, cloudRgb.b, cloudAlpha);

  for (const l of lobes) {
    const { dx, dy, sc } = displacementOsc(t, l.i, {
      ampX, ampY, ampScale: ampS, freqX: fX, freqY: fY, freqScale: fS, seed
    });
    const lx = l.x;
    const ly = l.y;
    p.circle(lx + dx, ly + dy, l.r * sc * 2);
  }

  p.pop();
}
