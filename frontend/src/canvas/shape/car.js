// car.js
import { applyShapeMods } from './utils/shapeMods.ts';
import { blendRGB } from './utils/colorBlend.ts';
import { clampBrightness } from '../color/colorUtils.ts';
import { clamp01, val } from './utils/useLerp.ts';

/* ───────────────── Base Palette */
export const CAR_BASE_PALETTE = {
  grass: [
    { r: 110, g: 160, b: 90 },
    { r: 130, g: 180, b: 110 },
    { r: 100, g: 150, b: 85 },
  ],
  asphalt: { r: 125, g: 125, b: 125 },
  body: [
    { r: 200, g: 50,  b: 50  },  // bright red
    { r: 50,  g: 120, b: 210 },  // vivid blue
    { r: 240, g: 180, b: 60  },  // warm yellow
    { r: 90,  g: 180, b: 100 },  // fresh green
    { r: 230, g: 90,  b: 20  },  // orange-red
    { r: 255, g: 100, b: 150 },  // magenta-pink
    { r: 140, g: 90,  b: 220 },  // brighter violet
    { r: 50,  g: 180, b: 230 },  // vibrant cyan-blue
    { r: 245, g: 235, b: 120 },  // soft lemon
    { r: 100, g: 100, b: 100 },  // mid gunmetal gray (lifted)
    { r: 180, g: 70,  b: 120 },  // lighter burgundy
    { r: 120, g: 220, b: 180 },  // mint teal
    { r: 235, g: 150, b: 50  },  // golden copper
    { r: 50,  g: 130, b: 80  },  // lighter forest green
    { r: 110, g: 110, b: 200 },  // soft indigo
  ],
  window: { r: 180, g: 210, b: 235 },
  wheel:  { r: 40,  g: 40,  b: 40  },
};

/* ───────────────── Tunables */
const CAR = {
  grass:   { colorBlend: [0.20, 0.45] },
  body:    { colorBlend: [0.06, 0.16] },
  asphalt: { min: [0.25, 0.32], max: [0.52, 0.65] },

  // Y-axis wiggle for body/chassis/windows only
  bodyOscY: {
    ampR:     [0.015, 0.01],   // fraction of r
    intensity:[1, 0.3],        // 0..1 (clamped)
    speedHz:  [4, 0.35],
    phase:    [0.00, 0.00],
  },
};

/* ───────────────── Helpers */
function fillRgb(p, { r, g, b }, a = 255) { p.fill(r, g, b, a); }
function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }
function hash32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
function rand01(seed) {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
}
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

/* ───────────────── Deterministic RNG from seedKey + tag */
function rFromKey(seedKey, tag) {
  return rand01(hash32(`${tag}|${String(seedKey)}`));
}

/* ───────────────── Public “asset” API (roadless) */
export const CAR_VARIANTS = { suv: 'suv', sedan: 'sedan', jeep: 'jeep' };

