// src/canvas/utils/shapeMods.ts
import { clamp01 } from './useLerp.ts';

// --- Types ---
export type Anchor =
  | 'center'
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'bottom-center' | 'top-center';

export interface Scale2D {
  x?: number;          // multiplier on width (default 1)
  y?: number;          // multiplier on height/diameter (default 1)
  anchor?: Anchor;     // pivot for scaling
}

/** Axis-specific scale oscillator (relative or absolute). */
export interface Scale2DOsc {
  mode?: 'relative' | 'absolute';
  // relative (multipliers)
  biasX?: number; ampX?: number;  // default biasX=1, ampX=0
  biasY?: number; ampY?: number;  // default biasY=1, ampY=0
  // absolute (final width/height in pixels; converted to relative at runtime)
  biasAbsX?: number; ampAbsX?: number;
  biasAbsY?: number; ampAbsY?: number;

  speed?: number;      // cycles/sec (shared)
  phaseX?: number;     // radians
  phaseY?: number;     // radians
  anchor?: Anchor;
}

/* ───────────────────────────────────────────────────────────
   NEW: Appear envelope (time-based, driven by opts.rootAppearK)
   ─────────────────────────────────────────────────────────── */
export interface AppearMod {
  /** Scale starts at scaleFrom and goes to 1.0 as k goes 0→1. Default 0.0. */
  scaleFrom?: number;
  /** Alpha multiplier starts at alphaFrom (0..1) and goes to 1.0. Default 0.0. */
  alphaFrom?: number;
  /** Pivot to “grow” from. Default 'bottom-center' (good for ground-bound shapes). */
  anchor?: Anchor;
  /** Easing: 'linear' | 'cubic' | 'back'. Default 'cubic'. */
  ease?: 'linear' | 'cubic' | 'back';
  /** Overshoot for 'back' easing (≈1.5–2.0). Default 1.6. */
  backOvershoot?: number;
}

export interface ShapeMods {
  /* NEW */ appear?: AppearMod;

  // (existing)
  scale?: Scale;              // uniform scale on diameter
  scale2D?: Scale2D;          // anisotropic scale
  sizeOsc?: SizeOsc;          // uniform size osc
  scale2DOsc?: Scale2DOsc;    // anisotropic scale osc
  opacityOsc?: OpacityOsc;
  rotation?: Rotation;
  rotationOsc?: RotationOsc;
  saturationOsc?: SaturationOsc;
}

export interface Scale {
  value?: number;   // static scale factor (multiplier on diameter)
  anchor?: Anchor;  // scaling pivot
}

/**
 * SizeOsc can be specified in two ways:
 * - Relative (default): bias + amp*sin(...) are MULTIPLIERS (centered around 1 by default)
 * - Absolute: biasAbs + ampAbs*sin(...) are ABSOLUTE DIAMETERS; we convert to relative on the fly.
 */
export interface SizeOsc {
  // Common
  speed?: number;   // cycles per second
  phase?: number;   // radians offset
  anchor?: Anchor;  // scaling pivot
  mode?: 'relative' | 'absolute';

  // Relative mode (multipliers on diameter)
  bias?: number;    // default 1.0 (i.e., around "current diameter")
  amp?: number;     // e.g. 0.1 => ±10%

  // Absolute mode (diameters)
  biasAbs?: number; // baseline DIAMETER to oscillate around
  ampAbs?: number;  // absolute swing in DIAMETER units
}

export interface OpacityOsc {
  amp?: number;   // alpha swing (0–255), centered around current alpha
  speed?: number;
  phase?: number;
}

export interface Rotation {
  speed?: number; // radians/sec
}

export interface RotationOsc {
  amp?: number;   // radians amplitude
  speed?: number;
  phase?: number;
}

export interface SaturationOsc {
  amp?: number;
  speed?: number;
  phase?: number;
}

// (duplicate interface retained for backwards compatibility in your codebase)
export interface ShapeMods {
  scale?: Scale;              // static scaling (multiplier)
  sizeOsc?: SizeOsc;          // bias-centered size oscillation
  opacityOsc?: OpacityOsc;
  rotation?: Rotation;
  rotationOsc?: RotationOsc;
  saturationOsc?: SaturationOsc;
}

export interface ApplyShapeModsOpts {
  p: any; // q5 / p5 instance
  x: number;
  y: number;
  r: number; // base diameter
  opts?: {
    alpha?: number;
    timeMs?: number;
    liveAvg?: number;

    /** NEW: 0..1 for appear (birth), 1..0 for exit (ghost). Provided by reconciler. */
    rootAppearK?: number;
  };
  mods?: ShapeMods;
}

