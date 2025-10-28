// src/canvas/shape/trees.js
import { clamp01, val } from './utils/useLerp.ts';
import { blendRGB } from './utils/colorBlend.ts';
import { clampBrightness, clampSaturation, oscillateSaturation } from '../color/colorUtils.ts';
import { applyShapeMods } from './utils/shapeMods.ts';

/* ───────────────────────────────────────────────────────────
   Exposure/contrast helper
   ─────────────────────────────────────────────────────────── */
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

/* ───────────────────────────────────────────────────────────
   Base palette
   ─────────────────────────────────────────────────────────── */
export const TREES_BASE_PALETTE = {
  grass: [
    { r: 110, g: 160, b: 90 },
    { r: 130, g: 180, b: 110 },
    { r: 100, g: 150, b: 85 },
  ],
  asphalt: { r: 125, g: 125, b: 125 },
  trunk:   { r: 110, g: 85,  b: 60 },
  foliage: [
    { r: 80,  g: 150, b: 90  },  // medium green
    { r: 60,  g: 135, b: 80  },  // darker
    { r: 95,  g: 165, b: 105 },  // balanced
    { r: 70,  g: 120, b: 80  },  // shadowy
    { r: 110, g: 175, b: 100 },  // fresh
    { r: 125, g: 190, b: 115 },  // sunlit
    { r: 140, g: 205, b: 125 },  // vibrant
    { r: 160, g: 220, b: 130 },  // lime highlight
  ],
};

/* ───────────────────────────────────────────────────────────
   Tunables
   ─────────────────────────────────────────────────────────── */
const TREES = {
  grass:   { colorBlend: [0.20, 0.45], satRange: [0.20, 0.45] },

  asphalt: {
    min: [0.25, 0.32],
    max: [0.52, 0.65],
    xScaleRange: [1, 0], // lerped by u
  },

  appear:  { scaleFrom: 0.0, alphaFrom: 0.0, anchor: 'bottom-center', ease: 'back', backOvershoot: 1.25 },

  wind: {
    rotAmp:      [0.01, 0.02],
    xShearAmp:   [0.02, 0.03],
    speedHz:     [0.25, 0.9],
    phaseSpread: Math.PI * 4,
  },

  layout: {
    sidePadK: 0.08,
    maxOverflowTopK: 0.28,
    countRange: [2, 3],
    overlapK: 0.78, // tighter spacing (<1) = more inter-tree overlap
  },

  poplar: {
    baseWk:  [0.20, 0.28],
    baseHk:  [0.62, 0.92],
    trunkWk: [0.07, 0.09],
    trunkHk: [0.18, 0.26],
    radiusK: 0.22,
  },

  conifer: {
    levelsRange: [1, 1],
    baseHalfWk:  [0.22, 0.36],
    levelHk:     [0.5, 0.7],
    trunkWk:     [0.07, 0.09],
    trunkHk:     [0.18, 0.26],
    levelShrink: 0.89,

    // Use ONLY 2 or 3 triangles per tier (chosen per tree)
    triHeightFracs2: [1.00, 0.62],
    triWidthFracs2:  [1.00, 0.72],
    triHeightFracs3: [1.00, 0.62, 0.42],
    triWidthFracs3:  [1.00, 0.72, 0.52],
    intraOverlapK:   0.35,   // per-tier triangle overlap (fraction of levelH)

    // vertical overlap between levels (0..1 of levelH)
    levelOverlapK: 0.22,

    // additional width taper per level (besides levelShrink)
    widthTaper: 0.95,

    // help cross-tree overlap
    overlapWidthBoost: 1.10,
  },

  foliage: {
    colorBlend: [0.10, 0.12],
    brightnessRange: [0.50, 0.60],
    // sat osc envelope (amp & speed lerp across u)
    satOscAmp:   [0.08, 0.16],
    satOscSpeed: [0.18, 0.35],
  },

  // gentle overall cluster clamp (uniform, anchored bottom-center)
  clusterScaleClamp: [0.92, 1.08],
};

/* ───────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────── */
function fillRgb(p, { r, g, b }, a = 255) { p.fill(r, g, b, a); }
function strokeRgb(p, { r, g, b }, a = 255) { p.stroke(r, g, b, a); }
function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }
function iround(x) { return Math.round(x); }

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

/* ── Sprite-friendly deterministic RNG helpers (tagged substreams) ── */
function rFromKey(key, tag) { return rand01(hash32(`${String(key)}|${tag}`)); }
function pickFromKey(arr, key, tag) {
  const r = rFromKey(key, tag);
  return arr[Math.floor(r * arr.length) % arr.length];
}

