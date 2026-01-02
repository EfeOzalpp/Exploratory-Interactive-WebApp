// src/canvas-engine/shapes/sun.js
import { clamp01, val } from './shape-modifiers/useLerp.ts';
import { blendRGB } from './shape-modifiers/colorBlend.ts';
import { oscillateSaturation } from '../color-modifiers/colorUtils.ts';
import { applyShapeMods } from './shape-modifiers/shapeMods.ts';

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

export const SUN_BASE_PALETTE = {
  default: { r: 255, g: 196, b: 60 },
  ray:     { r: 255, g: 140, b: 40 },
};

const SUN_BASE = SUN_BASE_PALETTE.default;
const SUN_RAY  = SUN_BASE_PALETTE.ray;

const SUN = {
  colorBlend: [0.30, 0.00],
  oscAmp:     [0.12, 0.06],
  oscSpeed:   [0.4, 0.02],

  // geometry (interpreted against caller's r)
  rayCount:        [6, 10],
  rayLenK:         [0.80, 0.52],
  rayThickK:       [0.06, 0.04],

  // “base” core diameter and the older anchor (kept so visuals stay familiar)
  coreDiamK:       [0.6, 0.45],
  rayAnchorDiamK:  [0.46, 0.28],
};

/**
 * drawSun(p, x, y, r, opts)
 *
 * Important opts:
 * - alpha (0..255)
 * - exposure, contrast
 * - liveAvg (0..1)
 * - gradientRGB / sunGradientRGB / sunCss
 * - timeMs
 * - rootAppearK
 * - fitToFootprint + {cell, footprint}
 *
 * Fixed-gap ray control:
 * - rayGapPx         (number, pixels) — default ties to stroke
 * - rayLen           (number, pixels) — overrides computed length
 * - rayLenMult       (number)         — scales computed length
 * - rayThickness     (number, px)     — overrides stroke weight
 * - rayThicknessMult (number)         — scales computed stroke
 * - rayCount         (integer)
 * - coreScaleMult    (number)         — multiplies core base diameter (before osc)
 */