export function drawCarAsset(p, cx, wheelY, r, opts = {}) {
  const ex    = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct    = typeof opts?.contrast === 'number' ? opts.contrast : 1;
  const alpha = Number.isFinite(opts?.alpha) ? opts.alpha : 235;
  const u     = clamp01(opts?.liveAvg ?? 0.5);

  // --- seedKey: prefer sprite-provided; else fallback to a stable local key
  const seedKey = (opts && (opts.seedKey ?? opts.seed)) ?? `car-asset|${Math.round(cx)}|${Math.round(wheelY)}|${Math.round(r)}`;

  // deterministic “randoms” derived from seedKey (stable per cached sprite variant)
  const rBodyPick = rFromKey(seedKey, 'bodyTint');
  const rVariant  = rFromKey(seedKey, 'variant');
  const rSide     = rFromKey(seedKey, 'sideBias');
  const rGrassA   = rFromKey(seedKey, 'grassA');
  const rGrassB   = rFromKey(seedKey, 'grassB');

  // colors
  let bodyTint = pick(CAR_BASE_PALETTE.body, rBodyPick);
  if (opts?.gradientRGB) bodyTint = blendRGB(bodyTint, opts.gradientRGB, val(CAR.body.colorBlend, u));
  bodyTint = applyExposureContrast(bodyTint, ex, ct);
  const windowTint = applyExposureContrast(CAR_BASE_PALETTE.window, ex, ct);

  // geometry shared
  const w = r * 3.2;
  const wheelR = Math.max(2, r * 0.52);

  // appear (anchor on bottom-center at the wheel baseline)
  if (opts?.useAppear !== false) {
    const m = applyShapeMods({
      p, x: cx, y: wheelY, r,
      opts: { alpha, timeMs: p.millis?.(), liveAvg: u, rootAppearK: undefined },
      mods: {
        appear: { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: 'back', backOvershoot: 1.25 },
        sizeOsc: { mode: 'none' },
      },
    });
    p.push();
    p.translate(m.x, m.y);
    p.scale(m.scaleX, m.scaleY);
    p.translate(-cx, -wheelY);
  } else {
    p.push();
  }

  /* ─── Wheels first (static; no wiggle) ─── */
  fillRgb(p, CAR_BASE_PALETTE.wheel, alpha);
  p.circle(cx - w * 0.38, wheelY, wheelR);
  p.circle(cx + w * 0.38, wheelY, wheelR);

  /* ─── Body/chassis/windows: indefinite Y wiggle with clamped intensity ─── */
  const baseAmpR   = val(CAR.bodyOscY.ampR, u);
  const intensity  = clamp01(val(CAR.bodyOscY.intensity, u));
  const oscAmp     = r * baseAmpR * intensity;
  const oscHz      = val(CAR.bodyOscY.speedHz, u);
  const oscPhase   = val(CAR.bodyOscY.phase, u) || 0;

  const mBody = applyShapeMods({
    p, x: cx, y: 0, r,
    opts: { timeMs: p.millis?.(), liveAvg: u },
    mods: { translateOscY: { amp: oscAmp, speed: oscHz, phase: oscPhase } },
  });
  const bodyYOffset = mBody.y;

  // pick variant deterministically (or honor explicit opts.variant)
  const variant =
    opts?.variant ??
    (rVariant < 0.40 ? 'suv' : (rVariant < 0.80 ? 'sedan' : 'jeep'));

  // draw body by variant (all referenced to wheelY + bodyYOffset)
  if (variant === 'suv') {
    const h = r * 1.9;
    const bodyCy = wheelY - h * 0.46 + bodyYOffset;

    p.noStroke();
    fillRgb(p, bodyTint, alpha);
    p.rect(cx - w / 2, bodyCy - h / 2, w, h, r * 0.42);

    fillRgb(p, windowTint, alpha);
    const winH = h * 0.42;
    const winY = bodyCy - h * 0.18 - winH / 2;
    p.rect(cx - w * 0.30, winY, w * 0.60, winH, r * 0.10);

  } else if (variant === 'sedan') {
    const chassisW = w * 0.94;
    const chassisH = Math.max(6, r * 0.40);
    const chassisCy = wheelY - chassisH * 0.55 + bodyYOffset;

    p.noStroke();
    fillRgb(p, bodyTint, alpha);
    p.rect(cx - chassisW / 2, chassisCy - chassisH / 2, chassisW, chassisH, r * 0.22);

    const cabinBottomW = w * 0.70;
    const cabinTopW    = cabinBottomW * 0.84;
    const cabinH       = Math.max(8, r * 1.05);
    const chassisTopY  = chassisCy - chassisH / 2;
    const cabinBaseY   = chassisTopY;
    const cabinTopY    = cabinBaseY - cabinH;

    const x0  = cx - cabinBottomW / 2;
    const x1  = cx + cabinBottomW / 2;
    const xt0 = cx - cabinTopW / 2;
    const xt1 = cx + cabinTopW / 2;

    fillRgb(p, bodyTint, alpha);
    p.beginShape();
    p.vertex(x0,  cabinBaseY);
    p.vertex(x1,  cabinBaseY);
    p.vertex(xt1, cabinTopY);
    p.vertex(xt0, cabinTopY);
    p.endShape(p.CLOSE);

    // windows
    const insetX   = Math.max(3, r * 0.25);
    const insetTop = Math.max(2, r * 0.20);
    const insetBot = Math.max(3, r * 0.28);

    const midW   = cabinTopW + (cabinBottomW - cabinTopW) * 0.45;
    const innerW = Math.max(8, midW - insetX * 2);
    const innerH = Math.max(6, (cabinBaseY - cabinTopY) - insetTop - insetBot);
    const innerX = cx - innerW / 2;
    const innerY = cabinTopY + insetTop;

    const gap  = Math.max(2, r * 0.18);
    const eachW = (innerW - gap) / 2;
    const eachH = innerH * 0.72;
    const winY  = innerY + (innerH - eachH) * 0.35;

    fillRgb(p, windowTint, alpha);
    p.rect(innerX,               winY, eachW, eachH, r * 0.10);
    p.rect(innerX + eachW + gap, winY, eachW, eachH, r * 0.10);

  } else {
    const leftAligned = rSide < 0.5;

    const chassisW = w * 0.92;
    const chassisH = Math.max(6, r * 0.65);
    const chassisCy = wheelY - chassisH * 0.58 + bodyYOffset;

    p.noStroke();
    fillRgb(p, bodyTint, alpha);
    p.rect(cx - chassisW / 2, chassisCy - chassisH / 2, chassisW, chassisH, r * 0.18);

    const cabinW      = w * 0.64;
    const cabinH      = Math.max(10, r * 1.15);
    const chassisTopY = chassisCy - chassisH / 2;
    const cabinBaseY  = chassisTopY;
    const cabinTopY   = cabinBaseY - cabinH;

    const sidePad = r * 0.20;
    const cabinX0 = leftAligned
      ? (cx - chassisW / 2 + sidePad)
      : (cx + chassisW / 2 - cabinW - sidePad);

    fillRgb(p, bodyTint, alpha);
    p.rect(cabinX0, cabinTopY, cabinW, cabinH, r * 0.10);

    // windows
    const pad = Math.max(3, r * 0.22);
    const innerW = cabinW - pad * 2;
    const innerH = cabinH - pad * 2;
    const gap    = Math.max(2, r * 0.20);
    const eachW  = (innerW - gap) / 2;
    const eachH  = innerH * 0.70;
    const winY   = cabinTopY + pad + (innerH - eachH) * 0.30;

    fillRgb(p, windowTint, alpha);
    p.rect(cabinX0 + pad,               winY, eachW, eachH, r * 0.08);
    p.rect(cabinX0 + pad + eachW + gap, winY, eachW, eachH, r * 0.08);
  }

  p.pop();
}

