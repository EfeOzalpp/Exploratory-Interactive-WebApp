import { clamp01, val } from './utils/useLerp.ts';
import { blendRGB } from './utils/colorBlend.ts';
import { oscillateSaturation } from '../color/colorUtils.ts';
import { applyShapeMods } from './utils/shapeMods.ts';

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
  colorBlend: [0.40, 0.00],
  oscAmp:     [0.12, 0.06],
  oscSpeed:   [0.06, 0.16],

  rayCount:        [3, 7],
  rayLenK:         [1.6, 1],
  rayThickK:       [0.38, 0.22],

  coreScale:       [62,  42],
  rayAnchorScale:  [54,  26],
};

export function drawSun(p, x, y, r, opts = {}) {
  const u = clamp01(opts?.liveAvg ?? 0.5);
  const t = ((typeof opts?.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000);

  const ex = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct = typeof opts?.contrast === 'number' ? opts.contrast : 1;

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

  // rays tint
  let rayTintBase = blendRGB(SUN_RAY, opts.gradientRGB, sunBlend);
  rayTintBase = applyExposureContrast(rayTintBase, ex, ct);
  const pulsedRay = oscillateSaturation(rayTintBase, t, { amp: oscAmp, speed: oscSpeed, phase: oscPhase });

  const rayCount     = Math.max(6, Math.floor(opts.rayCount ?? val(SUN.rayCount,  u)));
  const rayThickBase = Math.max(1, opts.rayThickness ?? Math.round(r * val(SUN.rayThickK, u)));
  const coreDiamBase = val(SUN.coreScale, u);
  const rayAnchorDiam = val(SUN.rayAnchorScale, u);
  const baseCoreRadius = rayAnchorDiam / 2;

  // --- Apply shape mods (now with APPEAR) ---
  const desiredAbsOsc = val([0.7, 0.08], u);
  const m = applyShapeMods({
    p, x, y, r,
    opts: {
      alpha: Number.isFinite(opts.alpha) ? opts.alpha : 235,
      timeMs: opts.timeMs,
      liveAvg: opts.liveAvg,
      rootAppearK: opts.rootAppearK, // <- provided by reconciler
    },
    mods: {
      // appear: grow & fade from nothing, centered (sun is sky object)
      appear: {
        scaleFrom: 0.0,
        alphaFrom: 0.0,
        anchor: 'center',
        ease: 'back',
        backOvershoot: 1.6,
      },
      // gentle breathing of the core diameter
      sizeOsc: {
        mode:   'absolute',
        biasAbs: coreDiamBase,
        ampAbs:  desiredAbsOsc,
        speed:   val([10.5, 0.18], u),
        anchor: 'center',
      },
      opacityOsc: { amp: val([20, 40], u), speed: val([0.12, 0.25], u) },
      rotation:   { speed: val([0.4, 0.1], u) },
    }
  });

  // Everything below is drawn in a local space at (0,0), then scaled by appear (scaleX/Y)
  const ctx = p.drawingContext;
  p.push();
  p.translate(m.x, m.y);
  p.scale(m.scaleX, m.scaleY); // appear envelope (and any 2D scaling) affects rays & core

  // Ray geometry computed in local space
  const rayLenBase = Math.max(0, opts.rayLen ?? r * val(SUN.rayLenK, u));
  const rayThickness = rayThickBase; // thickness follows scale via canvas transform
  const rayGap = Number.isFinite(opts.rayGap) ? opts.rayGap : Math.max(12, Math.round(rayThickness * 2));
  const a = (typeof m.alpha === 'number' ? m.alpha : 235) / 255;

  // Rays
  p.noFill();
  p.strokeWeight(rayThickness);
  for (let i = 0; i < rayCount; i++) {
    const theta = (i / rayCount) * Math.PI * 2 + m.rotation;
    const len = (i % 2 === 0) ? rayLenBase * 0.7 : rayLenBase * 1.2;

    const startR = baseCoreRadius + rayGap;
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

  // Core
  p.noStroke();
  p.fill(pulsedCore.r, pulsedCore.g, pulsedCore.b, (typeof m.alpha === 'number' ? m.alpha : 235));
  p.circle(0, 0, m.r); // m.r already includes the sizeOsc; appear scaling comes from p.scale above
  p.pop();
}
