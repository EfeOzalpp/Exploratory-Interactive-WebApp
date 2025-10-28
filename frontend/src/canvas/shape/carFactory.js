// src/canvas/shape/carFactory.js
import { clamp01, val } from './utils/useLerp.ts';
import { blendRGB } from './utils/colorBlend.ts';
import { clampBrightness, clampSaturation } from '../color/colorUtils.ts';
import { applyShapeMods } from './utils/shapeMods.ts';
import { stepAndDrawPuffs } from './particles/particle-2.ts';

import {
  drawCarAsset,
  fitScaleToRectWidth,
  beginFitScale,
  endFitScale,
} from './car.js';

/* palette */
export const CAR_FACTORY_BASE_PALETTE = {
  grass:    { r: 120, g: 180, b: 110 },
  building: { r: 208, g: 210, b: 214 },
  frame:    { r: 180, g: 182, b: 188 },
  window:   { r: 220, g: 226, b: 236 },   // base before blue tint
  chimney:  { r: 172, g: 174, b: 180 },
  roof:     { r: 160, g: 162, b: 168 },   // subtle darker cap than wall
  solarPanel:{ r: 180, g: 205, b: 235 },  // matches house panel tone
};

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

/** Clamp a val() result even if the range is decreasing (hi < lo). */
function clampLerped(range, u) {
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const v  = val(range, u);
  return Math.max(lo, Math.min(hi, v));
}

// small easing for crossfade/scale
function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const CF = {
  // General (non-grass) gradient blend strength (used with opts.gradientRGB)
  blendK: [0.3, 0.02],

  // Grass: match villa behavior (colorBlend + sat clamp)
  grass: {
    colorBlend: [0.5, 0.3],
    satRange: [0.00, 0.35],
  },

  // grass
  grassHk: 1/3,
  grassTopRadiusK: 0.06,

  // overall slab tuning
  slabHeightK: 1.15,

  // factory vs chimney layout
  factoryWFrac: 0.75,
  gapPx: 4,

  // frame/window pads
  framePadK: 0.18,
  windowPadK: 0.10,
  frameRadiusPx: 6,
  windowRadiusPx: 4,

  // thinner stroke overall
  windowStrokePx: [0.4, 0.9],

  // car fit
  carSidePadK: 0.06,
  carScaleBoost: 1.00,

  // chimney shape
  chimWFrac: 0.22,
  chimTopNarrowK: 0.82,
  chimRadiusPx: 3,

  /* Tunables */
  chimHeightFrac: 0.62, // shorter baseline

  // Body: X-only clamp (lerped by liveAvg)
  bodyScaleXRange: [1, 1.33],

  // Chimney: Y-only clamp (lerped by liveAvg) — decreasing range
  chimScaleYRange: [1, 0],

  // Roof
  roofHk: 0.12,
  roofOverhangK: 0.06,
  roofRadiusPx: 6,

  // Smoke (puffs)
  smoke: {
    count:       [62, 0],
    sizeMin:     [4.5, 0.0],
    sizeMax:     [12.0, 1.0],
    lifeMin:     [5, 2.0],
    lifeMax:     [10, 4.0],
    alpha:       [235, 0],

    dir:         'up',
    spreadAngle: [0.90, 0.22],

    speedMin:    [12, 10],
    speedMax:    [28, 18],
    gravity:     [-12, -6],
    drag:        [0.60, 0.70],

    jitterPos:   [0.80, 0.25],
    jitterAngle: [0.4, 0.06],

    fadeInFrac:  0.10,
    fadeOutFrac: 3,
    edgeFadePx:  { left: 6, right: 0, top: 4, bottom: 12 },

    sizeHz:      4,

    base:        { r: 120, g: 130, b: 140 },
    blendK:      [0.30, 0.06],
    brightnessRange: [0.60, 0.40],

    colWk: 0.16,
    colHk: 2.60,
  },

  // Solar panels
  panels: {
    count: 5,
    widthFracBase: 0.19,
    heightFracOfRoof: 0.80,
    sideMarginFrac: 0.06,
    gapFracOfPW: 0.20,
    cornerFrac: 0.12,
    tiltDeg: 30,
  },

  // Chimney cap
  chimCap: {
    overhangPx: 3,
    thicknessPx: 12,
    radiusPx: 2,
    shadeK: 0.88,     // slightly darker than chimney body
    lipPx: 1,         // tiny top lip (0 disables)
    lipAlpha: 200,
  },

  // Car variant cycle + crossfade using shapeMods.scale (bottom-center)
  carVariantList: ['suv', 'sedan', 'jeep'],
  carVariantCycleMs: 3000,  // total time per variant
  carVariantFadeMs: 300,    // 0.3s fade-out and 0.3s fade-in
};

