// src/canvas/shape/power.js
import { applyShapeMods } from './utils/shapeMods.ts';
import { clamp01, val } from './utils/useLerp.ts';
import { blendRGB } from './utils/colorBlend.ts';
import { stepAndDrawPuffs } from './particles/particle-2.ts';
import { clampBrightness, oscillateSaturation } from '../color/colorUtils.ts';

/* Exposure/contrast helper (channel-space, gentle defaults) */
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

/* Palette */
export const POWER_BASE_PALETTE = {
  grass:    { r: 120, g: 180, b: 110 },
  mast:     { r: 203, g: 209, b: 209 },
  mastCore: { r: 178, g: 191,  b: 190 },
  hub:      { r: 185, g: 189, b: 188 },
  blade:    { r: 230, g: 235, b: 244 },
  bladeLine:{ r: 210, g: 120, b: 212 },
};

/* Tunables (lerp-able) */
const POWER = {
  grass: { colorBlend: [0.4, 0.30], satRange: [0.00, 0.80] },
  platform: { hFrac: [0.28, 0.34], radiusK: 0.12 },
  mast: {
    widthK:  [0.18, 0.22],
    waistK:  [0.82, 0.88],
    topRound:[0.32, 0.46],
    insetX:  [0.10, 0.12],
    topFrac: [0.14, 0.22],
    headroom:[0.12, 0.20],
    coreBlend: [0, 0.02],
  },
  rotor: {
    hubRk:   [0.11, 0.15],
    bladeLk: [0.82, 1.10],
    bladeWk: [0.10, 0.14],
    bladeTipRound: 0.6,
    spinSpeed: [0.20, 0.55],
    spinJitter: Math.PI * 0.6,
    scaleK: [1.15, 1],
    hubYOffsetK: [0.28, 0.16],
    line: {
      weight: [1, 2],
      lenK:   [0.5, 0.65],
      offset: [5, 7],
      alpha:  [150, 125],
    },
    bladeOsc: { amp: [0.10, 0.033], speed: [1.6, 1.2] },
  },
};

/* Helpers */
function clampBrightnessLocal(rgb, minK, maxK) {
  const maxC = Math.max(rgb.r, rgb.g, rgb.b);
  const k = maxC / 255 || 1;
  const l = Math.max(minK, Math.min(maxK, k));
  const s = l / k;
  return { r: Math.round(rgb.r * s), g: Math.round(rgb.g * s), b: Math.round(rgb.b * s) };
}
function clampSaturation(rgb, minS, maxS) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const v = max;
  const s = max ? (max - min) / max : 0;
  const s2 = Math.max(minS, Math.min(maxS, s));
  if (s === 0 || s2 === s) return rgb;
  const m = (max - min) ? (s2 * v) / (max - min) : 1;
  const r = v - (v - rgb.r) * m;
  const g = v - (v - rgb.g) * m;
  const b = v - (v - rgb.b) * m;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
function fillRgb(p, { r, g, b }, a = 255) { p.fill(r, g, b, a); }
function strokeRgb(p, { r, g, b }, a = 255) { p.stroke(r, g, b, a); }
function mulRgb(rgb, k) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return { r: clamp(rgb.r * k), g: clamp(rgb.g * k), b: clamp(rgb.b * k) };
}

/* Deterministic noise / randomness */
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

/* Factory smoke config (purple-tinted, house-like params) */
const FACTORY_SMOKE = {
  spawnX: [0, 0.80],
  spawnY: [0.30, 0.30],
  count:  [48, 16],
  sizeMin:[3, 0],
  sizeMax:[6, 1],
  lifeMin:[12, 3],
  lifeMax:[24, 5],
  alpha:  [210, 0],
  dir: 'up',
  spreadAngle: [6, 0.26],
  speedMin: [6, 14],
  speedMax: [12, 22],
  gravity: [-16, -8],
  drag: [0.55, 0.72],
  jitterPos: [0.4, 1.2],
  jitterAngle: [0.06, 0.16],
  fadeInFrac: 0.22,
  fadeOutFrac: 0.38,
  edgeFadePx: { left: 2, right: 2, top: 2, bottom: 4 },
  sizeHz: 4,
  base: blendRGB(POWER_BASE_PALETTE.bladeLine, { r: 60, g: 60, b: 80 }, 0.65),
  blendK: [0.05, 0.60],
  satOscAmp: [0.2, 0.4],
  satOscSpeed: [0.12, 0.20],
  brightnessRange: [2, 0.5],
};

