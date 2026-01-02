// src/canvas-engine/shapes/snow.js
import {
  clamp01,
  val,
  blendRGB,
  rgbToHsl,
  hslToRgb,
  clampBrightness,
  oscillateSaturation,
  makeArchLobes,
  stepAndDrawPuffs,
} from "../modifiers/index.ts";

/* Exposure/contrast helper */
function applyExposureContrast(rgb, exposure = 1, contrast = 1) {
  const e = Math.max(0.1, Math.min(3, exposure));
  const k = Math.max(0.5, Math.min(2, contrast));
  const adj = (v) => {
    let x = (v / 255) * e;
    x = (x - 0.5) * k + 0.5;
    return Math.max(0, Math.min(1, x)) * 255;
  };
  return { r: Math.round(adj(rgb.r)), g: Math.round(adj(rgb.g)), b: Math.round(adj(rgb.b)) };
}

export const SNOW_BASE_PALETTE = {
  cloud:  { r: 242, g: 244, b: 248 },
  flake:  { r: 220, g: 228, b: 245 },
  ground: { r: 232, g: 236, b: 242 },
};

/* Cloud tuning */
const SCLOUD = {
  widthEnv:   [0.76, 0.86],
  heightEnv:  [0.70, 0.82],
  spreadX:    [0.92, 0.80],
  arcLift:    [0.22, 0.30],
  rBaseK:     [0.34, 0.42],
  rJitter:    [0.04, 0.08],
  lobeCount:  [5, 7],

  sCap:       [0.10, 0.18],
  blend:      [0.10, 0.02],
  oscAmp:     [0.02, 0.05],
  oscSpeed:   [0.10, 0.16],

  lightnessRange: [1.00, 0.95],
};

/* Ground strip */
const SGROUND = {
  blendK:        [0.02, 0.01],
  satOscAmp:     [0.00, 0.02],
  satOscSpeed:   [0.08, 0.14],
  lightnessRange:[0.80, 0.92],
  scaleY:        [0.00, 1.33],
};

/* Snow puffs */
const SNOW = {
  spawnX: [0.0, 0.9],
  spawnY: [0.00, 0.30],

  count:   [14, 26],
  sizeMin: [0.4, 1.4],
  sizeMax: [1.2, 2.2],

  lifeMin: [1.4, 8.0],
  lifeMax: [2.4, 12.0],

  emitterOverflowFrac: [0.00, 0.50],

  alpha: [210, 255],

  dir: 'down',
  spreadAngle: [0.60, 0.30],
  speedMin: [16, 24],
  speedMax: [26, 48],
  gravity:  [28, 16],
  drag:     [0.84, 0.92],
  jitterPos:   [0.4, 1.0],
  jitterAngle: [0.02, 0.06],

  fadeInFrac:  0.15,
  fadeOutFrac: 0.15,
  edgeFadePx:  { left: 2, right: 2, top: 8, bottom: 24 },

  sizeHz: 3,

  blendK:      [0.06, 0.02],
  satOscAmp:   [0.02, 0.05],
  satOscSpeed: [0.10, 0.18],

  lightnessRange: [0.90, 1.10],
};

/**
 * drawSnow
 */
