import { applyShapeMods } from './utils/shapeMods.ts';
import { blendRGB } from './utils/colorBlend.ts';
import { clampBrightness } from '../color/colorUtils.ts';
import { clamp01, val } from './utils/useLerp.ts';

// reuse fit helpers from car.js so behavior matches car exactly
import {
  fitScaleToRectWidth,
  beginFitScale,
  endFitScale,
} from './car.js';

export const BUS_BASE_PALETTE = {
  grass: [
    { r: 110, g: 160, b: 90 },
    { r: 130, g: 180, b: 110 },
    { r: 100, g: 150, b: 85 },
  ],
  asphalt: { r: 125, g: 125, b: 125 },
  body: [
    { r: 230, g: 110, b: 30 },
    { r: 255, g: 150, b: 40 },
    { r: 220, g: 80,  b: 40 },
  ],
  window: { r: 180, g: 210, b: 235 },
  wheel:  { r: 40,  g: 40,  b: 40  },
};

const BUS = {
  grass:   { colorBlend: [0.20, 0.45] },
  body:    { colorBlend: [0.10, 0.04] },
  asphalt: { min: [0.25, 0.32], max: [0.52, 0.65] },
};

// utils
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
function seeded01(key, salt = '') {
  return rand01(hash32(`${key}|${salt}`));
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

/**
 * Draws a bus that scales like car.js on small/mobile tiles.
 * Variety is driven by opts.seedKey (or tile footprint) so caching won't collapse colors.
 */
export function drawBus(p, cx, cy, r, opts = {}) {
  const ex = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct = typeof opts?.contrast === 'number' ? opts.contrast : 1;
  const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 235; // used for ground/wheels
  const u = clamp01(opts?.liveAvg ?? 0.5);

  // ---- Tile rect
  const cell = opts?.cell;
  const f    = opts?.footprint;
  let tileX, tileY, tileW, tileH, tileCx;

  if (cell && f) {
    tileX = f.c0 * cell; tileY = f.r0 * cell; tileW = f.w * cell; tileH = f.h * cell;
    tileCx = tileX + tileW / 2;
  } else {
    tileW = r * 6.4; tileH = r * 3.0; tileX = cx - tileW / 2; tileY = cy - tileH / 2;
    tileCx = cx;
  }

  // ---- Stable per-instance seed (independent of offscreen center/radius)
  const seedKey =
    (opts.seedKey ?? opts.seed)
    ?? (cell && f ? `bus|${f.r0}:${f.c0}|${f.w}x${f.h}` : `bus|${Math.round(cx)}|${Math.round(cy)}|${Math.round(r)}`);

  const r1 = seeded01(seedKey, 'a');
  const r2 = seeded01(seedKey, 'b');

  // ---- Appear anchored to bottom-center of the TILE (not cx)
  const baseY = tileY + tileH;
  const m = applyShapeMods({
    p, x: tileCx, y: baseY, r,
    opts: { alpha, timeMs: opts.timeMs, liveAvg: opts.liveAvg, rootAppearK: opts.rootAppearK },
    mods: {
      appear: { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: 'back', backOvershoot: 1.25 },
      sizeOsc: { mode: 'none' },
    },
  });

  p.push();
  p.translate(m.x, m.y);
  p.scale(m.scaleX, m.scaleY);
  p.translate(-tileCx, -baseY);

  // ---- Ground (unscaled inside appear group)
  const grassH = tileH * 0.50;
  const grassY = tileY + tileH - grassH;
  const aspH   = grassH * 0.38;
  const aspY   = grassY + (grassH - aspH) / 2;

  // Grass tint (with gradient) — seeded variety
  const g1 = pick(BUS_BASE_PALETTE.grass, r1);
  const g2 = pick(BUS_BASE_PALETTE.grass, r2);
  let grassTint = blendRGB(g1, g2, 0.4 + 0.3 * u);
  if (opts.gradientRGB) grassTint = blendRGB(grassTint, opts.gradientRGB, val(BUS.grass.colorBlend, u));
  grassTint = applyExposureContrast(grassTint, ex, ct);

  p.noStroke();
  fillRgb(p, grassTint, alpha);
  p.rect(tileX, grassY, tileW, grassH, r * 0.18);

  // Asphalt
  let aspColor = applyExposureContrast(BUS_BASE_PALETTE.asphalt, ex, ct);
  aspColor = clampBrightness(aspColor, val(BUS.asphalt.min, u), val(BUS.asphalt.max, u));
  fillRgb(p, aspColor, alpha);
  p.rect(tileX, aspY, tileW, aspH, r * 0.14);

  // ---- Wheel baseline from road
  const wheelY = aspY + aspH * 0.25;

  // ---- Fit the bus asset to tile width (like car.js)
  const designW = r * 6.4;
  const sidePad = Math.max(2, tileW * 0.08);
  const s = fitScaleToRectWidth(designW, tileW, sidePad, { allowUpscale: !!opts.allowUpscale });

  // Body/window colors — seeded body pick
  let bodyTint = pick(BUS_BASE_PALETTE.body, r1);
  if (opts.gradientRGB) bodyTint = blendRGB(bodyTint, opts.gradientRGB, val(BUS.body.colorBlend, u));
  bodyTint = applyExposureContrast(bodyTint, ex, ct);
  const winTint = applyExposureContrast(BUS_BASE_PALETTE.window, ex, ct);

  // ---- Draw bus under width-fit transform
  beginFitScale(p, { cx: tileCx, anchorY: wheelY, scale: s });
  {
    const w = designW;
    const bodyH = r * 2.0;
    const busX  = tileCx - w / 2;

    // Wheels (two rear, one front)
    const wheelD = Math.max(3, r * 0.85);
    fillRgb(p, BUS_BASE_PALETTE.wheel, 255);
    p.circle(busX + w * 0.22, wheelY, wheelD);
    p.circle(busX + w * 0.38, wheelY, wheelD);
    p.circle(busX + w * 0.78, wheelY, wheelD);

    // Body
    fillRgb(p, bodyTint, 255);
    const bodyY = wheelY - bodyH * 1.00;
    p.rect(busX, bodyY, w, bodyH, r * 0.22);

    // Windows
    fillRgb(p, winTint, 255);
    const smallCount = 4;
    const gap        = w * 0.02;
    const frontW     = Math.max(w * 0.20, r * 2.4);
    const winH       = bodyH * 0.42;
    const winY       = bodyY + bodyH * 0.20;

    const usableForSmall = w - frontW - gap * (smallCount + 2);
    const smallW = Math.max(6, usableForSmall / smallCount);

    let wx = busX + gap;
    for (let i = 0; i < smallCount; i++) {
      p.rect(wx, winY, smallW, winH, r * 0.08);
      wx += smallW + gap;
    }

    const frontX = busX + w - frontW;
    const frontY = winY - Math.max(0, r * 0.02);
    p.rect(frontX, frontY, frontW, winH, r * 0.10, r * 0.30, 0, r * 0.08);
  }
  endFitScale(p);

  p.pop();
}

export default drawBus;