/* Probability */
function windProbability(u) {
  const p0 = 0.15;
  if (u <= 0.4) {
    const t = u / 0.3;
    return p0 + (0.5 - p0) * t;
  } else {
    const t = (u - 0.4) / 0.6;
    return 0.5 + 0.5 * t;
  }
}
function instanceRand01(f) {
  const seed = hash32(`power-kind|${f?.r0}|${f?.c0}|${f?.w}x${f?.h}`);
  return rand01(seed);
}

// Decide layout + roof height, deterministically per tile
function factoryLayout(f) {
  const seed = hash32(`factory-layout|${f?.r0}|${f?.c0}|${f?.w}x${f?.h}`);
  const rA = rand01(seed ^ 0x9e3779b9); // side
  const rB = rand01(seed ^ 0x85ebca6b); // roof height
  const chimneyOnLeft = rA < 0.5;
  // roofRise as a fraction of tile height (gentle variety)
  const roofRiseK = 0.08 + 0.08 * rB; // 0.08..0.16 of pxH
  return { chimneyOnLeft, roofRiseK };
}

/* Body color variants (darker industrial tints, deterministic per tile) */
function pickBodyTintVariant(f, gradientRGB, ex, ct) {
  const seed = hash32(`power-body|${f?.r0}|${f?.c0}|${f?.w}x${f?.h}`);
  const r = rand01(seed);
  const variants = [
    mulRgb(POWER_BASE_PALETTE.mast, 0.78),
    mulRgb(POWER_BASE_PALETTE.mast, 0.82),
    blendRGB(mulRgb(POWER_BASE_PALETTE.mast, 0.85), POWER_BASE_PALETTE.hub, 0.15),
    blendRGB(mulRgb(POWER_BASE_PALETTE.mast, 0.88), POWER_BASE_PALETTE.mastCore, 0.10),
  ];
  let tint = variants[Math.floor(r * variants.length) % variants.length];
  if (gradientRGB) tint = blendRGB(tint, gradientRGB, 0.06);
  return applyExposureContrast(tint, ex, ct);
}