export function drawSnow(p, _x, _y, _r, opts = {}) {
  const cell = opts?.cell, f = opts?.footprint;
  if (!cell || !f) return;

  const exposure = Number.isFinite(opts?.exposure) ? opts.exposure : 1;
  const contrast = Number.isFinite(opts?.contrast) ? opts.contrast : 1;

  const t = ((typeof opts?.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000);
  const u = clamp01(opts?.liveAvg ?? 0.5);

  // tile anchors
  const x0 = f.c0 * cell;
  const y0 = f.r0 * cell;
  const wTop = f.w * cell;
  const hTop = cell;

  // cloud visual center (also the local origin for appear transforms)
  const cx = x0 + wTop / 2;
  const cy = y0 + hTop * 0.62;

  /* ───────── appear (shared by ground + cloud) ───────── */
  const appear = {
    alpha: Number.isFinite(opts.alpha) ? opts.alpha : 235,
    x: (opts.appearX ?? cx),
    y: (opts.appearY ?? cy),
    scaleX: Number.isFinite(opts.appearScaleX) ? opts.appearScaleX : 1,
    scaleY: Number.isFinite(opts.appearScaleY) ? opts.appearScaleY : 1,
  };
  const aDraw = appear.alpha;
  const dx = appear.x - cx;
  const dy = appear.y - cy;

  /* ───────── resolve ground visibility knobs ───────── */
  let showGround = opts.showGround !== false; // default true
  if (showGround && typeof opts.hideGroundAboveRow === 'number') {
    if (f.r0 <= opts.hideGroundAboveRow) showGround = false;
  }
  if (
    showGround &&
    typeof opts.hideGroundAboveFrac === 'number' &&
    typeof opts.usedRows === 'number'
  ) {
    const frac = Math.max(0, Math.min(1, opts.hideGroundAboveFrac));
    const cutoffRow = Math.floor(opts.usedRows * frac);
    if (f.r0 <= cutoffRow) showGround = false;
  }

  /* ───────── GROUND STRIP (translated + scaled with appear) ───────── */
  if (showGround) {
    const baseH  = Math.max(4, Math.round(cell / 3));
    const kY     = val(SGROUND.scaleY, u);
    const stripH = Math.round(baseH * kY);
    const bottomY = y0 + f.h * cell;
    const topY    = bottomY - stripH;

    const gBlend  = val(SGROUND.blendK, u);
    const gSatAmp = val(SGROUND.satOscAmp, u);
    const gSatSpd = val(SGROUND.satOscSpeed, u);
    const base    = oscillateSaturation(SNOW_BASE_PALETTE.ground, t, { amp: gSatAmp, speed: gSatSpd, phase: 0 });
    const mixed   = opts?.gradientRGB ? blendRGB(base, opts.gradientRGB, gBlend) : base;
    let clamped   = clampBrightness(mixed, SGROUND.lightnessRange[0], SGROUND.lightnessRange[1]);
    clamped       = applyExposureContrast(clamped, exposure, contrast);

    const rTop = Math.round(cell * 0.06);

    // draw in local space around (cx,cy) so appear scale feels natural
    p.push();
    p.translate(appear.x, appear.y);
    p.scale(appear.scaleX, appear.scaleY);
    p.noStroke();
    p.fill(clamped.r, clamped.g, clamped.b, aDraw); // ← use appear alpha
    p.rect(
      (x0 - cx),
      (topY - cy),
      wTop,
      stripH,
      rTop, rTop, 0, 0
    );
    p.pop();
  }

  /* ───────── CLOUD GEOMETRY / TINT ───────── */
  const wEnv     = wTop * val(SCLOUD.widthEnv,  u);
  const hEnv     = hTop * val(SCLOUD.heightEnv, u);
  const spreadX  = val(SCLOUD.spreadX, u);
  const arcLift  = val(SCLOUD.arcLift, u);
  const rBase    = hTop * val(SCLOUD.rBaseK, u);
  const rJitter  = val(SCLOUD.rJitter, u);
  const lobeCount = Math.max(3, Math.round(val(SCLOUD.lobeCount, u)));

  const lobes = makeArchLobes(
    cx, cy, wEnv, hEnv,
    { count: lobeCount, spreadX, arcLift, rBase, rJitter, seed: 0 }
  ) || [];

  const cloudBlend = val(SCLOUD.blend, u);
  const baseTint = opts?.gradientRGB
    ? blendRGB(SNOW_BASE_PALETTE.cloud, opts.gradientRGB, cloudBlend)
    : SNOW_BASE_PALETTE.cloud;

  const sMax = Math.max(0, Math.min(1, val(SCLOUD.sCap, u)));
  const { h, s, l } = rgbToHsl(baseTint);
  const capped = hslToRgb({ h, s: Math.min(s, sMax), l });

  let cloudRgb = oscillateSaturation(capped, t, {
    amp:   val(SCLOUD.oscAmp, u),
    speed: val(SCLOUD.oscSpeed, u),
    phase: 0,
  });
  cloudRgb = clampBrightness(cloudRgb, SCLOUD.lightnessRange[0], SCLOUD.lightnessRange[1]);
  cloudRgb = applyExposureContrast(cloudRgb, exposure, contrast);

  /* ───────── PARTICLES (translate only; no scale) ───────── */
  const of     = Math.max(0, Math.min(1, val(SNOW.emitterOverflowFrac, u)));
  const extraW = Math.round(wTop * of);
  const emitW  = wTop + extraW;
  const emitX  = (x0 - Math.round(extraW / 2)) + dx; // translation only
  const emitY  = (y0 + hTop * 0.6) + dy;             // translation only
  const snowRect = { x: emitX, y: emitY, w: emitW, h: hTop * 2.2 };

  const sxA = val(SNOW.spawnX, 0), sxB = val(SNOW.spawnX, 1);
  const syA = val(SNOW.spawnY, 0), syB = val(SNOW.spawnY, 1);
  const spawnX0 = Math.min(sxA, sxB);
  const spawnX1 = Math.max(sxA, sxB);
  const spawnY0 = Math.min(syA, syB);
  const spawnY1 = Math.max(syA, syB);

  const baseCount = Math.max(6, Math.floor(val(SNOW.count, u)));

  // === SPRITE-ONLY scaling (canvas path keeps 1.0) ===
  const pxK       = Math.max(1, (opts.pixelScale ?? opts.coreScaleMult ?? 1));
  const sizeK     = Math.pow(pxK, 1.75);  // near-linear, slightly damped
  const speedK    = pxK * 1.35;                  // maintain coverage over taller rects
  const gravityK  = pxK * 1.35;                  // keep fall-feel consistent
  const lifeK     = Math.pow(pxK, 5);  // gentle life boost for lower settling
  const countK    = Math.sqrt(pxK);       // density compensation on big textures

  const sizeMin   = val(SNOW.sizeMin, u) * sizeK;
  const sizeMax   = Math.max(sizeMin, val(SNOW.sizeMax, u) * sizeK);
  const lifeMin   = Math.max(0.1, val(SNOW.lifeMin, u) * lifeK);
  const lifeMax   = Math.max(lifeMin, val(SNOW.lifeMax, u) * lifeK);
  const alpha     = Math.max(0, Math.min(255, Math.round(val(SNOW.alpha, u))));

  const speedMin  = val(SNOW.speedMin, u) * speedK;
  const speedMax  = Math.max(speedMin, val(SNOW.speedMax, u) * speedK);
  const gravity   = val(SNOW.gravity, u) * gravityK;
  const drag      = val(SNOW.drag, u);
  const jPos      = val(SNOW.jitterPos, u);
  const jAng      = val(SNOW.jitterAngle, u);
  const spreadAng = val(SNOW.spreadAngle, u);

  const blendK    = val(SNOW.blendK, u);
  const satAmp    = val(SNOW.satOscAmp, u);
  const satSpd    = val(SNOW.satOscSpeed, u);

  let flakeBase  = oscillateSaturation(SNOW_BASE_PALETTE.flake, t, { amp: satAmp, speed: satSpd, phase: 0 });
  flakeBase      = opts?.gradientRGB ? blendRGB(flakeBase, opts.gradientRGB, blendK) : flakeBase;
  flakeBase      = clampBrightness(flakeBase, SNOW.lightnessRange[0], SNOW.lightnessRange[1]);
  flakeBase      = applyExposureContrast(flakeBase, exposure, contrast);

  const snowColor  = { r: flakeBase.r, g: flakeBase.g, b: flakeBase.b, a: alpha };
  const dt = Math.max(0.001, (p.deltaTime || 16) / 1000);

  stepAndDrawPuffs(p, {
    key: `snow:${f.r0}:${f.c0}:${f.w}x${f.h}`,
    rect: snowRect,

    dir: 'down',
    spreadAngle: spreadAng,
    speed: { min: speedMin, max: speedMax },
    gravity,
    drag,
    accel: { x: 0, y: 0 },

    spawn: { x0: spawnX0, x1: spawnX1, y0: spawnY0, y1: spawnY1 },
    jitter: { pos: jPos, velAngle: jAng },

    count: Math.max(6, Math.floor(baseCount * countK)),
    size: { min: sizeMin, max: sizeMax },
    sizeHz: SNOW.sizeHz,

    lifetime: { min: lifeMin, max: lifeMax },
    fadeInFrac: SNOW.fadeInFrac,
    fadeOutFrac: SNOW.fadeOutFrac,
    edgeFadePx: SNOW.edgeFadePx,

    color: snowColor,
    respawn: true,
  }, dt);

  /* ───────── CLOUD (same appear transform; scalable) ───────── */
  p.push();
  p.translate(appear.x, appear.y);
  p.scale(appear.scaleX, appear.scaleY);
  p.noStroke();
  p.fill(
    cloudRgb.r,
    cloudRgb.g,
    cloudRgb.b,
    Number.isFinite(opts?.cloudAlpha) ? opts.cloudAlpha : aDraw
  );
  for (const l of lobes) p.circle(l.x - cx, l.y - cy, l.r * 2);
  p.pop();
}

export default drawSnow;