/* foliage tint: base → mix with grass → optional gradient → clamp → E/C */
function foliageTint(grassTint, u, gradientRGB, ex, ct, rSeed) {
  const base = pick(TREES_BASE_PALETTE.foliage, rSeed);
  let mixed = blendRGB(base, grassTint, 0.20 + 0.15 * u);
  if (gradientRGB) mixed = blendRGB(mixed, gradientRGB, val(TREES.foliage.colorBlend, u));
  mixed = clampSaturation(mixed, 0.0, 0.45, 1);
  mixed = clampBrightness(mixed, TREES.foliage.brightnessRange[0], TREES.foliage.brightnessRange[1]);
  return applyExposureContrast(mixed, ex, ct);
}

/* ───────────────────────────────────────────────────────────
   drawTrees (1×1 tile) — with sprite-variant randomization
   ─────────────────────────────────────────────────────────── */
export function drawTrees(p, cx, cy, r, opts = {}) {
  const cell = opts?.cell;
  const f = opts?.footprint;
  if (!cell || !f) return;

  const ex = Number.isFinite(opts.exposure) ? opts.exposure : 1;
  const ct = Number.isFinite(opts.contrast) ? opts.contrast : 1;
  const u  = clamp01(opts?.liveAvg ?? 0.5);
  const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 235;

  // Sprite hint (doesn’t change behavior; we key variety off seedKey)
  const isSprite = !!opts.fitToFootprint || !!opts.spriteMode;

  // Deterministic, variant-aware seedKey (used by sprites). Fallback keeps old behavior.
  const seedKey = (opts && (opts.seedKey ?? opts.seed)) ?? `trees|${f.r0}|${f.c0}|${f.w}x${f.h}`;

  // Tile rect
  const x0 = f.c0 * cell;
  const y0 = f.r0 * cell;
  const w  = f.w * cell;
  const h  = f.h * cell;

  // Appear (bottom-center)
  const anchorX = x0 + w / 2;
  const anchorY = y0 + h;
  const appear = applyShapeMods({
    p,
    x: anchorX,
    y: anchorY,
    r: Math.min(w, h),
    opts: { alpha, timeMs: opts.timeMs, liveAvg: u, rootAppearK: opts.rootAppearK },
    mods: { appear: TREES.appear, sizeOsc: { mode: 'none' } }
  });
  const drawAlpha = (typeof appear.alpha === 'number') ? appear.alpha : alpha;

  // gentle cluster scale clamp (uniform, anchored bottom-center)
  const clampK0 = TREES.clusterScaleClamp[0];
  const clampK1 = TREES.clusterScaleClamp[1];
  const clampRand = 0.96 + (rFromKey(seedKey, 'clusterClamp') * 0.035); // ~0.96..0.995
  const sClamp = Math.max(clampK0, Math.min(clampK1, clampRand * (0.96 + u * 0.08)));

  const clampTf = applyShapeMods({
    p, x: anchorX, y: anchorY, r: Math.min(w, h), opts,
    mods: { scale2D: { x: sClamp, y: sClamp, anchor: 'bottom-center' } }
  });

  /* ─── Ground: grass + asphalt (UNTRANSFORMED so it never shrinks) ─── */
  // Pick grass tones via seedKey (sprite-variant friendly). Fallback mixing kept.
  let g1 = pickFromKey(TREES_BASE_PALETTE.grass, seedKey, 'grass1');
  let g2 = pickFromKey(TREES_BASE_PALETTE.grass, seedKey, 'grass2');
  let grassTint = blendRGB(g1, g2, 0.4 + 0.3 * u);
  if (opts.gradientRGB) grassTint = blendRGB(grassTint, opts.gradientRGB, val(TREES.grass.colorBlend, u));
  grassTint = clampSaturation(grassTint, TREES.grass.satRange[0], TREES.grass.satRange[1], 1);
  grassTint = applyExposureContrast(grassTint, ex, ct);

  const grassH = h * 0.55;
  const grassY = y0 + h - grassH;
  p.noStroke();
  fillRgb(p, grassTint, drawAlpha);
  p.rect(x0, grassY, w, grassH, Math.round(cell * 0.04));

  let asp = applyExposureContrast(TREES_BASE_PALETTE.asphalt, ex, ct);
  asp = clampBrightness(asp, val(TREES.asphalt.min, u), val(TREES.asphalt.max, u));
  const aspH = grassH * 0.28;
  const aspY = grassY + (grassH - aspH) / 2;

  // left-anchored X-scale on asphalt
  const sx = val(TREES.asphalt.xScaleRange, u);
  p.push();
  p.translate(x0, aspY + aspH / 2);
  p.scale(sx, 1);
  p.translate(-x0, -(aspY + aspH / 2));
  fillRgb(p, asp, drawAlpha);
  p.rect(x0, aspY, w, aspH, Math.round(cell * 0.16));
  p.pop();

  const groundY = aspY + aspH * 0.6;

  /* ─── Trees: appear + clamp ONLY to the cluster ─── */
  p.push();
  // appear transform
  p.translate(appear.x, appear.y);
  p.scale(appear.scaleX, appear.scaleY);
  p.translate(-anchorX, -anchorY);
  // clamp transform (also anchored bottom-center)
  p.translate(clampTf.x, clampTf.y);
  p.scale(clampTf.scaleX, clampTf.scaleY);
  p.translate(-anchorX, -anchorY);

  /* ─── Tree cluster ─── */
  const countR = rFromKey(seedKey, 'count');
  const minC = TREES.layout.countRange[0];
  const maxC = TREES.layout.countRange[1];
  const count = Math.round(minC + (maxC - minC) * countR);

  const sidePad = w * TREES.layout.sidePadK;
  const usableW = Math.max(8, w - sidePad * 2);
  // reduce step to push trees closer together (inter-tree overlap)
  const step = (usableW / Math.max(1, count)) * (TREES.layout.overlapK ?? 1) * (count === 3 ? 1.25 : 1);

  const trunkTint = applyExposureContrast(TREES_BASE_PALETTE.trunk, ex, ct);

  // time (for osc)
  const timeSec = (typeof opts.timeMs === 'number' ? opts.timeMs : p.millis?.()) / 1000;

  for (let i = 0; i < count; i++) {
    // sub-key per tree; stable within the sprite key
    const k = `${seedKey}|tree:${i}`;
    const rx = rFromKey(k, 'rx');
    const typePick = rFromKey(k, 'type');
    const posJitter = (rFromKey(k, 'jitter') - 0.5) * step * 0.22;

    const baseX = x0 + sidePad + step * (i + 0.5) + posJitter;
    const baseY = groundY;

    const windSpeed = val(TREES.wind.speedHz, rFromKey(k, 'windSpd'));
    const rotAmp    = val(TREES.wind.rotAmp, u);
    const shearAmp  = val(TREES.wind.xShearAmp, u);
    const phase     = rFromKey(k, 'windPhase') * TREES.wind.phaseSpread;

    // base foliage tint (sprite-friendly pick)
    let leavesTint = foliageTint(grassTint, u, opts.gradientRGB, ex, ct, rx);

    // saturation oscillation on leaves (gentle “breathing”)
    const satAmp   = val(TREES.foliage.satOscAmp,   u); // 0.08..0.16 across u
    const satSpeed = val(TREES.foliage.satOscSpeed, u); // 0.18..0.35 Hz
    const satPhase = rFromKey(k, 'satPhase') * Math.PI * 2;
    leavesTint = oscillateSaturation(leavesTint, timeSec, { amp: satAmp, speed: satSpeed, phase: satPhase });

    // allow tasteful top overhang
    const maxOverflow = h * TREES.layout.maxOverflowTopK;
    const heightBoost = - (rFromKey(k, 'heightOver') * maxOverflow);
    const scaleBias   = 0.95 + rFromKey(k, 'scaleBias') * 0.25;

    if (typePick < 0.5) {
      /* POPLAR */
      const fw = (TREES.poplar.baseWk[0] + (TREES.poplar.baseWk[1] - TREES.poplar.baseWk[0]) * rx) * w * 0.95;
      const fh = (TREES.poplar.baseHk[0] + (TREES.poplar.baseHk[1] - TREES.poplar.baseHk[0]) * rx) * h * scaleBias;

      const m = applyShapeMods({
        p, x: baseX, y: baseY + heightBoost, r: fh, opts,
        mods: {
          scale2D:    { x: 1, y: 1, anchor: 'bottom-center' },
          scale2DOsc: { mode:'relative', biasX:1, ampX:shearAmp, biasY:1, ampY:0, speed: windSpeed, phaseX: phase, anchor:'bottom-center' },
          rotationOsc:{ amp: rotAmp, speed: windSpeed, phase }
        }
      });

      p.push();
      p.translate(m.x, m.y);
      p.rotate(m.rotation);

      // trunk
      const tw = Math.max(3, Math.round(w * (TREES.poplar.trunkWk[0] + (TREES.poplar.trunkWk[1] - TREES.poplar.trunkWk[0]) * rx)));
      const th = Math.max(6, Math.round(h * (TREES.poplar.trunkHk[0] + (TREES.poplar.trunkHk[1] - TREES.poplar.trunkHk[0]) * rx)));
      p.noStroke();
      fillRgb(p, trunkTint, 255);
      p.rect(-tw/2, -th, tw, th, 2);

      // foliage capsule
      const rad = Math.round(Math.min(fw, fh) * TREES.poplar.radiusK);
      fillRgb(p, leavesTint, 255);
      p.rect(-fw/2, -th - fh, fw, fh, rad);

      p.pop();
    } else {
      /* CONIFER — ONLY 2 or 3 small overlapping triangles per tier */
      const levels = Math.round(TREES.conifer.levelsRange[0] +
        (TREES.conifer.levelsRange[1] - TREES.conifer.levelsRange[0]) * rx);

      const baseHalfW = (TREES.conifer.baseHalfWk[0] +
        (TREES.conifer.baseHalfWk[1] - TREES.conifer.baseHalfWk[0]) * rx) *
        (w * 0.5) * (TREES.conifer.overlapWidthBoost ?? 1);

      const levelH = (TREES.conifer.levelHk[0] +
        (TREES.conifer.levelHk[1] - TREES.conifer.levelHk[0]) * rFromKey(k, 'levelH')) * cell * 1.0 * scaleBias;

      const mRoot = applyShapeMods({
        p, x: baseX, y: baseY + heightBoost, r: levelH * levels, opts,
        mods: {
          scale2D:    { x: 1, y: 1, anchor: 'bottom-center' },
          scale2DOsc: { mode:'relative', biasX:1, ampX:shearAmp, biasY:1, ampY:0, speed: windSpeed, phaseX: phase, anchor:'bottom-center' },
          rotationOsc:{ amp: rotAmp, speed: windSpeed, phase }
        }
      });

      p.push();
      p.translate(mRoot.x, mRoot.y);
      p.rotate(mRoot.rotation);

      // trunk
      const tw = Math.max(3, Math.round(w * (TREES.conifer.trunkWk[0] + (TREES.conifer.trunkWk[1] - TREES.conifer.trunkWk[0]) * rx)));
      const th = Math.max(6, Math.round(h * (TREES.conifer.trunkHk[0] + (TREES.conifer.trunkHk[1] - TREES.conifer.trunkHk[0]) * rx)));
      p.noStroke();
      fillRgb(p, trunkTint, 255);
      p.rect(-tw/2, -th, tw, th, 2);

      // per-level parameters
      const shrink = TREES.conifer.levelShrink;
      const taper  = TREES.conifer.widthTaper ?? 1;
      const ovK    = TREES.conifer.levelOverlapK ?? 0;    // overlap between levels
      const intraK = TREES.conifer.intraOverlapK ?? 0.35; // overlap within a tier

      // Choose 2 or 3 triangles for THIS TREE
      const nT = (rFromKey(k, 'triCount') < 0.5) ? 2 : 3;
      const hFracs = (nT === 2 ? (TREES.conifer.triHeightFracs2 || [1.00, 0.62])
                               : (TREES.conifer.triHeightFracs3 || [1.00, 0.62, 0.42]));
      const wFracs = (nT === 2 ? (TREES.conifer.triWidthFracs2  || [1.00, 0.72])
                               : (TREES.conifer.triWidthFracs3  || [1.00, 0.72, 0.52]));

      // draw bottom -> top so upper triangles overlap those below
      for (let l = 0; l < levels; l++) {
        // tier half-width with level taper & shrink
        const tierHW = baseHalfW * Math.pow(shrink * taper, l);

        // vertical placement of this tier with level-overlap
        const yBottom = -th - levelH * l + (l > 0 ? ovK * levelH : 0);

        // first triangle of the tier:
        let baseY = yBottom;
        let tipY  = baseY - (levelH * hFracs[0]);

        // lower triangle
        fillRgb(p, leavesTint, 255);
        p.beginShape();
        p.vertex(-tierHW * wFracs[0], baseY);
        p.vertex( tierHW * wFracs[0], baseY);
        p.vertex( 0,                   tipY);
        p.endShape(p.CLOSE);

        // remaining small triangles stacked upward with intra-tier overlap
        for (let t = 1; t < nT; t++) {
          baseY = tipY + intraK * levelH; // overlap downward into previous
          const triH = levelH * hFracs[t];
          tipY  = baseY - triH;

          const hwT = tierHW * wFracs[t];
          p.beginShape();
          p.vertex(-hwT, baseY);
          p.vertex( hwT, baseY);
          p.vertex( 0,   tipY);
          p.endShape(p.CLOSE);
        }
      }

      p.pop();
    }
  }

  p.pop(); // end cluster transform
}

export default drawTrees;