function applyAnchorShiftForScale(
  anchor: Anchor,
  dx: number, // positive when width grows
  dy: number  // positive when height grows
): { offX: number; offY: number } {
  // We move the *center* opposite to the growth on that side.
  // dx,dy are deltas on diameter (not radius).
  switch (anchor) {
    case 'top':            return { offX: 0,       offY: dy/2 };
    case 'bottom':         return { offX: 0,       offY: -dy/2 };
    case 'left':           return { offX: dx/2,    offY: 0 };
    case 'right':          return { offX: -dx/2,   offY: 0 };
    case 'top-left':       return { offX: dx/2,    offY: dy/2 };
    case 'top-right':      return { offX: -dx/2,   offY: dy/2 };
    case 'bottom-left':    return { offX: dx/2,    offY: -dy/2 };
    case 'bottom-right':   return { offX: -dx/2,   offY: -dy/2 };
    case 'bottom-center':  return { offX: 0,       offY: -dy/2 };
    case 'top-center':     return { offX: 0,       offY: dy/2 };
    default: /* center */  return { offX: 0,       offY: 0 };
  }
}

/* Easing helpers (used by appear) */
function easeOutCubic(t: number) {
  t = clamp01(t);
  const u = 1 - t;
  return 1 - u * u * u;
}
function easeOutBack(t: number, s = 1.6) {
  t = clamp01(t);
  const invS = s + 1;
  const x = t - 1;
  return 1 + invS * x * x * x + s * x * x;
}

/**
 * Apply modular shape modifiers: static scale, size osc (bias-centered), opacity, rotation, saturation.
 * Returns { x, y, r, alpha, rotation, satFactor, scaleX, scaleY } where:
 *   - r is the FINAL uniform diameter (legacy)
 *   - scaleX/scaleY are anisotropic multipliers (compose with p.scale)
 */
