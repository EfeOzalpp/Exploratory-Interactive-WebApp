// src/canvas-engine/shapes/sea.js
import { clamp01, val, mix } from './shape-modifiers/useLerp.ts';
import { blendRGB, blendRGBGamma } from './shape-modifiers/colorBlend.ts';
import {
  clampSaturation,
  clampBrightness,
  oscillateSaturation,
} from '../color-modifiers/colorUtils.ts';
import { stepAndDrawPuffs } from '../modifiers/particle-systems/particle-2.ts';
import { applyShapeMods } from './shape-modifiers/shapeMods.ts';

// base palettes
export const SEA_BASE_PALETTE = {
  top:    { r: 138, g: 196, b: 234 },
  bottom: { r:  25, g: 124, b: 179 },
};

// grass for composite bowl
export const GRASS_BASE = { r: 130, g: 180, b: 110 };

// tuning (override with opts.tuning)
export const SEA_TUNING = {
  span: { forceTilesX: 2, leaderOnly: true },

  gradient: {
    gamma: true,
    blendTop:    [0.10, 0.05],
    blendBottom: [0.10, 0.05],
  },

  colorClamp: {
    sat:    { min: 0.10, max: 0.85 },
    bright: { min: 0.40, max: 0.80 },
    strength: 1.0,
  },

  scale: {
    baseYRange: [0.7, 0.45],
    oscHzRange:  [0.45, 0.85],
    oscAmpRange: [0.04, 0.008]
  },

  appear: { kRange: [0.82, 1.0], easing: 'cubic' },

  // Keep the water body inside the tile (we’ll disable clipping where needed)
  overflow: { allow: false, extraTopPx: 0, extraBottomPx: 0 },

  opacity: { mul: 0.88 },
  antialias: { expandPx: 2 },

  topBorder: {
    enable: false,
    topLinePx: 1,
    topLineAlpha: 0.28,
    topLineMix: 0.25,
  },

  foam: {
    enable: true,
    band: { heightPx: 10, offsetTopPx: 4, oscAmpPx: 3, oscHzRange: [0.12, 0.25] },
    motion: { dir: 'up', spreadAngle: 0.35, speedPxSec: [10, 24], gravity: -8, drag: 0.8, jitterPos: 0.5, jitterAngle: 0.15 },
    pool: { count: 18, sizePx: [0.8, 1.8], sizeHz: 6, lifetimeSec: [0.8, 1.6], fadeInFrac: 0.2, fadeOutFrac: 0.35 },
    edgeFadePx: { left: 6, right: 6, top: 0, bottom: 10 },
    color: { base: { r: 250, g: 252, b: 255, a: 200 }, varyBySize: true },
  },

  // SEA_TUNING.bowl 
  bowl: {
    enable: true,
    thicknessK: 0.2,
    baseFrac:   0.18,
    postTopFrac:0.24,
    colWidthK:  1.00,
    cornerK:    0.10,
    mobile: {
      cellMax:    28,
      thicknessK: 0.1,
      baseFrac:   0.12,
      postTopFrac:0.08,
      colWidthK:  0.85,
      cornerK:    0.12,
    },
    color: GRASS_BASE,
    grassBlend: { colorBlend: [0.25, 0.50], satRange: [0.00, 0.35], brightRange: [0.35, 0.90] },
    alphaMul: 1.0,
  },

  waterBottomRadiusPx: 10,

  // Horizon cap rectangle (drawn without tile clip)
  capRect: {
    enable: true,
    widthTiles: 0.90,
    heightTiles: 0.45,
    cornerPx: 6,
    followOffsetPx: 0,
    color: {
      top:    { r: 245, g: 248, b: 252, a: 255 },
      bottom: { r: 210, g: 230, b: 252, a: 255 },
    },
    scaleMap: { uMin: 0.2, uMax: 0.85, xMin: 0.4, xMax: 1, yMin: 0.3, yMax: 1.22 },
    alphaMul: 1.0,
    satOsc: { amp: 0.08, speed: 0.16, phase: 0 },
  },

  // Spill with particle-2 (narrow spawn band near surface + tall corridor)
  spill: {
    enable: true,

    // global horizontal offset for the WHOLE spill block (in tiles)
    offsetTilesX: 0.25,

    // micro per-side nudges (px)
    leftNudgePx:  0,
    rightNudgePx: 0,

    // spawn density
    count: 34,

    // particle sizes
    sizePx: [1.0, 2.2],

    // speeds (right side intentionally smaller)
    leftSpeedPxSec:  [60, 120],
    rightSpeedPxSec: [14, 30],

    gravity: 360,
    drag: 6,
    lifetimeSec: [0.9, 1.6],

    spillPx: 40, // how far outside the tile spawn may extend horizontally

    fadeInFrac: 0.15,
    fadeOutFrac: 0.35,
    edgeFadePx: { left: 8, right: 8, top: 8, bottom: 36 },

    // widening cone accel (pushes outward as it falls)
    coneAccelX: 120, // px/s^2, sign set per side
    spreadAngle: 0.45,

    // spawn-window fractions (narrow start inside each corridor)
    leftSpawnFracX:  [0.70, 0.96],
    rightSpawnFracX: [0.00, 0.20],

    // LIVE gate
    liveGate: { min: 0.25, max: 0, soft: 0.12 },

    // Left-side anti-cutoff helpers
    leftEdgeFadeLeftPx: 2,
    leftLifetimeSec: [1.2, 2.0],
    leftExtraRoomPx: 24,

    // Mobile tuning (auto if cell is small)
    mobile: { cellMax: 28, leftNudgePx: 8, rightNudgePx: -4 },
  },
};