function rgba({r,g,b}, a=255){ return `rgba(${r},${g},${b},${a/255})`; }
function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}

export function drawCarFactory(p, _x, _y, _r, opts = {}) {
  const cell = opts?.cell, f = opts?.footprint;
  if (!cell || !f) return;

  // Sprite mode: auto when fitToFootprint (texture path) or explicit override.
  const isSprite = !!opts.fitToFootprint || !!opts.spriteMode;

  const u   = clamp01(opts?.liveAvg ?? 0.5);
  const a   = Number.isFinite(opts.alpha) ? opts.alpha : 235;
  const ex  = Number.isFinite(opts.exposure) ? opts.exposure : 1;
  const ct  = Number.isFinite(opts.contrast) ? opts.contrast : 1;
  const tMs = typeof opts.timeMs === 'number' ? opts.timeMs : p.millis?.();

  const x0 = f.c0 * cell;
  const y0 = f.r0 * cell;
  const W  = f.w * cell;
  const H  = f.h * cell;

  // appear (bottom-center)
  const anchorX = x0 + W / 2;
  const anchorY = y0 + H;
  const env = applyShapeMods({
    p, x: anchorX, y: anchorY, r: Math.min(W, H),
    opts: { alpha: a, timeMs: tMs, liveAvg: u, rootAppearK: opts.rootAppearK },
    mods: {
      appear:  { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: 'back', backOvershoot: 1.25 },
      sizeOsc: { mode: 'none' },
    },
  });
  const alpha = (typeof env.alpha === 'number') ? env.alpha : a;

  // ---- color helpers ----
  const kBlendGeneral = val(CF.blendK, u);

  // General tint (applies global gradient to non-grass shapes)
  const tintGeneral = (base) => {
    const mixed = opts.gradientRGB ? blendRGB(base, opts.gradientRGB, kBlendGeneral) : base;
    return applyExposureContrast(mixed, ex, ct);
  };

  // Grass tint: same logic as villa (use gradientRGB + clamp saturation)
  let grass = CAR_FACTORY_BASE_PALETTE.grass;
  if (opts.gradientRGB) {
    grass = blendRGB(grass, opts.gradientRGB, val(CF.grass.colorBlend, u));
  }
  grass = clampSaturation(grass, CF.grass.satRange[0], CF.grass.satRange[1], 1);
  grass = applyExposureContrast(grass, ex, ct);

  // Non-grass colors still use general gradient
  const wall       = tintGeneral(CAR_FACTORY_BASE_PALETTE.building);
  const frameRGB   = tintGeneral(CAR_FACTORY_BASE_PALETTE.frame);
  const glassBase  = tintGeneral(CAR_FACTORY_BASE_PALETTE.window);
  const chimneyRGB = tintGeneral(CAR_FACTORY_BASE_PALETTE.chimney);
  const roofRGB    = tintGeneral(CAR_FACTORY_BASE_PALETTE.roof);

  // subtle blue tint for glass
  const blue = { r: 120, g: 170, b: 220 };
  const glass = clampBrightness(blendRGB(glassBase, blue, 0.42), 0.80, 1.10);

  const backdrop = applyExposureContrast(
    {
      r: Math.round(CAR_FACTORY_BASE_PALETTE.building.r * 0.88),
      g: Math.round(CAR_FACTORY_BASE_PALETTE.building.g * 0.88),
      b: Math.round(CAR_FACTORY_BASE_PALETTE.building.b * 0.88),
    }, ex, ct
  );

  // geometry
  const grassH = Math.max(4, Math.round(cell * CF.grassHk));
  const grassY = y0 + H - grassH;
  const rGrassTop = Math.round(cell * CF.grassTopRadiusK);

  const usableH = H - grassH;
  const floorY  = y0 + usableH;

  const slabH = Math.min(usableH, Math.round(cell * CF.slabHeightK));
  const slabY = floorY - slabH;

  const gap = CF.gapPx;
  const factoryW = Math.max(8, Math.round(W * CF.factoryWFrac));
  const chimW    = Math.max(6, Math.round(W * CF.chimWFrac));
  const totalW   = factoryW + gap + chimW;

  const leftStart = x0 + (W - totalW) / 2;
  const sideLeft  = ((f.c0 + f.r0) % 2) === 0; // true → factory left, chimney right
  const bodyX     = sideLeft ? leftStart : (leftStart + chimW + gap);

  // slight inward offset to pull chimney toward the body
  const chimInset = cell * 0.05;
  const chimX = sideLeft
    ? (bodyX + factoryW + gap - chimInset)
    : (leftStart + chimInset);

  // frame/window pads (larger window)
  const framePadPx  = Math.round(Math.max(3, Math.min(12, cell * CF.framePadK)));
  const windowPadPx = Math.round(Math.max(2, Math.min(10, cell * CF.windowPadK)));

  // frame/window rects centered within factory body
  const frameX = bodyX + framePadPx;
  const frameY = slabY + framePadPx;
  const frameW = Math.max(4, factoryW - framePadPx * 2);
  const frameH = Math.max(4, slabH     - framePadPx * 2);

  const winX = frameX + windowPadPx;
  const winY = frameY + windowPadPx;
  const winW = Math.max(4, frameW - windowPadPx * 2);
  const winH = Math.max(4, frameH - windowPadPx * 2);

  // thinner stroke
  const winStroke = Math.max(
    CF.windowStrokePx[0],
    Math.min(CF.windowStrokePx[1], cell * 0.025)
  );

  const ctx = p.drawingContext;

  // liveAvg-lerped clamps — robust for decreasing ranges
  const bodyScaleX = clampLerped(CF.bodyScaleXRange, u);
  const chimScaleY = clampLerped(CF.chimScaleYRange, u);

  // body anchor flips by side — left-anchored if component is on the left
  const bodyAnchorX = sideLeft ? bodyX : (bodyX + factoryW);

  // Precompute roof rect in WORLD space (so we can draw panels outside body scale group)
  const roofH = Math.max(3, Math.round(cell * CF.roofHk));
  const roofOver = Math.round(factoryW * CF.roofOverhangK);
  const roofRx = bodyX - roofOver;               // left X
  const roofRw = factoryW + 2 * roofOver;        // width
  const roofRy = slabY - roofH;                  // top Y

  // ---- precompute chimney top for smoke, then draw smoke BEFORE chimney ----
  const baseW = chimW; // no X-scale clamp on chimney
  const topW  = Math.round(baseW * CF.chimTopNarrowK);
  const chimRise = slabH * CF.chimHeightFrac;
  const topY0 = slabY - chimRise;
  const bottomCenterX = chimX + baseW / 2;
  const bottomY = grassY;
  const topRightX = chimX + (baseW + topW) / 2;
  const topLeftX  = chimX + (baseW - topW) / 2;
  // world-space top Y after Y-scale about bottom
  const chimneyTopY = topY0 * chimScaleY + bottomY * (1 - chimScaleY);

  // ---- draw (z-order) ----------------------------------------------------
  p.push();
  p.translate(env.x, env.y);
  p.scale(env.scaleX, env.scaleY);
  p.translate(-anchorX, -anchorY);

  // NOTE: DO NOT clip to (x0,y0,W,H) here — it cuts off smoke in the bleed.
  // If you *really* want a clip, prefer the full canvas bounds (when available):
  // if (isSprite && p.width && p.height) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, p.width, p.height); ctx.clip(); }

  // 0) grass (villa-style tint)
  p.noStroke();
  p.fill(grass.r, grass.g, grass.b, alpha);
  p.rect(x0, grassY, W, grassH, rGrassTop, rGrassTop, 0, 0);

  // 1) SMOKE first (so chimney renders on top of it)
  {
    // base col dims
    let colW = Math.max(6, Math.round(cell * CF.smoke.colWk));
    let colH = Math.max(24, Math.round(cell * 2 * CF.smoke.colHk));

    // Sprite path: thicker/taller column so smoke reads after downsampling
    if (isSprite) {
      colW = Math.round(colW * 1.35);
      colH = Math.round(colH * 1.25);
    }

    const smokeX = (topLeftX + topRightX) / 2 - colW / 2;
    // spawn a bit above the mouth so top edge-fade doesn’t kill it
    const smokeY = chimneyTopY - Math.round(cell * (isSprite ? 1.35 : 1.45));

    // base knobs
    let count    = Math.max(4, Math.floor(val(CF.smoke.count, u)));
    let sizeMin  = val(CF.smoke.sizeMin, u);
    let sizeMax  = Math.max(sizeMin, val(CF.smoke.sizeMax, u));
    let lifeMin  = Math.max(0.05, val(CF.smoke.lifeMin, u));
    let lifeMax  = Math.max(lifeMin, val(CF.smoke.lifeMax, u));
    let sAlpha   = Math.max(90, Math.min(255, Math.round(val(CF.smoke.alpha, u))));
    let speedMin = val(CF.smoke.speedMin, u);
    let speedMax = Math.max(speedMin, val(CF.smoke.speedMax, u));
    let gravity  = val(CF.smoke.gravity, u);
    let drag     = val(CF.smoke.drag, u);
    let jPos     = val(CF.smoke.jitterPos, u);
    let jAng     = val(CF.smoke.jitterAngle, u);
    let spread   = val(CF.smoke.spreadAngle, u);
    const blendK = val(CF.smoke.blendK, u);

    // Sprite path boosts (bigger/faster/longer-lived so it rises visibly)
    if (isSprite) {
      const sizeBoost = 1.35;
      const speedBoost = 1.15;
      const lifeBoost = 1.25;
      sizeMin *= sizeBoost;
      sizeMax *= sizeBoost;
      speedMin *= speedBoost;
      speedMax *= speedBoost;
      lifeMin *= lifeBoost;
      lifeMax *= lifeBoost;
      gravity *= 1.10;
      jPos *= 0.85;
      sAlpha = Math.min(255, Math.round(sAlpha * 1.05));
    }

    // Optional external tweaks
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

    const baseSmoke = opts.gradientRGB
      ? blendRGB(CF.smoke.base, opts.gradientRGB, blendK)
      : CF.smoke.base;

    const smoked = applyExposureContrast(
      clampBrightness(baseSmoke, CF.smoke.brightnessRange[0], CF.smoke.brightnessRange[1]),
      ex, ct
    );

    const dt =
      (typeof opts.deltaSec === 'number' && opts.deltaSec > 0)
        ? opts.deltaSec
        : (p.deltaTime ? Math.max(1/120, p.deltaTime / 1000) : 1/60);

    stepAndDrawPuffs(p, {
      key: `factory-smoke:${f.r0}:${f.c0}:${f.w}x${f.h}${isSprite ? ':spr' : ''}`,
      rect: { x: smokeX, y: smokeY, w: colW, h: colH },
      dir: 'up',
      spreadAngle: spread,
      speed: { min: speedMin, max: speedMax },
      gravity,
      drag,
      accel: { x: 0, y: 0 },

      // Spawn a bit inside so top-edge fade doesn't zero alpha
      spawn: { x0: 0.20, x1: 0.80, y0: 0.10, y1: 0.25 },
      jitter: { pos: jPos, velAngle: jAng },

      count,
      size: { min: sizeMin, max: sizeMax },
      sizeHz: CF.smoke.sizeHz,

      lifetime: { min: lifeMin, max: lifeMax },
      fadeInFrac: CF.smoke.fadeInFrac,
      fadeOutFrac: CF.smoke.fadeOutFrac,
      // In sprite mode kill the top fade so spawn is fully visible
      edgeFadePx: isSprite ? { left: 4, right: 4, top: 0, bottom: 10 } : { ...CF.smoke.edgeFadePx, top: 0 },

      color: { r: smoked.r, g: smoked.g, b: smoked.b, a: sAlpha },
      respawn: true,
    }, dt);
  }

  // (Previously we re-clipped here and later restored; those are gone.)

  // 2) CHIMNEY (single shape, no seam) + CAP
  {
    p.noStroke();
    p.fill(chimneyRGB.r, chimneyRGB.g, chimneyRGB.b, 255);

    // Y-only scaling, anchored at bottom-center
    p.push();
    p.translate(bottomCenterX, bottomY);
    p.scale(1, chimScaleY);
    p.translate(-bottomCenterX, -bottomY);

    // chimney polygon
    p.beginShape();
    p.vertex(chimX,             grassY);
    p.vertex(chimX + chimW,     grassY);
    p.vertex(topRightX,         topY0);
    p.vertex(topLeftX,          topY0);
    p.endShape(p.CLOSE);

    // CAP on the tapered top
    const capOver  = Math.round(CF.chimCap.overhangPx);
    const capTh    = Math.max(1, Math.round(CF.chimCap.thicknessPx));
    const capRad   = Math.max(0, CF.chimCap.radiusPx | 0);

    const capX     = topLeftX - capOver;
    const capW     = (topRightX - topLeftX) + capOver * 2;
    const capY     = topY0 - capTh;

    const capRGB = {
      r: Math.round(chimneyRGB.r * CF.chimCap.shadeK),
      g: Math.round(chimneyRGB.g * CF.chimCap.shadeK),
      b: Math.round(chimneyRGB.b * CF.chimCap.shadeK),
    };

    p.fill(capRGB.r, capRGB.g, capRGB.b, 255);
    p.rect(capX, capY, capW, capTh, capRad, capRad, capRad, capRad);

    if (CF.chimCap.lipPx > 0) {
      const lipH = Math.max(1, Math.round(CF.chimCap.lipPx));
      const lipRGB = {
        r: Math.min(255, capRGB.r + 18),
        g: Math.min(255, capRGB.g + 18),
        b: Math.min(255, capRGB.b + 18),
      };
      p.fill(lipRGB.r, lipRGB.g, lipRGB.b, CF.chimCap.lipAlpha | 0);
      p.rect(capX, capY - lipH, capW, lipH, capRad, capRad, capRad, capRad);
    }

    p.pop();
  }

  // 3–8) FACTORY BODY & CONTENT — X-only scale, anchored by side
  p.push();
  {
    p.translate(bodyAnchorX, 0);
    p.scale(bodyScaleX, 1);
    p.translate(-bodyAnchorX, 0);

    // 3) factory body (wall)
    p.noStroke();
    p.fill(wall.r, wall.g, wall.b, alpha);
    p.rect(bodyX, slabY, factoryW, slabH, Math.round(cell * 0.08));

    // 4) roof cap (drawn inside group; panels are drawn outside)
    {
      p.noStroke();
      p.fill(roofRGB.r, roofRGB.g, roofRGB.b, alpha);
      p.rect(roofRx, roofRy, roofRw, roofH, CF.roofRadiusPx, CF.roofRadiusPx, 0, 0);
    }

    // 5) backdrop (behind car) within the frame area
    p.noStroke();
    p.fill(backdrop.r, backdrop.g, backdrop.b, alpha);
    p.rect(frameX, frameY, frameW, frameH, CF.frameRadiusPx);

    // 6) CAR in window — ignore body scale via inverse transform
    {
      const cx = winX + winW / 2;
      const bottomPad = Math.max(2, Math.round(winH * 0.10));
      const wheelBaselineY = winY + winH - bottomPad;

      const sidePad = Math.max(2, Math.round(winW * CF.carSidePadK));
      const rBase = winW / 3.2;
      const designW = rBase * 3.2;
      const fitS = CF.carScaleBoost * fitScaleToRectWidth(designW, winW, sidePad, { allowUpscale: true });

      const cancelSX = 1 / bodyScaleX;

      // Variant cycle + crossfade using shapeMods.scale (anchor bottom-center)
      const list = Array.isArray(opts.carVariantList) && opts.carVariantList.length > 0
        ? opts.carVariantList
        : CF.carVariantList;

      const cycleMs = Math.max(1, opts.carVariantCycleMs ?? CF.carVariantCycleMs);
      const fadeMs  = Math.max(1, opts.carVariantFadeMs  ?? CF.carVariantFadeMs);
      const t       = (typeof tMs === 'number' ? tMs : (p.millis?.() || 0));
      const tick    = Math.floor(t / cycleMs);
      const phaseMs = t % cycleMs;

      const curIdx  = ((tick % list.length) + list.length) % list.length;
      const nxtIdx  = (curIdx + 1) % list.length;
      const curVar  = list[curIdx];
      const nxtVar  = list[nxtIdx];

      const drawVariant = (variant, scaleK, alphaK, seedKey) => {
        const env2 = applyShapeMods({
          p,
          x: cx,
          y: wheelBaselineY,
          r: rBase,
          opts: { alpha: Math.round(alpha * alphaK), timeMs: tMs, liveAvg: u },
          mods: { scale: { value: scaleK, anchor: 'bottom-center' } },
        });

        p.push();
        p.translate(cx, wheelBaselineY);
        p.scale(cancelSX, 1);
        p.translate(env2.x - cx, env2.y - wheelBaselineY);
        p.scale(env2.scaleX, env2.scaleY);
        p.translate(-cx, -wheelBaselineY);

        beginFitScale(p, { cx, anchorY: wheelBaselineY, scale: fitS });
        drawCarAsset(p, cx, wheelBaselineY, rBase, {
          alpha: env2.alpha,
          exposure: ex,
          contrast: ct,
          gradientRGB: opts.gradientRGB,
          liveAvg: u,
          useAppear: false,
          variant,
          seedKey,
        });
        endFitScale(p);
        p.pop();
      };

      if (phaseMs < cycleMs - fadeMs) {
        drawVariant(curVar, 1.0, 1.0, `var:${curVar}:t${tick}`);
      } else {
        const kLin = (phaseMs - (cycleMs - fadeMs)) / fadeMs; // 0..1
        const k = smoothstep01(kLin);
        const outScale = 1 - k;
        const inScale  = k;
        const outAlpha = 1 - k;
        const inAlpha  = k;

        drawVariant(curVar, Math.max(0, outScale), Math.max(0, outAlpha), `out:${curVar}:t${tick}`);
        drawVariant(nxtVar, Math.max(0, inScale),  Math.max(0, inAlpha),  `in:${nxtVar}:t${tick}`);
      }
    }

    // 7) FRAME RING WITH HOLE (even-odd)
    {
      const ctx2 = p.drawingContext;
      ctx2.save();
      ctx2.beginPath();
      roundedRectPath(ctx2, frameX, frameY, frameW, frameH, CF.frameRadiusPx);
      roundedRectPath(ctx2, winX,   winY,   winW,   winH,   CF.windowRadiusPx);
      ctx2.fillStyle = rgba(frameRGB, alpha);
      ctx2.fill('evenodd');
      ctx2.restore();
    }

    // 8) GLASS pane — smaller stroke, even less opaque
    {
      const strokeRGB = {
        r: Math.round(wall.r * 0.82),
        g: Math.round(wall.g * 0.86),
        b: Math.round(wall.b * 0.95),
      };
      p.stroke(strokeRGB.r, strokeRGB.g, strokeRGB.b, alpha);
      p.strokeWeight(winStroke);
      p.fill(glass.r, glass.g, glass.b, Math.round(alpha * 0.36));
      p.rect(winX, winY, winW, winH, CF.windowRadiusPx);
    }
  }
  p.pop();

  // 9) SOLAR PANELS — scale anchored to the roof (bottom-center), tilt flips with side
  {
    const sPanels = clamp01(u); // 0 → hidden, 1 → full
    if (sPanels > 0.001) {
      const panelTint0 = applyExposureContrast(CAR_FACTORY_BASE_PALETTE.solarPanel, ex, ct);
      const count = CF.panels.count;

      const marginSide = Math.max(4, Math.round(roofRw * CF.panels.sideMarginFrac));
      const usableW = Math.max(8, roofRw - 2 * marginSide);
      const basePW = Math.max(10, Math.round(roofRw * CF.panels.widthFracBase));
      const pH = Math.min(
        Math.max(6, Math.round(roofH * CF.panels.heightFracOfRoof)),
        Math.max(6, Math.round(cell * 0.16))
      );

      const gapFrac = CF.panels.gapFracOfPW;
      const pWFit = usableW / (count + (count - 1) * gapFrac);
      const pW = Math.min(basePW, Math.max(8, Math.round(pWFit)));
      const gap = Math.round(pW * gapFrac);

      // Contact line is the roof top (anchor line for scaling)
      const yOnRoof = roofRy;

      const totalRowW = count * pW + (count - 1) * gap;
      const startX = roofRx + (roofRw - totalRowW) / 2;

      const corner = Math.round(Math.min(pW, pH) * CF.panels.cornerFrac);
      const tiltSign = sideLeft ? -1 : 1;
      const tilt = tiltSign * (CF.panels.tiltDeg * Math.PI / 180);

      p.push();
      p.noStroke();
      p.rectMode(p.CORNER);

      for (let i = 0; i < count; i++) {
        const px = startX + i * (pW + gap) + pW / 2; // bottom-center X
        const py = yOnRoof;                           // roof contact Y

        p.push();
        p.translate(px, py);
        p.scale(sPanels, sPanels);
        p.rotate(tilt);

        p.fill(panelTint0.r, panelTint0.g, panelTint0.b, alpha);
        p.rect(-pW / 2, -pH, pW, pH, corner);

        const hi = {
          r: Math.min(255, panelTint0.r + 22),
          g: Math.min(255, panelTint0.g + 22),
          b: Math.min(255, panelTint0.b + 22),
        };
        p.fill(hi.r, hi.g, hi.b, Math.round(alpha * 0.35));
        p.rect(-pW * 0.53, -pH * 0.88, pW * 0.70, pH * 0.10, corner);

        p.pop();
      }

      p.pop();
    }
  }

  // If you added a canvas-wide clip above, remember to ctx.restore() here.
  // (We didn’t enable one by default.)

  p.pop();
}

export default drawCarFactory;