export function drawSun(p, xIn, yIn, rIn, opts = {}) {
  const u = clamp01(opts?.liveAvg ?? 0.5);
  const t = ((typeof opts?.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000);

  const ex = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct = typeof opts?.contrast === 'number' ? opts.contrast : 1;

  // allow footprint fit (convenience for grid users)
  let x = xIn, y = yIn, r = rIn;
  if (opts.fitToFootprint && opts.cell && opts.footprint) {
    const { r0, c0, w, h } = opts.footprint;
    const cell = opts.cell;
    const cx = (c0 + w / 2) * cell;
    const cy = (r0 + h / 2) * cell;
    const diam = Math.min(w, h) * cell;
    x = cx; y = cy; r = diam;
  }

  // color blending setup
  const sunBlendDefault = val(SUN.colorBlend, u);
  const sunBlend = (typeof opts.sunBlend === 'number') ? clamp01(opts.sunBlend) : sunBlendDefault;
  const oscAmp   = (typeof opts.oscAmp   === 'number') ? opts.oscAmp   : val(SUN.oscAmp,   u);
  const oscSpeed = (typeof opts.oscSpeed === 'number') ? opts.oscSpeed : val(SUN.oscSpeed, u);
  const oscPhase = opts.oscPhase ?? 0;

  // core tint
  let baseTint = SUN_BASE;
  if (typeof opts?.sunCss === 'string' && opts.sunCss.trim().length > 0) {
    const c = p.color(opts.sunCss);
    baseTint = { r: p.red(c), g: p.green(c), b: p.blue(c) };
  } else if (opts.sunGradientRGB) {
    baseTint = blendRGB(SUN_BASE, opts.sunGradientRGB, sunBlend);
  } else if (opts.gradientRGB) {
    baseTint = blendRGB(SUN_BASE, opts.gradientRGB, sunBlend);
  }
  let pulsedCore = oscillateSaturation(baseTint, t, { amp: oscAmp, speed: oscSpeed, phase: oscPhase });
  pulsedCore = applyExposureContrast(pulsedCore, ex, ct);

  // ray tint
  let rayTintBase = opts.gradientRGB ? blendRGB(SUN_RAY, opts.gradientRGB, sunBlend) : SUN_RAY;
  rayTintBase = applyExposureContrast(rayTintBase, ex, ct);
  const pulsedRay = oscillateSaturation(rayTintBase, t, { amp: oscAmp, speed: oscSpeed, phase: oscPhase });

  // geometry knobs
  const rayCount = Math.max(6, Math.floor(opts.rayCount ?? val(SUN.rayCount, u)));

  // base sizes (core + anchor), with explicit override multiplier for the core
  const coreBase = r * val(SUN.coreDiamK, u) * (opts.coreScaleMult ?? 5);
  const anchorBase = r * val(SUN.rayAnchorDiamK, u); // older anchor measure (kept for feel)

  // default derived sizes for rays
  const rayLenBaseRaw = r * val(SUN.rayLenK, u);
  const rayLenBase = Math.max(0,
    (typeof opts.rayLen === 'number' ? opts.rayLen : rayLenBaseRaw) * (opts.rayLenMult ?? 1)
  );

  const rayThickBaseRaw = Math.round(r * val(SUN.rayThickK, u));
  const rayThickness = Math.max(1,
    (typeof opts.rayThickness === 'number'
      ? opts.rayThickness
      : rayThickBaseRaw * (opts.rayThicknessMult ?? 1))
  );

  // appear + core breathing (only the core's diameter uses sizeOsc; rays use stable gap to core edge)
  const desiredAbsOsc = r * val([0.10, 0.02], u);
  const m = applyShapeMods({
    p, x, y, r: coreBase,
    opts: {
      alpha: Number.isFinite(opts.alpha) ? opts.alpha : 235,
      timeMs: opts.timeMs,
      liveAvg: opts.liveAvg,
      rootAppearK: opts.rootAppearK,
    },
    mods: {
      appear: {
        scaleFrom: 0.0,
        alphaFrom: 0.0,
        anchor: 'center',
        ease: 'back',
        backOvershoot: 1.6,
      },
      sizeOsc: {
        mode:   'absolute',
        biasAbs: coreBase,      // base core diameter
        ampAbs:  desiredAbsOsc, // breathing amplitude (in pixels)
        speed:   val([10.5, 0.18], u),
        anchor: 'center',
      },
      opacityOsc: { amp: val([20, 40], u), speed: val([0.12, 0.25], u) },
      rotation:   { speed: val([0.4, 0.1], u) },
    }
  });

  // drawing context
  const ctx = p.drawingContext;
  p.push();
  p.translate(m.x, m.y);
  p.scale(m.scaleX, m.scaleY); // appear envelope scales both core + rays uniformly

  // rays: start at (live core radius) + fixed pixel gap (no breathing of the gap)
  const coreRadiusNow = m.r * 0.5;
  const rayGapPx = Number.isFinite(opts.rayGapPx)
    ? opts.rayGapPx
    : Math.max(8, Math.round(rayThickness * 1.6)); // default gap ties gently to stroke

  const a = (typeof m.alpha === 'number' ? m.alpha : 235) / 255;
  p.noFill();
  p.strokeWeight(rayThickness);

  for (let i = 0; i < rayCount; i++) {
    const theta = (i / rayCount) * Math.PI * 2 + m.rotation;
    const len = (i % 2 === 0) ? rayLenBase * 0.7 : rayLenBase * 1.2;

    const startR = coreRadiusNow + rayGapPx;
    const endR   = startR + len;

    const x1 = Math.cos(theta) * startR;
    const y1 = Math.sin(theta) * startR;
    const x2 = Math.cos(theta) * endR;
    const y2 = Math.sin(theta) * endR;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, `rgba(${pulsedCore.r},${pulsedCore.g},${pulsedCore.b},${a})`);
    grad.addColorStop(1, `rgba(${pulsedRay.r},${pulsedRay.g},${pulsedRay.b},${a})`);

    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // core (uses m.r which already includes breathing)
  p.noStroke();
  p.fill(pulsedCore.r, pulsedCore.g, pulsedCore.b, (typeof m.alpha === 'number' ? m.alpha : 235));
  p.circle(0, 0, m.r);

  p.pop();
}