/* ───────────────── Fit helpers (width-based) */
export function fitScaleToRectWidth(contentW, rectW, pad = 0, { allowUpscale = false } = {}) {
  const usable = Math.max(1, rectW - pad * 2);
  const s = usable / Math.max(1, contentW);
  return allowUpscale ? s : Math.min(1, s);
}
export function beginFitScale(p, { cx, anchorY, scale }) {
  p.push(); p.translate(cx, anchorY); p.scale(scale, scale); p.translate(-cx, -anchorY);
}
export function endFitScale(p) { p.pop(); }

/* ───────────────── Tile-aware wrapper (fits the asset to tile width) */
export function drawCar(p, cx, cy, r, opts = {}) {
  const ex = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct = typeof opts?.contrast === 'number' ? opts.contrast : 1;
  const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 235;
  const u = clamp01(opts?.liveAvg ?? 0.5);

  // Resolve tile rect
  const cell = opts?.cell;
  const f    = opts?.footprint;
  let tileX, tileY, tileW, tileH;
  if (cell && f) {
    tileX = f.c0 * cell; tileY = f.r0 * cell; tileW = f.w * cell; tileH = f.h * cell;
  } else {
    tileW = r * 3.0; tileH = r * 3.0; tileX = cx - tileW / 2; tileY = cy - tileH / 2;
  }

  // sprite-aware seedKey: prefer external (from sprite factory), else local tile-based
  const seedKey = (opts && (opts.seedKey ?? opts.seed)) ?? `car|${Math.round(tileX)}|${Math.round(tileY)}|${Math.round(tileW)}x${Math.round(tileH)}`;

  // ground layers (deterministic two-tone grass for variety)
  const rGrass1 = rFromKey(seedKey, 'ground:grass1');
  const rGrass2 = rFromKey(seedKey, 'ground:grass2');

  const grassH = tileH * 0.5;
  const grassY = tileY + tileH - grassH;
  const aspH   = grassH * 0.38;
  const aspY   = grassY + (grassH - aspH) / 2;

  // appear anchored to bottom-center of tile
  const baseY = tileY + tileH;
  const m = applyShapeMods({
    p, x: cx, y: baseY, r,
    opts: { alpha, timeMs: opts.timeMs, liveAvg: opts.liveAvg, rootAppearK: opts.rootAppearK },
    mods: {
      appear: { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: 'back', backOvershoot: 1.25 },
      sizeOsc: { mode: 'none' },
    },
  });

  p.push();
  p.translate(m.x, m.y);
  p.scale(m.scaleX, m.scaleY);
  p.translate(-cx, -baseY);

  // grass
  const g1 = pick(CAR_BASE_PALETTE.grass, rGrass1);
  const g2 = pick(CAR_BASE_PALETTE.grass, rGrass2);
  let grassTint = blendRGB(g1, g2, 0.4 + 0.3 * u);
  if (opts.gradientRGB) grassTint = blendRGB(grassTint, opts.gradientRGB, val(CAR.grass.colorBlend, u));
  grassTint = applyExposureContrast(grassTint, ex, ct);

  p.noStroke();
  fillRgb(p, grassTint, alpha);
  p.rect(tileX, grassY, tileW, grassH, r * 0.18);

  // asphalt
  let aspColor = applyExposureContrast(CAR_BASE_PALETTE.asphalt, ex, ct);
  aspColor = clampBrightness(aspColor, val(CAR.asphalt.min, u), val(CAR.asphalt.max, u));
  fillRgb(p, aspColor, alpha);
  p.rect(tileX, aspY, tileW, aspH, r * 0.14);

  // compute wheel baseline from road
  const wheelY = aspY + aspH * 0.62;

  // fit the car asset to the tile width so proportions stay consistent
  const designW = r * 3.2;                             // intrinsic car width at radius r
  const sidePad = Math.max(2, tileW * 0.06);           // small visual gutter
  const s = fitScaleToRectWidth(designW, tileW, sidePad, { allowUpscale: !!opts.allowUpscale });

  beginFitScale(p, { cx, anchorY: wheelY, scale: s });
  drawCarAsset(p, cx, wheelY, r, {
    alpha,
    exposure: ex,
    contrast: ct,
    gradientRGB: opts.gradientRGB,
    liveAvg: u,
    // pass through seedKey so color/variant match the sprite variant cache key
    seedKey,
    useAppear: false,
  });
  endFitScale(p);

  p.pop();
}