/* Draw */
export function drawPower(p, cx, cy, r, opts = {}) {
  const cell = opts?.cell;
  const f    = opts?.footprint;
  const u    = clamp01(opts?.liveAvg ?? 0.5);
  const ex   = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct   = typeof opts?.contrast === 'number' ? opts.contrast : 1;
  const baseAlpha = Number.isFinite(opts.alpha) ? opts.alpha : 235;

  // Resolve pixel rect
  let pxX, pxY, pxW, pxH;
  if (cell && f) {
    pxX = f.c0 * cell;
    pxY = f.r0 * cell;
    pxW = f.w * cell;
    pxH = f.h * cell;
  } else {
    pxW = (cell || r * 2) * 1;
    pxH = (cell || r * 2) * 3;
    pxX = (cx ?? 0) - pxW / 2;
    pxY = (cy ?? 0) - pxH / 2;
  }

  // Decide: turbine vs factory
  const rInst = f ? instanceRand01(f) : Math.random();
  const asTurbine = rInst < windProbability(u);

  // Appear envelope
  const anchorX = pxX + pxW / 2;
  const anchorY = pxY + pxH;
  const m = applyShapeMods({
    p,
    x: anchorX,
    y: anchorY,
    r: Math.min(pxW, pxH),
    opts: { alpha: baseAlpha, timeMs: opts.timeMs, liveAvg: opts.liveAvg, rootAppearK: opts.rootAppearK },
    mods: {
      appear: { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: 'back', backOvershoot: 1.25 },
      sizeOsc: { mode: 'none' },
    },
  });

  const alpha = (typeof m.alpha === 'number') ? m.alpha : baseAlpha;

  p.push();
  p.translate(m.x, m.y);
  p.scale(m.scaleX, m.scaleY);
  p.translate(-anchorX, -anchorY);

  /* Grass platform */
  const platFrac = val(POWER.platform.hFrac, u);
  const platH = Math.max(4, Math.round((cell || Math.max(6, pxH / 3)) * platFrac));
  const platY = pxY + pxH - platH;

  let grassTint = POWER_BASE_PALETTE.grass;
  if (opts.gradientRGB) grassTint = blendRGB(grassTint, opts.gradientRGB, val(POWER.grass.colorBlend, u));
  grassTint = clampSaturation(grassTint, POWER.grass.satRange[0], POWER.grass.satRange[1]);
  grassTint = clampBrightnessLocal(grassTint, 0.35, 0.90);
  grassTint = applyExposureContrast(grassTint, ex, ct);

  const rTop = Math.round((cell || 10) * POWER.platform.radiusK);
  p.noStroke();
  fillRgb(p, grassTint, alpha);
  p.rect(pxX, platY, pxW, platH, rTop, rTop, 0, 0);

  /* === FACTORY MODE === */
  if (!asTurbine) {
    // orientation (mirror per tile) + mild roof height variation
    const orientSeed = hash32(`factory-orient|${f?.r0}|${f?.c0}|${f?.w}x${f?.h}`);
    const isLeftChimney = (orientSeed & 1) === 0;
    const roofVar = 0.9 + 0.25 * rand01(orientSeed ^ 0xBEEF);

    // 1) body + roof triangle (same tint)
    const bodyTint = pickBodyTintVariant(f, opts.gradientRGB, ex, ct);
    const bodyMarginX = Math.round(pxW * 0.14);
    const bodyW = Math.max(12, pxW - bodyMarginX * 2);
    const bodyH = Math.max(Math.round(pxH * 0.16), Math.round(cell * 0.9));
    const bodyX = pxX + bodyMarginX;
    const bodyTop = platY - bodyH;

    p.noStroke();
    fillRgb(p, bodyTint, 255);
    p.rect(bodyX, bodyTop, bodyW, bodyH);

    // single-slope roof
    const roofRise = Math.round(Math.min(pxH * 0.10, cell * roofVar));
    const xL = bodyX, xR = bodyX + bodyW, yTop = bodyTop + 1;
    const highX = isLeftChimney ? xL : xR;
    const lowX  = isLeftChimney ? xR : xL;

    fillRgb(p, bodyTint, 255);
    p.triangle(lowX, yTop, highX, yTop, highX, yTop - roofRise);

    // roof line accent
    p.strokeWeight(1);
    strokeRgb(p, POWER_BASE_PALETTE.mastCore, 255);
    p.noFill();
    p.line(lowX, yTop, highX, yTop - roofRise);
    p.noStroke();

    // 2) door (centered)
    const doorW = bodyW * 0.18;
    const doorH = bodyH * 0.32;
    const doorX = bodyX + bodyW / 2 - doorW / 2;
    const doorY = platY - doorH - 2;
    const doorTint = applyExposureContrast(mulRgb(bodyTint, 0.8), ex, ct);
    fillRgb(p, doorTint, 255);
    p.rect(doorX, doorY, doorW, doorH, 1, 1, 0, 0);

    // 3) particles
    const tSec = (typeof opts.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000;
    const emitW = Math.max(10, Math.round(bodyW * 0.20));
    const emitH = Math.max(48, Math.round(cell * 2.2));
    const emitX = (isLeftChimney ? xL : xR) - (isLeftChimney ? -Math.round(emitW / 2) : Math.round(emitW / 2));
    const emitY = (yTop - roofRise) - Math.round(cell * 1.0);

    const blendK = val(FACTORY_SMOKE.blendK, u);
    const satAmp = val(FACTORY_SMOKE.satOscAmp, u);
    const satSpd = val(FACTORY_SMOKE.satOscSpeed, u);

    let baseSmoke = FACTORY_SMOKE.base;
    if (opts.gradientRGB) baseSmoke = blendRGB(baseSmoke, opts.gradientRGB, blendK);
    let smoked = oscillateSaturation(baseSmoke, tSec, { amp: satAmp, speed: satSpd, phase: 0 });
    smoked = clampBrightness(smoked, FACTORY_SMOKE.brightnessRange[0], FACTORY_SMOKE.brightnessRange[1]);
    smoked = applyExposureContrast(smoked, ex, ct);
    const smokeColor = { r: smoked.r, g: smoked.g, b: smoked.b, a: Math.max(0, Math.min(255, Math.round(val(FACTORY_SMOKE.alpha, u)))) };
    const dt = Math.max(0.001, (p.deltaTime || 16) / 1000);

    stepAndDrawPuffs(p, {
      key: `factory-smoke:${f?.r0}:${f?.c0}:${f?.w}x${f?.h}`,
      rect: { x: emitX, y: emitY, w: emitW, h: emitH },
      dir: FACTORY_SMOKE.dir,
      spreadAngle: val(FACTORY_SMOKE.spreadAngle, u),
      speed: { min: val(FACTORY_SMOKE.speedMin, u), max: val(FACTORY_SMOKE.speedMax, u) },
      gravity: val(FACTORY_SMOKE.gravity, u),
      drag: val(FACTORY_SMOKE.drag, u),
      accel: { x: 0, y: 0 },
      spawn: {
        x0: Math.min(val(FACTORY_SMOKE.spawnX, 0), val(FACTORY_SMOKE.spawnX, u)),
        x1: Math.max(val(FACTORY_SMOKE.spawnX, u), 1 - (1 - val(FACTORY_SMOKE.spawnX, u))),
        y0: Math.min(val(FACTORY_SMOKE.spawnY, 0), val(FACTORY_SMOKE.spawnY, u)),
        y1: Math.max(val(FACTORY_SMOKE.spawnY, u), 1 - (1 - val(FACTORY_SMOKE.spawnY, u))),
      },
      jitter: { pos: val(FACTORY_SMOKE.jitterPos, u), velAngle: val(FACTORY_SMOKE.jitterAngle, u) },
      count: Math.max(4, Math.floor(val(FACTORY_SMOKE.count, u))),
      size: { min: val(FACTORY_SMOKE.sizeMin, u), max: Math.max(val(FACTORY_SMOKE.sizeMin, u), val(FACTORY_SMOKE.sizeMax, u)) },
      sizeHz: FACTORY_SMOKE.sizeHz,
      lifetime: {
        min: Math.max(0.05, val(FACTORY_SMOKE.lifeMin, u)),
        max: Math.max(val(FACTORY_SMOKE.lifeMin, u), val(FACTORY_SMOKE.lifeMax, u))
      },
      fadeInFrac: FACTORY_SMOKE.fadeInFrac,
      fadeOutFrac: FACTORY_SMOKE.fadeOutFrac,
      edgeFadePx: FACTORY_SMOKE.edgeFadePx,
      color: smokeColor,
      respawn: true,
    }, dt);

    // 4) chimney
    const chimW  = Math.max(12, Math.round(pxW * 0.26));
    const peakY  = yTop - roofRise;
    const chimTopTarget = Math.max(pxY + 6, peakY - Math.round(pxH * 0.05));
    const chimH  = Math.max(10, platY - chimTopTarget);
    const chimX  = isLeftChimney ? (xL) : (xR - chimW);
    const chimY  = platY - chimH;

    let chimTint = POWER_BASE_PALETTE.mast;
    if (opts.gradientRGB) chimTint = blendRGB(chimTint, opts.gradientRGB, 0.08);
    chimTint = applyExposureContrast(chimTint, ex, ct);
    fillRgb(p, chimTint, 255);
    p.rect(chimX, chimY, chimW, chimH);
    p.rect(chimX, chimY - 2, chimW, 3);

    const capOver = Math.round(chimW * 0.15);
    p.strokeWeight(4);
    strokeRgb(p, POWER_BASE_PALETTE.mastCore, 255);
    const capX0 = chimX - capOver / 2;
    const capX1 = chimX + chimW + capOver / 2;
    p.line(capX0, chimY - 2, capX1, chimY - 2);
    p.noStroke();

    p.pop();
    return;
  }


  /* === TURBINE MODE (unchanged) === */

  const insetX   = Math.round(pxW * val(POWER.mast.insetX, u));
  const baseW    = Math.max(6, Math.round(pxW * val(POWER.mast.widthK, u)));
  const waistW   = Math.max(4, Math.round(baseW * val(POWER.mast.waistK, u)));
  const topRFrac = val(POWER.mast.topRound, u);

  const groundTop   = pxY + pxH;
  const mastBottomY = groundTop - Math.max(4, Math.round((cell || Math.max(6, pxH / 3)) * platFrac));
  const mastTopFrac = val(POWER.mast.topFrac, u);
  const headroom    = val(POWER.mast.headroom, u);
  const tileTopY    = pxY + Math.round(pxH * mastTopFrac);
  const mastTopY    = Math.min(tileTopY + Math.round(pxH * headroom * 0.22), mastBottomY - 32);
  const mastH       = Math.max(16, mastBottomY - mastTopY);

  const cxTile = pxX + pxW / 2;
  const baseX0 = cxTile - baseW / 2;
  const baseX1 = cxTile + baseW / 2;
  const waistX0 = cxTile - waistW / 2;
  const waistX1 = cxTile + waistW / 2;

  const minX = pxX + insetX;
  const maxX = pxX + pxW - insetX;
  const clampX = (v) => Math.max(minX, Math.min(maxX, v));

  const b0 = clampX(baseX0), b1 = clampX(baseX1);
  const w0 = clampX(waistX0), w1 = clampX(waistX1);

  let mastTint2 = POWER_BASE_PALETTE.mast;
  if (opts.gradientRGB) mastTint2 = blendRGB(mastTint2, opts.gradientRGB, 0.10);
  mastTint2 = applyExposureContrast(mastTint2, ex, ct);

  const hubR   = Math.max(4, Math.round((cell || pxW) * val(POWER.rotor.hubRk, u)));
  const hubCx  = cxTile;
  const hubCy  = mastTopY + Math.round(mastH * val(POWER.rotor.hubYOffsetK, u));

  p.noStroke();
  fillRgb(p, mastTint2, 255);
  p.beginShape();
  p.vertex(b0, mastBottomY);
  p.vertex(b1, mastBottomY);
  p.vertex(w1, mastTopY + Math.round(mastH * 0.42));
  p.vertex(w0, mastTopY + Math.round(mastH * 0.42));
  p.endShape(p.CLOSE);

  let coreBase = POWER_BASE_PALETTE.mastCore;
  if (opts.gradientRGB) coreBase = blendRGB(coreBase, opts.gradientRGB, val(POWER.mast.coreBlend, u));
  const coreTint = applyExposureContrast(coreBase, ex, ct);

  const capW  = Math.max(4, Math.round(waistW * 0.98));
  const capR  = Math.round(capW * topRFrac);
  const capCx = cxTile;
  const capY  = mastTopY + Math.round(mastH * 0.42);

  const invX = (m?.scaleX && m.scaleX !== 0) ? 1 / m.scaleX : 1;
  const invY = (m?.scaleY && m.scaleY !== 0) ? 1 / m.scaleY : 1;

  p.push();
  p.rectMode(p.CENTER);
  p.translate(capCx, capY - capR);
  p.scale(invX, invY);
  fillRgb(p, coreTint, 255);
  p.rect(0, 0, capW, capR * 2, capR, capR, 0, 0);
  p.pop();

  const capTopY = (capY - capR) - capR;

  p.push();
  const hiW = Math.max(2, Math.round(Math.max(4, Math.round(waistW * 0.98)) * 0.36));
  const hiX = cxTile - Math.max(1, Math.round(Math.max(4, Math.round(waistW * 0.98)) * 0.18));
  const hiY = mastTopY + Math.round(mastH * 0.30);
  const hiH = Math.max(6, Math.round(mastH * 0.12));
  p.translate(hiX + hiW / 2, hiY + hiH / 2);
  p.scale(invX, invY);
  p.rectMode(p.CENTER);
  fillRgb(p, coreTint, Math.round(alpha * 0.45));
  p.rect(0, 0, hiW, hiH);
  p.pop();

  {
    p.push();
    p.strokeWeight(3);
    strokeRgb(p, POWER_BASE_PALETTE.mastCore, 255);
    p.noFill();
    const lineEndY = capTopY + 2;
    p.line(hubCx, hubCy, hubCx, lineEndY);
    p.pop();
  }

  const bladeL = Math.max(hubR * 2, Math.round((cell || pxW) * val(POWER.rotor.bladeLk, u)));
  const bladeW = Math.max(2, Math.round((cell || pxW) * val(POWER.rotor.bladeWk, u)));
  const tipR   = Math.round(bladeW * POWER.rotor.bladeTipRound);

  const tSec  = (typeof opts.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000;
  const seed  = hash32(`power|${f?.r0}|${f?.c0}|${f?.w}x${f?.h}`) >>> 0;
  const phase = rand01(seed) * POWER.rotor.spinJitter;
  const speed = (typeof opts.rotorSpeed === 'number') ? opts.rotorSpeed : val(POWER.rotor.spinSpeed, u);

  const hubTint   = applyExposureContrast(POWER_BASE_PALETTE.hub,   ex, ct);
  const lineTint  = applyExposureContrast(POWER_BASE_PALETTE.bladeLine, ex, ct);

  const baseBlade = applyExposureContrast(POWER_BASE_PALETTE.blade, ex, ct);
  const oscAmp    = val(POWER.rotor.bladeOsc.amp, u);
  const oscSpd    = val(POWER.rotor.bladeOsc.speed, u);
  const phase2    = phase + Math.PI * 2 * rand01(seed ^ 0xABCDEF);
  const oscK      = 1 + oscAmp * Math.sin(tSec * oscSpd + phase2);
  const bladeTint = mulRgb(baseBlade, oscK);

  const rotorMods = applyShapeMods({
    p, x: hubCx, y: hubCy, r: hubR,
    opts: { timeMs: opts.timeMs, liveAvg: opts.liveAvg },
    mods: {
      rotation: { speed, phase },
      scale2D:  { x: val(POWER.rotor.scaleK, u), y: val(POWER.rotor.scaleK, u), anchor: 'bottom-center' },
    }
  });

  p.push();
  p.translate(hubCx, hubCy);
  p.rotate(rotorMods.rotation || 0);

  const sc = rotorMods.scaleX ?? 1;
  p.translate(0, hubR);
  p.scale(sc, sc);
  p.translate(0, -hubR);

  const lineW   = Math.max(1, Math.round(val(POWER.rotor.line.weight, u)));
  const lineLen = Math.round(bladeL * val(POWER.rotor.line.lenK, u));
  const lineOff = Math.round(val(POWER.rotor.line.offset, u));
  const lineA   = Math.round(val(POWER.rotor.line.alpha, u));
  const lineY   = Math.round(bladeW / 2 - Math.max(1, lineW));

  for (let i = 0; i < 3; i++) {
    const ang = i * (Math.PI * 2 / 3);
    p.push();
    p.rotate(ang);

    p.strokeWeight(lineW);
    strokeRgb(p, lineTint, Math.min(alpha, lineA));
    p.noFill();
    p.line(hubR + lineOff, lineY, hubR + lineOff + lineLen, lineY);

    p.noStroke();
    fillRgb(p, bladeTint, alpha);
    p.rectMode(p.CENTER);
    const rootGap = Math.max(1, Math.round(hubR * 0.2));
    p.rect(bladeL / 2, 0, bladeL - rootGap, bladeW, tipR);

    p.rectMode(p.CORNER);
    const rootLen = Math.max(6, Math.round(bladeL * 0.18));
    p.rect(-rootGap, -Math.round(bladeW * 0.65), rootLen, Math.round(bladeW * 1.3), Math.round(bladeW * 0.6));

    p.pop();
  }
  p.pop();

  // hub on top
  p.noStroke();
  fillRgb(p, hubTint, alpha);
  p.circle(hubCx, hubCy, hubR * 2);

  p.pop(); // appear transform
}