// helpers
function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

// Map a world-space Y to the current water gradient color (topRGB→bottomRGB)
function seaRGBAtY(y, topY, bottomY, topRGB, bottomRGB) {
  const t = Math.max(0, Math.min(1, (y - topY) / Math.max(1e-6, (bottomY - topY))));
  return {
    r: Math.round(topRGB.r + (bottomRGB.r - topRGB.r) * t),
    g: Math.round(topRGB.g + (bottomRGB.g - topRGB.g) * t),
    b: Math.round(topRGB.b + (bottomRGB.b - topRGB.b) * t),
  };
}

// soft gate helper (like in snow)
function smoothstep01(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function liveWindowK(u, a, b, s = 0) {
  if (a > b) [a, b] = [b, a];
  if (s <= 0) return (u >= a && u <= b) ? 1 : 0;
  const inL = smoothstep01((u - (a - s)) / s);
  const inR = smoothstep01(((b + s) - u) / s);
  return Math.max(0, Math.min(1, Math.min(inL, inR)));
}

export function drawSea(p, _x, _y, _r, opts = {}) {
  const cell = opts?.cell;
  const f = opts?.footprint;
  if (!cell || !f) return;

  // Detect “sprite mode”
  // - auto when CanvasAnimatedTexture / Frozen path sets fitToFootprint: true
  // - or explicitly via opts.spriteMode
  const isSprite = !!opts.fitToFootprint || !!opts.spriteMode;

  // merge tunables
  const OT = opts.tuning || {};
  const T = { ...SEA_TUNING, ...OT };
  T.span        = { ...(SEA_TUNING.span || {}),        ...(OT.span || {}) };
  T.gradient    = { ...(SEA_TUNING.gradient || {}),    ...(OT.gradient || {}) };
  T.colorClamp  = { ...(SEA_TUNING.colorClamp || {}),  ...(OT.colorClamp || {}) };
  T.scale       = { ...(SEA_TUNING.scale || {}),       ...(OT.scale || {}) };
  T.appear      = { ...(SEA_TUNING.appear || {}),      ...(OT.appear || {}) };
  T.overflow    = { ...(SEA_TUNING.overflow || {}),    ...(OT.overflow || {}) };
  T.opacity     = { ...(SEA_TUNING.opacity || {}),     ...(OT.opacity || {}) };
  T.antialias   = { ...(SEA_TUNING.antialias || {}),   ...(OT.antialias || {}) };
  T.topBorder   = { ...(SEA_TUNING.topBorder || {}),   ...(OT.topBorder || {}) };

  // foam
  T.foam        = { ...(SEA_TUNING.foam || {}),        ...(OT.foam || {}) };
  T.foam.band   = { ...((SEA_TUNING.foam || {}).band || {}),   ...((OT.foam || {}).band || {}) };
  T.foam.motion = { ...((SEA_TUNING.foam || {}).motion || {}), ...((OT.foam || {}).motion || {}) };
  T.foam.pool   = { ...((SEA_TUNING.foam || {}).pool || {}),   ...((OT.foam || {}).pool || {}) };
  T.foam.edgeFadePx = { ...((SEA_TUNING.foam || {}).edgeFadePx || {}), ...((OT.foam || {}).edgeFadePx || {}) };
  T.foam.color  = { ...((SEA_TUNING.foam || {}).color || {}),  ...((OT.foam || {}).color || {}) };

  // bowl
  T.bowl        = { ...(SEA_TUNING.bowl || {}),        ...(OT.bowl || {}) };
  T.bowl.grassBlend = { ...((SEA_TUNING.bowl || {}).grassBlend || {}), ...((OT.bowl || {}).grassBlend || {}) };

  const tSec = (typeof opts.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000;
  const u = clamp01(opts.liveAvg ?? 0.5);

  const baseAlpha = Number.isFinite(opts.alpha) ? opts.alpha : 235;
  const alphaMulGlobal = clamp01(T.opacity.mul ?? 1);

  // forced span logic
  // In sprite mode we never fake-span; keep it local to the tile
  const forceX = Math.max(1, (T.span.forceTilesX | 0));
  const canFakeSpanCanvas = !!opts.allowForcedSpan && forceX > 1 && f.w < forceX;
  const canFakeSpan = isSprite ? false : canFakeSpanCanvas;
  const spanTilesX = canFakeSpan ? forceX : f.w;
  const leaderOnly = canFakeSpan ? !!T.span.leaderOnly : false;
  const isLeader =
    opts.spanLeader === true ? true :
    leaderOnly ? ((f.c0 % spanTilesX) === 0) : true;
  if (!isLeader) return;

  // tile rect
  const x0 = f.c0 * cell;
  const y0 = f.r0 * cell;
  const w  = Math.max(f.w, spanTilesX) * cell;
  const h  = f.h * cell;

  const cx = x0 + w / 2;
  const bottomY = y0 + h;

  // WATER Y-scale
  const baseScaleY = val(T.scale.baseYRange, u);
  const oscHz  = Math.max(0, opts.oscHz  ?? val(T.scale.oscHzRange,  u));
  const oscAmp = Math.max(0, opts.oscAmp ?? val(T.scale.oscAmpRange, u));
  const oscT   = 0.5 + 0.5 * Math.sin(tSec * (oscHz * 2 * Math.PI));
  const oscScaleY = mix(1 - oscAmp, 1 + oscAmp, oscT);
  const waterScaleY = Math.max(0, Math.min(1.25, baseScaleY * oscScaleY));

  // WATER colors (gamma + clamp)
  const useGamma = !!T.gradient.gamma;
  const blendTopK    = clamp01(opts.blendTopK    ?? val(T.gradient.blendTop,    u));
  const blendBottomK = clamp01(opts.blendBottomK ?? val(T.gradient.blendBottom, u));
  const blender = useGamma ? blendRGBGamma : blendRGB;
  let topRGB    = opts.gradientRGB ? blender(SEA_BASE_PALETTE.top,    opts.gradientRGB, blendTopK)    : SEA_BASE_PALETTE.top;
  let bottomRGB = opts.gradientRGB ? blender(SEA_BASE_PALETTE.bottom, opts.gradientRGB, blendBottomK) : SEA_BASE_PALETTE.bottom;

  const clampStrength = clamp01(T.colorClamp.strength);
  if (clampStrength > 0) {
    const { min: sMin, max: sMax } = T.colorClamp.sat;
    const { min: lMin, max: lMax } = T.colorClamp.bright;
    const clampOnce = (c) => clampBrightness(
      clampSaturation(c, sMin, sMax, clampStrength),
      lMin, lMax, clampStrength
    );
    topRGB    = clampOnce(topRGB);
    bottomRGB = clampOnce(bottomRGB);
  }

  const ctx = p.drawingContext;

  // geometry in group space
  const extraTop    = Math.max(0, T.overflow.extraTopPx   || 0);
  const extraBottom = Math.max(0, T.overflow.extraBottomPx|| 0);
  const expand = Math.max(0, T.antialias.expandPx || 0);
  const L0 = -w / 2 - expand / 2;
  const W0 = w + expand;
  const Ttop0 = -h - extraTop;
  const H0 = h + extraTop + extraBottom;

  // GROUP APPEAR transform
  const env = applyShapeMods({
    p,
    x: cx,
    y: bottomY,
    r: Math.min(w, h),
    opts: { alpha: baseAlpha * alphaMulGlobal, timeMs: opts.timeMs, liveAvg: u, rootAppearK: opts.rootAppearK },
    mods: { appear: { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: (T.appear.easing === 'linear') ? 'linear' : 'cubic' }, sizeOsc: { mode: 'none' } }
  });

  const drawAlpha = (typeof env.alpha === 'number') ? env.alpha : (baseAlpha * alphaMulGlobal);
  const aFactor = Math.max(0, Math.min(255, Math.round(drawAlpha))) / 255;

  // Begin group transform; clip the tile
  p.push();
  p.translate(env.x, env.y);
  p.scale(env.scaleX, env.scaleY);
  p.translate(-cx, -bottomY);

  // In sprite mode we force clip so nothing spills outside the texture
  const wantClip = isSprite ? true : !T.overflow.allow;
  if (wantClip) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); }

  // 1) WATER body (Y-scaled)
  p.push();
  p.translate(cx, bottomY);
  p.scale(1, waterScaleY);

  const rTop = Math.min(6, Math.max(1, Math.round(cell * 0.06)));
  {
    const ctx2 = ctx;
    const x = L0, y = Ttop0, ww = W0, hh = H0;
    ctx2.save();
    roundedRect(ctx2, x, y, ww, hh, rTop);
    ctx2.clip();
    const OVER = 4;
    const gy0 = y - OVER;
    const gy1 = y + hh + OVER;
    const g = ctx2.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, `rgba(${topRGB.r},${topRGB.g},${topRGB.b},${aFactor})`);
    g.addColorStop(1, `rgba(${bottomRGB.r},${bottomRGB.g},${bottomRGB.b},${aFactor})`);
    ctx2.fillStyle = g;
    ctx2.fillRect(x - 2, gy0, ww + 4, (gy1 - gy0));
    ctx2.restore();
  }

  // Foam (sticks to water)
  if (T.foam.enable) {
    const bandH   = Math.max(1, T.foam.band.heightPx);
    const bandOff = Math.max(0, T.foam.band.offsetTopPx);
    const foamHz  = val(T.foam.band.oscHzRange, u);
    const yOsc    = Math.sin(tSec * foamHz * 2 * Math.PI) * (T.foam.band.oscAmpPx || 0);

    const rect = { x: L0, y: Ttop0 - bandOff + yOsc, w: W0, h: bandH };

    const speedLo = Array.isArray(T.foam.motion.speedPxSec) ? T.foam.motion.speedPxSec[0] : 10;
    const speedHi = Array.isArray(T.foam.motion.speedPxSec) ? T.foam.motion.speedPxSec[1] : speedLo;

    const sizeLo  = Array.isArray(T.foam.pool.sizePx) ? T.foam.pool.sizePx[0] : 1;
    const sizeHi  = Array.isArray(T.foam.pool.sizePx) ? T.foam.pool.sizePx[1] : sizeLo;

    const lifeLo  = Array.isArray(T.foam.pool.lifetimeSec) ? T.foam.pool.lifetimeSec[0] : 1;
    const lifeHi  = Array.isArray(T.foam.pool.lifetimeSec) ? T.foam.pool.lifetimeSec[1] : 1.6;

    const base = T.foam.color.base || { r: 250, g: 252, b: 255, a: 200 };
    const colorFn = (pr) => {
      const aFoam = Math.round((base.a ?? 200) * aFactor);
      if (!T.foam.color.varyBySize || sizeHi === sizeLo) return { ...base, a: aFoam };
      const k = clamp01((pr.size - sizeLo) / Math.max(1e-6, sizeHi - sizeLo));
      const d = 5;
      return { r: base.r - d * (1 - k), g: base.g - d * (1 - k), b: base.b - d * (1 - k), a: aFoam };
    };

    const dtSec =
      (typeof opts.deltaSec === 'number' && opts.deltaSec > 0)
        ? opts.deltaSec
        : (p.deltaTime ? Math.max(1/120, p.deltaTime / 1000) : 1/60);

    stepAndDrawPuffs(p, {
      key: (opts.foamKey ?? `seafoam:${f.r0}:${f.c0}:${spanTilesX}x${f.h}`) + (isSprite ? ':spr' : ''),
      rect,
      dir: T.foam.motion.dir,
      spreadAngle: T.foam.motion.spreadAngle,
      spawnMode: 'stratified',
      respawnStratified: true,
      spawn: { x0: 0, x1: 1, y0: 0, y1: 1 },
      speed:  { min: speedLo, max: speedHi },
      accel:  { x: 0, y: 0 },
      gravity: T.foam.motion.gravity,
      jitter: { pos: T.foam.motion.jitterPos, velAngle: T.foam.motion.jitterAngle },
      drag:   Math.max(0, T.foam.motion.drag || 0),
      count:  T.foam.pool.count,
      size:   { min: sizeLo, max: sizeHi },
      sizeHz: T.foam.pool.sizeHz,
      lifetime:   { min: lifeLo, max: lifeHi },
      fadeInFrac: T.foam.pool.fadeInFrac,
      fadeOutFrac:T.foam.pool.fadeOutFrac,
      edgeFadePx: T.foam.edgeFadePx,
      color: colorFn,
      respawn: true,
    }, dtSec);
  }

  p.pop(); // end WATER scope

  // ---- Cap rectangle (no size oscillation; scale <- clamped liveAvg) ----
  if (T.capRect?.enable) {
    if (wantClip) ctx.restore();
    const surfaceY = bottomY + Ttop0 * waterScaleY;

    const rectW  = (T.capRect?.widthTiles ?? 0.90) * cell;
    const rectH  = (T.capRect?.heightTiles ?? 0.45) * cell;
    const radius = Math.min(T.capRect?.cornerPx ?? 6, rectH / 2);
    const followOffset = T.capRect?.followOffsetPx ?? 0;

    const sm = T.capRect?.scaleMap ?? { uMin: 0.25, uMax: 0.85, xMin: 0.92, xMax: 1.08, yMin: 0.98, yMax: 1.22 };
    const uClamped = Math.max(0, Math.min(1, (u - sm.uMin) / Math.max(1e-6, (sm.uMax - sm.uMin))));
    const sx = mix(sm.xMin, sm.xMax, uClamped);
    const sy = mix(sm.yMin, sm.yMax, uClamped);

    const ctx2 = ctx;
    ctx2.save();
    ctx2.translate(cx, surfaceY + followOffset);
    ctx2.scale(sx, sy);

    const left = -rectW / 2;
    const top  = -rectH;

    const rectAlpha = aFactor * (T.capRect?.alphaMul ?? 1);

    const baseTop = T.capRect?.color?.top    ?? { r: 245, g: 248, b: 252, a: 255 };
    const baseBot = T.capRect?.color?.bottom ?? { r: 210, g: 230, b: 252, a: 255 };
    const satOsc = T.capRect?.satOsc ?? {};
    const topCol = oscillateSaturation(baseTop, tSec, { amp: satOsc.amp ?? 0.08, speed: satOsc.speed ?? 0.16, phase: satOsc.phase ?? 0 });
    const botCol = oscillateSaturation(baseBot, tSec, { amp: satOsc.amp ?? 0.08, speed: satOsc.speed ?? 0.16, phase: (satOsc.phase ?? 0) + Math.PI / 4 });

    const grad = ctx2.createLinearGradient(0, top, 0, 0);
    grad.addColorStop(0, `rgba(${topCol.r},${topCol.g},${topCol.b},${rectAlpha})`);
    grad.addColorStop(1, `rgba(${botCol.r},${botCol.g},${botCol.b},${rectAlpha})`);
    ctx2.fillStyle = grad;

    ctx2.beginPath();
    roundedRect(ctx2, left, top, rectW, rectH, radius);
    ctx2.fill();
    ctx2.restore();

    // re-clip after cap
    if (wantClip) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); }
  }

  // SPILL (particle-2) — gated by liveAvg; spills outside tile
  if (T.spill?.enable) {
    // For sprites, we *don’t* want overflow: keep as-is; for canvas allow overflow.
    if (!isSprite && wantClip) ctx.restore();

    const gGate = T.spill.liveGate || {};
    const spillK = liveWindowK(u, gGate.min ?? 0.35, gGate.max ?? 0.80, gGate.soft ?? 0.12);

    if (spillK > 0.01) {
      const dtSec =
        (typeof opts.deltaSec === 'number' && opts.deltaSec > 0)
          ? opts.deltaSec
          : (p.deltaTime ? Math.max(1/120, p.deltaTime / 1000) : 1/60);

      // sprite-mode adjustments: keep inside tile + remove global shift/nudges
      const spillRaw = Math.max(0, T.spill.spillPx ?? 40);
      const spill = isSprite ? Math.min(spillRaw, Math.round(cell * 0.10)) : spillRaw;

      const isMobile = cell <= (T.spill.mobile?.cellMax ?? 28);

      const globalShiftX = isSprite ? 0 : ((T.spill.offsetTilesX ?? 0) * cell);

      const waterTopY    = bottomY + Ttop0 * waterScaleY;
      const waterBottomY = bottomY + (Ttop0 + H0) * waterScaleY;
      const bottomBound  = y0 + h;

      const surfaceY = waterTopY;
      const bandTopY = surfaceY - cell * 0.10;
      const bandH    = Math.max(1, bottomBound - bandTopY + cell * 0.25);

      const spawnHeightPx = Math.max(8, cell * 0.35);
      const spawnFracY = Math.min(1, spawnHeightPx / Math.max(1, bandH));

      const leftSpawnFracX  = T.spill.leftSpawnFracX  ?? [0.70, 0.96];
      const rightSpawnFracX = T.spill.rightSpawnFracX ?? [0.00, 0.20];

      const leftSpawnFrac  = { x0: leftSpawnFracX[0],  x1: leftSpawnFracX[1],  y0: 0.00, y1: spawnFracY };
      const rightSpawnFrac = { x0: rightSpawnFracX[0], x1: rightSpawnFracX[1], y0: 0.00, y1: spawnFracY };

      const colWBase = Math.max(8, cell * 0.35);

      // Base X for each corridor. In sprite mode:
      //  - drop global shift and per-side nudges to keep symmetry/centering
      //  - clamp right corridor so it doesn’t extend beyond the tile
      const leftNudge  = isSprite ? 0 : ((T.spill.leftNudgePx  ?? 0) + (isMobile ? (T.spill.mobile?.leftNudgePx  ?? 0) : 0));
      const rightNudge = isSprite ? 0 : ((T.spill.rightNudgePx ?? 0) + (isMobile ? (T.spill.mobile?.rightNudgePx ?? 0) : 0));

      const leftBaseX  = x0 - spill + globalShiftX + leftNudge;
      const rightBaseX = isSprite
        ? (x0 + w - colWBase) // clamp to tile
        : (x0 + w - colWBase + globalShiftX + rightNudge);

      const leftCorridor = {
        x: leftBaseX,
        y: bandTopY,
        w: colWBase + (isMobile ? Math.round(cell * 0.25) : (T.spill.leftExtraRoomPx ?? 24)),
        h: bandH
      };
      const rightCorridor = {
        x: Math.min(rightBaseX, x0 + w - colWBase), // ensure inside tile for sprites
        y: bandTopY,
        w: colWBase + (isSprite ? Math.min(spill, Math.round(cell * 0.10)) : spill),
        h: bandH
      };

      const rMin  = Array.isArray(T.spill.sizePx) ? T.spill.sizePx[0] : (T.spill.sizePx ?? 1.2);
      const rMax  = Array.isArray(T.spill.sizePx) ? T.spill.sizePx[1] : rMin;
      const baseCount = T.spill.count ?? 28;
      const gatedCount = Math.max(0, Math.floor(baseCount * spillK));
      const alphaMul = spillK;

      const lifeMin = (T.spill.lifetimeSec?.[0] ?? 0.9);
      const lifeMax = (T.spill.lifetimeSec?.[1] ?? 1.6);
      const leftLifeMin = (T.spill.leftLifetimeSec?.[0] ?? lifeMin);
      const leftLifeMax = (T.spill.leftLifetimeSec?.[1] ?? lifeMax);

      const keySuffix = isSprite ? ':spr' : '';

      const runSide = (side) => {
        const isLeft   = side === 'L';
        const rectSim  = isLeft ? leftCorridor : rightCorridor;
        const spawnFr  = isLeft ? leftSpawnFrac : rightSpawnFrac;
        const dir      = isLeft ? 'left' : 'right';
        const spRange  = isLeft ? (T.spill.leftSpeedPxSec  ?? [60,120])
                                : (T.spill.rightSpeedPxSec ?? [14,30]);
        const accelX   = (T.spill.coneAccelX ?? 120) * (isLeft ? -1 : 1);

        if (gatedCount < 1) return;

        stepAndDrawPuffs(p, {
          key: `spill:${f.r0}:${f.c0}:${spanTilesX}x${f.h}:${side}${keySuffix}`,
          rect: rectSim,
          dir,
          spreadAngle: T.spill.spreadAngle ?? 0.45,

          spawnMode: 'stratified',
          respawnStratified: true,
          spawn: spawnFr,

          speed:  { min: spRange[0], max: spRange[1] },
          accel:  { x: accelX, y: 0 },
          gravity: T.spill.gravity ?? 360,
          jitter: { pos: 2, velAngle: 0.25 },
          drag:   T.spill.drag ?? 6,

          count:  gatedCount,
          size:   { min: rMin, max: rMax },
          sizeHz: 5,
          lifetime: isLeft
            ? { min: leftLifeMin, max: leftLifeMax }
            : { min: lifeMin,     max: lifeMax     },

          fadeInFrac: T.spill.fadeInFrac ?? 0.15,
          fadeOutFrac:T.spill.fadeOutFrac ?? 0.35,

          edgeFadePx: isLeft
            ? { left: (T.spill.leftEdgeFadeLeftPx ?? 2), right: 8, top: 8, bottom: 8 }
            : (T.spill.edgeFadePx ?? { left: 8, right: 8, top: 8, bottom: 8 }),

          color: (pr) => {
            if (pr.y > bottomBound) return { r: 0, g: 0, b: 0, a: 0 };
            const c = seaRGBAtY(pr.y, waterTopY, waterBottomY, topRGB, bottomRGB);
            return { r: c.r, g: c.g, b: c.b, a: Math.round(175 * aFactor * alphaMul) };
          },

          respawn: true,
        }, dtSec);
      };

      runSide('L');
      runSide('R');
    }

    // re-clip after spill for canvas path
    if (!isSprite && wantClip) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); }
  }

  // 2) BOWL composite (proportional; mobile-safe)
  if (T.bowl?.enable) {
    const isMobile = cell <= (T.bowl.mobile?.cellMax ?? 28);

    const kThickness = isMobile ? (T.bowl.mobile?.thicknessK  ?? T.bowl.thicknessK)  : (T.bowl.thicknessK  ?? 0.06);
    const fBase      = isMobile ? (T.bowl.mobile?.baseFrac    ?? T.bowl.baseFrac)    : (T.bowl.baseFrac    ?? 0.18);
    const fPostTop   = isMobile ? (T.bowl.mobile?.postTopFrac ?? T.bowl.postTopFrac) : (T.bowl.postTopFrac ?? 0.12);
    const kColWidth  = isMobile ? (T.bowl.mobile?.colWidthK   ?? T.bowl.colWidthK)   : (T.bowl.colWidthK   ?? 1.00);
    const kCorner    = isMobile ? (T.bowl.mobile?.cornerK     ?? T.bowl.cornerK)     : (T.bowl.cornerK     ?? 0.10);

    const tEff   = Math.max(1, Math.round(cell * kThickness));
    const baseH  = Math.max(tEff, Math.round(H0 * fBase));
    const baseY  = (bottomY + Ttop0) + H0 - baseH;
    const baseX  = cx + L0;
    const baseW  = W0;

    const postsTopY   = (bottomY + Ttop0) + Math.round(H0 * fPostTop);
    const colW        = Math.max(1, Math.round(tEff * kColWidth));
    const postR       = Math.max(0, T.bowl.pieceRadiusPx | 0);
    const baseOverlap = Math.max(0, T.bowl.baseOverlapPx ?? 2);
    const postBottomY = baseY + baseOverlap;
    const postDrawH   = Math.max(1, postBottomY - postsTopY - Math.max(0, T.bowl.postBottomLiftPx ?? Math.ceil(postR)));

    const leftX  = cx + L0;
    const rightX = cx + L0 + W0 - colW;

    const gb = T.bowl.grassBlend || {};
    const blendK = clamp01(val(gb.colorBlend ?? [0.25, 0.50], u));
    const [satLo, satHi] = gb.satRange ?? [0.00, 0.35];
    const [briLo, briHi] = gb.brightRange ?? [0.35, 0.90];

    let bowlRGB = T.bowl.color || GRASS_BASE;
    if (opts.gradientRGB) bowlRGB = blendRGB(bowlRGB, opts.gradientRGB, blendK);
    bowlRGB = clampSaturation(bowlRGB, satLo, satHi, 1);
    bowlRGB = clampBrightness(bowlRGB, briLo, briHi, 1);

    const aBowl = Math.round(255 * clamp01(T.bowl.alphaMul ?? 1) * aFactor);
    ctx.fillStyle = `rgba(${bowlRGB.r},${bowlRGB.g},${bowlRGB.b},${aBowl/255})`;

    const rCorner = Math.round(cell * kCorner);
    {
      const r = Math.min(rCorner, baseH / 2, baseW / 2);
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + baseW, baseY);
      ctx.lineTo(baseX + baseW, baseY + baseH - r);
      ctx.quadraticCurveTo(baseX + baseW, baseY + baseH, baseX + baseW - r, baseY + baseH);
      ctx.lineTo(baseX + r, baseY + baseH);
      ctx.quadraticCurveTo(baseX, baseY + baseH, baseX, baseY + baseH - r);
      ctx.lineTo(baseX, baseY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    roundedRect(ctx, leftX,  postsTopY, colW, postDrawH, postR);
    roundedRect(ctx, rightX, postsTopY, colW, postDrawH, postR);
    ctx.fill();
  }

  // top border (optional)
  if (T.topBorder.enable && (T.topBorder.topLinePx > 0)) {
    const aLine = Math.round(drawAlpha * clamp01(T.topBorder.topLineAlpha ?? 0.25));
    const kMix = clamp01(T.topBorder.topLineMix ?? 0.25);
    const lineRGB = {
      r: Math.round(topRGB.r + (bottomRGB.r - topRGB.r) * kMix),
      g: Math.round(topRGB.g + (bottomRGB.g - topRGB.g) * kMix),
      b: Math.round(topRGB.b + (bottomRGB.b - topRGB.b) * kMix),
    };
    p.push();
    p.noFill();
    p.stroke(lineRGB.r, lineRGB.g, lineRGB.b, aLine);
    p.strokeWeight(T.topBorder.topLinePx);
    p.line(cx + L0, bottomY + Ttop0, cx + L0 + W0, bottomY + Ttop0);
    p.pop();
  }

  if (wantClip) ctx.restore();
  p.pop(); // end GROUP transform
}

export default drawSea;