/* ───────────────── Standalone wrappers (no grid needed) ───────────────── */

/** Place a car centered at (cx, baselineY) with radius r, optionally fitted to rect width. */
export function drawCarStandalone(p, cx, baselineY, r, opts = {}) {
  const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 235;
  const designW = r * 3.2;
  const sidePad = Math.max(2, r * 0.08);

  const rect = opts.fitRect; // {x,y,w,h}
  const seedKey = (opts && (opts.seedKey ?? opts.seed)) ?? `car-standalone|${Math.round(cx)}|${Math.round(baselineY)}|${Math.round(r)}`;

  if (rect) {
    const s = fitScaleToRectWidth(designW, rect.w, sidePad, { allowUpscale: !!opts.allowUpscale });
    const anchorX = cx;
    const anchorY = baselineY;
    beginFitScale(p, { cx: anchorX, anchorY, scale: s });
    drawCarAsset(p, cx, baselineY, r, { ...opts, alpha, useAppear: false, seedKey });
    endFitScale(p);
  } else {
    drawCarAsset(p, cx, baselineY, r, { ...opts, alpha, useAppear: true, seedKey });
  }
}

/** Draw a car inside a pixel rect, auto-sizing r from the rect width. */
export function drawCarInRect(p, x, y, w, h, opts = {}) {
  const bottomPad = Math.max(2, Math.round(h * (opts.bottomPadK ?? 0.06)));
  const sidePad   = Math.max(2, Math.round(w * (opts.sidePadK ?? 0.06)));
  const usableW   = Math.max(4, w - sidePad * 2);

  // Pick an r that makes the intrinsic width ~ usableW (before scale)
  const r = usableW / 3.2;

  const cx = x + w / 2;
  const baselineY = y + h - bottomPad;

  // Protect against overflow: scale to width with the chosen r
  const designW = r * 3.2;
  const s = fitScaleToRectWidth(designW, w, sidePad, { allowUpscale: !!opts.allowUpscale });

  const seedKey = (opts && (opts.seedKey ?? opts.seed)) ?? `car-rect|${Math.round(x)}|${Math.round(y)}|${Math.round(w)}x${Math.round(h)}`;

  beginFitScale(p, { cx, anchorY: baselineY, scale: s });
  drawCarAsset(p, cx, baselineY, r, { ...opts, useAppear: false, seedKey });
  endFitScale(p);
}
