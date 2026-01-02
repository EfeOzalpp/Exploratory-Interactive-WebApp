// src/canvas-engine/shapes/power.js
import { applyShapeMods } from './shape-modifiers/shapeMods.ts';
import { clamp01, val } from './shape-modifiers/useLerp.ts';
import { blendRGB } from './shape-modifiers/colorBlend.ts';
import { stepAndDrawPuffs } from '../modifiers/particle-systems/particle-2.ts';
import { clampBrightness, oscillateSaturation } from '../color-modifiers/colorUtils.ts';

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
  spawnX: [0.00, 0.80],
  spawnY: [0.10, 0.25], // lowered so frame 1 shows upward motion
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
  colWk: 0.20,
  colHk: 2.60,
};

/* Probability */
function windProbability(u) {
  const p0 = 0.0;
  if (u <= 0.4) {
    const t = u / 0.3;
    return p0 + (0.5 - p0) * t;
  } else {
    const t = (u - 0.4) / 0.6;
    return 0.5 + 0.5 * t;
  }
}

/* ====== NEW: seed helpers not tied to footprint/bleed ====== */
function randFromKey(key) {
  const seed = hash32(String(key));
  return rand01(seed);
}
function instanceRand01FromKey(key) {
  return randFromKey(`power-kind|${key}`);
}
function factoryLayoutFromKey(key) {
  const seed = hash32(`factory-layout|${String(key)}`);
  const rA = rand01(seed ^ 0x9e3779b9);
  const rB = rand01(seed ^ 0x85ebca6b);
  const chimneyOnLeft = rA < 0.5;
  const roofRiseK = 0.08 + 0.08 * rB;
  return { chimneyOnLeft, roofRiseK };
}
function pickBodyTintVariantFromKey(key, gradientRGB, ex, ct) {
  const seed = hash32(`power-body|${String(key)}`);
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

  // Sprite export mode: infer from fitToFootprint or explicit override
  const isSprite = !!opts.fitToFootprint || !!opts.spriteMode;

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

  // 🔑 stable seed independent of bleed/footprint padding
  const seedKey = (opts && (opts.seedKey ?? opts.seed)) ?? `${pxX}|${pxY}|${pxW}x${pxH}`;

  // Decide: turbine vs factory (stable regardless of bleed)
  const rInst = instanceRand01FromKey(`kind|${seedKey}`);
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

  // --- IMPORTANT ---
  // Do NOT clip to the footprint rectangle here; it will cut blades/smoke in the bleed.
  // If you really want a clip in sprite mode, prefer clipping to the full canvas:
  // const ctx = p.drawingContext;
  // if (isSprite && p.width && p.height) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, p.width, p.height); ctx.clip(); }

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
    const orientKey = `orient|${seedKey}`;
    const { chimneyOnLeft: isLeftChimney } = factoryLayoutFromKey(orientKey);
    const roofVar = 0.9 + 0.25 * randFromKey(`${orientKey}|roofVar`);

    const bodyTint = pickBodyTintVariantFromKey(`body|${seedKey}`, opts.gradientRGB, ex, ct);
    const bodyMarginX = Math.round(pxW * 0.14);
    const bodyW = Math.max(12, pxW - bodyMarginX * 2);
    const bodyH = Math.max(Math.round(pxH * 0.16), Math.round(cell * 0.9));
    const bodyX = pxX + bodyMarginX;
    const bodyTop = platY - bodyH;

    p.noStroke();
    fillRgb(p, bodyTint, 255);
    p.rect(bodyX, bodyTop, bodyW, bodyH);

    const roofRise = Math.round(Math.min(pxH * 0.10, cell * roofVar));
    const xL = bodyX, xR = bodyX + bodyW, yTop = bodyTop + 1;
    const highX = isLeftChimney ? xL : xR;
    const lowX  = isLeftChimney ? xR : xL;

    fillRgb(p, bodyTint, 255);
    p.triangle(lowX, yTop, highX, yTop, highX, yTop - roofRise);

    p.strokeWeight(1);
    strokeRgb(p, POWER_BASE_PALETTE.mastCore, 255);
    p.noFill();
    p.line(lowX, yTop, highX, yTop - roofRise);
    p.noStroke();

    const doorW = bodyW * 0.18;
    const doorH = bodyH * 0.32;
    const doorX = bodyX + bodyW / 2 - doorW / 2;
    const doorY = platY - doorH - 2;
    const doorTint = applyExposureContrast(mulRgb(bodyTint, 0.8), ex, ct);
    fillRgb(p, doorTint, 255);
    p.rect(doorX, doorY, doorW, doorH, 1, 1, 0, 0);

    const tSec = (typeof opts.timeMs === 'number' ? opts.timeMs : (p.millis?.() || 0)) / 1000;

    let emitW = Math.max(10, Math.round(bodyW * (FACTORY_SMOKE.colWk || 0.20)));
    let emitH = Math.max(48, Math.round((cell || 24) * (FACTORY_SMOKE.colHk || 2.60)));
    if (isSprite) { emitW = Math.round(emitW * 1.35); emitH = Math.round(emitH * 1.25); }

    const peakY  = yTop - roofRise;
    const emitX  = (isLeftChimney ? xL : xR) - (isLeftChimney ? -Math.round(emitW / 2) : Math.round(emitW / 2));
    const emitY  = peakY - Math.round((cell || 12) * (isSprite ? 1.05 : 1.00));

    const blendK = val(FACTORY_SMOKE.blendK, u);
    const satAmp = val(FACTORY_SMOKE.satOscAmp, u);
    const satSpd = val(FACTORY_SMOKE.satOscSpeed, u);

    let baseSmoke = FACTORY_SMOKE.base;
    if (opts.gradientRGB) baseSmoke = blendRGB(baseSmoke, opts.gradientRGB, blendK);

    let smoked = oscillateSaturation(baseSmoke, tSec, { amp: satAmp, speed: satSpd, phase: 0 });
    smoked = clampBrightness(smoked, FACTORY_SMOKE.brightnessRange[0], FACTORY_SMOKE.brightnessRange[1]);
    smoked = applyExposureContrast(smoked, ex, ct);

    const dt = (typeof opts.deltaSec === 'number' && opts.deltaSec > 0)
      ? opts.deltaSec
      : Math.max(1/120, (p.deltaTime ? p.deltaTime / 1000 : 1/60));

    let count    = Math.max(4, Math.floor(val(FACTORY_SMOKE.count, u)));
    let sizeMin  = val(FACTORY_SMOKE.sizeMin, u);
    let sizeMax  = Math.max(sizeMin, val(FACTORY_SMOKE.sizeMax, u));
    let lifeMin  = Math.max(0.05, val(FACTORY_SMOKE.lifeMin, u));
    let lifeMax  = Math.max(lifeMin, val(FACTORY_SMOKE.lifeMax, u));
    let sAlpha   = Math.max(60, Math.min(255, Math.round(val(FACTORY_SMOKE.alpha, u))));
    let speedMin = val(FACTORY_SMOKE.speedMin, u);
    let speedMax = Math.max(speedMin, val(FACTORY_SMOKE.speedMax, u));
    let gravity  = val(FACTORY_SMOKE.gravity, u);
    let drag     = val(FACTORY_SMOKE.drag, u);
    let jPos     = val(FACTORY_SMOKE.jitterPos, u);
    let jAng     = val(FACTORY_SMOKE.jitterAngle, u);
    let spread   = val(FACTORY_SMOKE.spreadAngle, u);

    if (isSprite) {
      const sizeBoost = 1.25, speedBoost = 1.10, lifeBoost = 1.20;
      sizeMin *= sizeBoost; sizeMax *= sizeBoost;
      speedMin *= speedBoost; speedMax *= speedBoost;
      lifeMin *= lifeBoost;  lifeMax  *= lifeBoost;
      gravity *= 1.08;
      jPos *= 0.85;
      sAlpha = Math.min(255, Math.round(sAlpha * 1.05));
    }

    if (opts.smokeOverrides) {
      const o = opts.smokeOverrides;
      if (o.count != null) count = o.count;
      if (o.sizeMin != null) sizeMin = o.sizeMin;
      if (o.sizeMax != null) sizeMax = Math.max(sizeMin, o.sizeMax);
      if (o.lifeMin != null) lifeMin = o.lifeMin;
      if (o.lifeMax != null) lifeMax = Math.max(lifeMin, o.lifeMax);
      if (o.speedMin != null) speedMin = o.speedMin;
      if (o.speedMax != null) speedMax = Math.max(speedMin, o.speedMax);
      if (o.gravity != null) gravity = o.gravity;
      if (o.drag != null) drag = o.drag;
      if (o.spreadAngle != null) spread = o.spreadAngle;
      if (o.alpha != null) sAlpha = o.alpha;
    }

    const spawn = {
      x0: FACTORY_SMOKE.spawnX[0],
      x1: FACTORY_SMOKE.spawnX[1],
      y0: FACTORY_SMOKE.spawnY[0],
      y1: FACTORY_SMOKE.spawnY[1],
    };

    stepAndDrawPuffs(p, {
      key: `factory-smoke:${seedKey}${isSprite ? ':spr' : ''}`,
      rect: { x: emitX, y: emitY, w: emitW, h: emitH },
      dir: FACTORY_SMOKE.dir,
      spreadAngle: spread,
      speed: { min: speedMin, max: speedMax },
      gravity,
      drag,
      accel: { x: 0, y: 0 },
      spawn,
      jitter: { pos: jPos, velAngle: jAng },
      count,
      size: { min: sizeMin, max: sizeMax },
      sizeHz: FACTORY_SMOKE.sizeHz,
      lifetime: { min: lifeMin, max: lifeMax },
      fadeInFrac: FACTORY_SMOKE.fadeInFrac,
      fadeOutFrac: FACTORY_SMOKE.fadeOutFrac,
      edgeFadePx: isSprite ? { left: 3, right: 3, top: 0, bottom: 8 } : FACTORY_SMOKE.edgeFadePx,
      color: { r: smoked.r, g: smoked.g, b: smoked.b, a: sAlpha },
      respawn: true,
    }, dt);

    // chimney
    const chimW  = Math.max(12, Math.round(pxW * 0.26));
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

    // If you enabled canvas-wide clipping above, restore here:
    // if (isSprite && p.width && p.height) { ctx.restore(); }

    p.pop();
    return;
  }

  /* === TURBINE MODE === */

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

  const tSec  = (typeof opts.timeMs === 'number' ? opts.timeMs : (p.millis?.() || 0)) / 1000;
  const seed  = hash32(`power|${seedKey}`) >>> 0;
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

  // If you enabled canvas-wide clipping above, restore here:
  // if (isSprite && p.width && p.height) { ctx.restore(); }

  p.pop(); // appear transform
}

export default drawPower;