export function applyShapeMods({ p, x, y, r, opts = {}, mods = {} }: ApplyShapeModsOpts) {
  const u = clamp01(opts?.liveAvg ?? 0.5);
  const t = ((typeof opts?.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000);

  let mx = x, my = y;
  let mr = r;                 // FINAL uniform diameter (for legacy users)
  let alpha = typeof opts.alpha === 'number' && Number.isFinite(opts.alpha) ? opts.alpha : 255;
  let rotation = 0;
  let satFactor = 1;

  // anisotropic scale accumulators (multipliers)
  let scaleX = 1, scaleY = 1;

  /* ─────────────────────────────────────────────────────────
     NEW: APPEAR envelope (first; others layer on top)
     Uses opts.rootAppearK (0→1 appear, 1→0 exit) if provided.
     ───────────────────────────────────────────────────────── */
  if (mods.appear) {
    const {
      scaleFrom = 0.0,
      alphaFrom = 0.0,
      anchor = 'bottom-center',
      ease = 'cubic',
      backOvershoot = 1.6,
    } = mods.appear;

    const kIn = (typeof opts.rootAppearK === 'number') ? opts.rootAppearK : 1;
    let k = clamp01(kIn);
    if (ease === 'cubic') k = easeOutCubic(k);
    else if (ease === 'back') k = easeOutBack(k, backOvershoot);
    // (linear: leave as-is)

    // Scale interpolation (scaleFrom → 1)
    const s = scaleFrom + (1 - scaleFrom) * k;

    // Apply anchor shift based on DIAMETER deltas
    const dx = r * (s - 1);
    const dy = r * (s - 1);
    const { offX, offY } = applyAnchorShiftForScale(anchor, dx, dy);
    mx += offX; my += offY;
    scaleX *= s; scaleY *= s;

    // Alpha multiplier (alphaFrom → 1)
    const aMul = alphaFrom + (1 - alphaFrom) * k;
    alpha = clamp01((alpha * aMul) / 255) * 255;
  }

  // --- EXISTING uniform static scale (kept first for backward compat)
  if (mods.scale && typeof mods.scale.value === 'number') {
    const baseR = r * mods.scale.value;
    const delta = baseR - r;
    switch (mods.scale.anchor ?? 'center') {
      case 'bottom': my -= delta / 2; break;
      case 'top':    my += delta / 2; break;
      case 'left':   mx += delta / 2; break;
      case 'right':  mx -= delta / 2; break;
      case 'top-left':    mx += delta/2; my += delta/2; break;
      case 'top-right':   mx -= delta/2; my += delta/2; break;
      case 'bottom-left': mx += delta/2; my -= delta/2; break;
      case 'bottom-right':mx -= delta/2; my -= delta/2; break;
      case 'bottom-center': my -= delta/2; break;
      case 'top-center':    my += delta/2; break;
    }
    mr = baseR;
  }

  // static anisotropic scale
  if (mods.scale2D) {
    const ax = Math.max(0, mods.scale2D.x ?? 1);
    const ay = Math.max(0, mods.scale2D.y ?? 1);
    const anchor = mods.scale2D.anchor ?? 'center';
    // deltas are on DIAMETER
    const dx = r * (ax - 1);
    const dy = r * (ay - 1);
    const { offX, offY } = applyAnchorShiftForScale(anchor, dx, dy);
    mx += offX; my += offY;
    scaleX *= ax; scaleY *= ay;
  }

  // sizeOsc (uniform) — keep behavior
  if (mods.sizeOsc) {
    const {
      mode = 'relative', speed = 0.3, phase = 0, anchor = 'center',
      bias, amp, biasAbs, ampAbs,
    } = mods.sizeOsc;
    const r0 = mr;
    let biasK = 1, ampK = 0;
    if (mode === 'absolute') {
      const bAbs = (typeof biasAbs === 'number') ? biasAbs : r0;
      const aAbs = (typeof ampAbs  === 'number') ? ampAbs  : 0;
      biasK = bAbs / Math.max(1e-6, r0);
      ampK  = aAbs / Math.max(1e-6, r0);
    } else {
      biasK = (typeof bias === 'number') ? bias : 1;
      ampK  = (typeof amp  === 'number') ? amp  : 0.1;
    }
    const osc = Math.sin(t * speed * Math.PI * 2 + phase);
    const newR = r0 * (biasK + ampK * osc);
    const delta = newR - r0;
    switch (anchor) {
      case 'bottom': my -= delta / 2; break;
      case 'top':    my += delta / 2; break;
      case 'left':   mx += delta / 2; break;
      case 'right':  mx -= delta / 2; break;
      case 'top-left':    mx += delta/2; my += delta/2; break;
      case 'top-right':   mx -= delta/2; my += delta/2; break;
      case 'bottom-left': mx += delta/2; my -= delta/2; break;
      case 'bottom-right':mx -= delta/2; my -= delta/2; break;
      case 'bottom-center': my -= delta / 2; break;
      case 'top-center':    my += delta / 2; break;
    }
    mr = newR;
  }

  // anisotropic scale oscillator
  if (mods.scale2DOsc) {
    const {
      mode = 'relative',
      biasX = 1, ampX = 0, biasY = 1, ampY = 0,
      biasAbsX, ampAbsX, biasAbsY, ampAbsY,
      speed = 0.3,
      phaseX = 0, phaseY = Math.PI / 2,  // default out-of-phase for “sloshing”
      anchor = 'center',
    } = mods.scale2DOsc;

    // Convert absolute (width/height) to multipliers against current diameter mr
    let bx = biasX, by = biasY, ax = ampX, ay = ampY;
    if (mode === 'absolute') {
      const base = Math.max(1e-6, mr);
      bx = (typeof biasAbsX === 'number') ? biasAbsX / base : 1;
      by = (typeof biasAbsY === 'number') ? biasAbsY / base : 1;
      ax = (typeof ampAbsX  === 'number') ? ampAbsX  / base : 0;
      ay = (typeof ampAbsY  === 'number') ? ampAbsY  / base : 0;
    }

    const kx = bx + ax * Math.sin(t * speed * Math.PI * 2 + phaseX);
    const ky = by + ay * Math.sin(t * speed * Math.PI * 2 + phaseY);

    const dx = mr * (kx - 1);
    const dy = mr * (ky - 1);
    const { offX, offY } = applyAnchorShiftForScale(anchor, dx, dy);
    mx += offX; my += offY;

    scaleX *= Math.max(0, kx);
    scaleY *= Math.max(0, ky);
  }

  // opacity / rotation / sat (unchanged)
  if (mods.opacityOsc) {
    const { amp = 80, speed = 0.4, phase = 0 } = mods.opacityOsc;
    const osc = amp * Math.sin(t * speed * Math.PI * 2 + phase);
    alpha = clamp01((alpha + osc) / 255) * 255;
  }
  if (mods.rotation) {
    const { speed = 0.5 } = mods.rotation;
    rotation += t * speed;
  }
  if (mods.rotationOsc) {
    const { amp = Math.PI/16, speed = 0.6, phase = 0 } = mods.rotationOsc;
    rotation += amp * Math.sin(t * speed * Math.PI * 2 + phase);
  }
  if (mods.saturationOsc) {
    const { amp = 0.1, speed = 0.2, phase = 0 } = mods.saturationOsc;
    satFactor = 1 + amp * Math.sin(t * speed * Math.PI * 2 + phase);
  }

  return { x: mx, y: my, r: mr, alpha, rotation, satFactor, scaleX, scaleY };
}
