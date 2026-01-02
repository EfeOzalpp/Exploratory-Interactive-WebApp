// src/canvas/shapes/house.js
import { clamp01, val } from './shape-modifiers/useLerp.ts';
import { blendRGB } from './shape-modifiers/colorBlend.ts';
import { clampBrightness, oscillateSaturation, driveSaturation } from '../color-modifiers/colorUtils.ts';
import { stepAndDrawPuffs } from '../modifiers/particle-systems/particle-2.ts';
import { applyShapeMods } from './shape-modifiers/shapeMods.ts';

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

export const HOUSE_BASE_PALETTE = {
  grass: { r: 120, g: 180, b: 110 },
  body: [
    { r: 210, g: 225, b: 235 },
    { r: 232, g: 220, b: 206 },
    { r: 220, g: 230, b: 216 },
    { r: 238, g: 228, b: 234 },
    { r: 229, g: 236, b: 246 },
  ],
  roof: [
    { r: 210, g: 105, b: 90 },
    { r: 160, g: 110, b: 95 },
    { r: 135, g: 115, b: 105 },
    { r: 120, g: 100, b: 90 },
  ],
  door: [
    { r: 170, g: 120, b: 70 },
    { r: 150, g: 170, b: 90 },
    { r: 215, g: 190, b: 95 },
    { r: 180, g: 140, b: 100 },
  ],
  window: {
    lit: { r: 250, g: 240, b: 160 },
    dark: { r: 120, g: 170, b: 220 },
  },
  solarPanel: { r: 180, g: 205, b: 235 },
};

const HOUSE = {
  body: { colorBlend: [0.2, 0.02], brightnessRange: [0.35, 0.65] },
  grass: { colorBlend: [0.25, 0.5], satRange: [0, 0.4] },
  chimney: { scaleRange: [2, 0] },
  door: { widthRange: [1.3, 0.8], fixedHeights: [14, 20] },
  windows: { perFloor: 2, size: [10, 12], marginY: 12, thresholds: { low: 1.5, mid: 1.8 } }
};

const SMOKE = {
  spawnX: [0.10, 0.80],
  spawnY: [0.30, 0.30],
  count: [36, 22],
  sizeMin: [3, 0],
  sizeMax: [6, 1],
  lifeMin: [2, 3],
  lifeMax: [4, 5],
  alpha: [225, 0],
  dir: 'up',
  spreadAngle: [4, 0.26],
  speedMin: [6, 14],
  speedMax: [12, 22],
  gravity: [-16, -8],
  drag: [0.55, 0.72],
  jitterPos: [0.4, 1.2],
  jitterAngle: [0.06, 0.16],
  fadeInFrac: 0.22,
  fadeOutFrac: 0.38,
  edgeFadePx: { left: 6, right: 0, top: 2, bottom: 0 },
  sizeHz: 4,
  base: { r: 232, g: 235, b: 240 },
  blendK: [0.30, 0.10],
  satOscAmp: [0.04, 0.08],
  satOscSpeed: [0.12, 0.20],
  brightnessRange: [0.20, 0.95],
};

function fillRgb(p, { r, g, b }, a = 255) { p.fill(r, g, b, a); }
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
function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }

export function drawHouse(p, _cx, _cy, _r, opts = {}) {
  const cell = opts?.cell;
  const f = opts?.footprint;
  if (!cell || !f) return;

  const ex = typeof opts?.exposure === 'number' ? opts.exposure : 1;
  const ct = typeof opts?.contrast === 'number' ? opts.contrast : 1;

  const baseAlpha = Number.isFinite(opts.alpha) ? opts.alpha : 235;
  const u = clamp01(opts?.liveAvg ?? 0.5);
  const t = ((typeof opts?.timeMs === 'number' ? opts.timeMs : p.millis()) / 1000);

  const pxX = f.c0 * cell;
  const pxY = f.r0 * cell;
  const pxW = f.w * cell;
  const pxH = f.h * cell;

  // --- Appear envelope anchored to bottom-center of footprint ---
  const anchorX = pxX + pxW / 2;
  const anchorY = pxY + pxH;
  const m = applyShapeMods({
    p,
    x: anchorX,
    y: anchorY,
    r: Math.min(pxW, pxH),
    opts: {
      alpha: baseAlpha,
      timeMs: opts.timeMs,
      liveAvg: opts.liveAvg,
      rootAppearK: opts.rootAppearK,
    },
    mods: {
      appear: {
        scaleFrom: 0.0,
        alphaFrom: 0.0,
        anchor: 'bottom-center',
        ease: 'back',
        backOvershoot: 1.25,
      },
      sizeOsc: { mode: 'none' }
    }
  });

  const alpha = (typeof m.alpha === 'number') ? m.alpha : baseAlpha;

  // Apply transform so the whole house scales around bottom-center
  p.push();
  p.translate(m.x, m.y);
  p.scale(m.scaleX, m.scaleY);
  p.translate(-anchorX, -anchorY);

  // grass
  const grassH = Math.max(4, Math.round(cell / 3));
  const grassY = pxY + pxH - grassH;
  const rGrassTop = Math.round(cell * 0.06);

  let grassTint = HOUSE_BASE_PALETTE.grass;
  if (opts.gradientRGB) {
    grassTint = blendRGB(grassTint, opts.gradientRGB, val(HOUSE.grass.colorBlend, u));
  }
  grassTint = driveSaturation(grassTint, u, HOUSE.grass.satRange[0], HOUSE.grass.satRange[1]);
  grassTint = applyExposureContrast(grassTint, ex, ct);

  p.noStroke();
  fillRgb(p, grassTint, alpha);
  p.rect(pxX, grassY, pxW, grassH, rGrassTop, rGrassTop, 0, 0);

  // body + roof
  const availH = grassY - pxY;
  const seed = hash32(`house|${f.r0}|${f.c0}|${f.w}x${f.h}`);
  const r1 = rand01(seed ^ 0x9e3779b9);
  const r2 = rand01(seed ^ 0x85ebca6b);
  const r3 = rand01(seed ^ 0xc2b2ae35);
  const r4 = rand01(seed ^ 0x27d4eb2f);
  const r5 = rand01(seed ^ 0xa2bfe8a1);
  const r6 = rand01(seed ^ 0x3c6ef372); // panels: presence/count
  const r7 = rand01(seed ^ 0xbb67ae85); // panels: orientation
  const r8 = rand01(seed ^ 0x1f83d9ab); // panels: side

  const bodyH = Math.max(6, Math.round(availH * (0.5 + 0.4 * r1)));
  const bodyY = grassY - bodyH;
  const roofH = Math.max(4, Math.round(cell * 0.15));
  const roofY = Math.max(pxY, bodyY - roofH);

  let bodyTint = pick(HOUSE_BASE_PALETTE.body, r2);
  if (opts.gradientRGB) {
    bodyTint = blendRGB(bodyTint, opts.gradientRGB, val(HOUSE.body.colorBlend, u));
  }
  bodyTint = clampBrightness(bodyTint, HOUSE.body.brightnessRange[0], HOUSE.body.brightnessRange[1]);
  bodyTint = applyExposureContrast(bodyTint, ex, ct);

  const roofTintRaw = pick(HOUSE_BASE_PALETTE.roof, r3);
  const roofTint = applyExposureContrast(roofTintRaw, ex, ct);
  const rBody = Math.round(cell * 0.06);

  p.noStroke();
  fillRgb(p, bodyTint, alpha);
  p.rect(pxX, bodyY, pxW, bodyH, rBody);

  fillRgb(p, roofTint, alpha);
  p.rect(pxX, roofY, pxW, roofH, rBody, rBody, 0, 0);

  // --- Solar panels (bigger, slightly above roof top line, side-linked tilt)
  {
    const hasPanels = Math.floor(r6 * 3) !== 0; // ~2/3 of houses
    const vis = Math.max(0, Math.min(1, (u - 0.80) / 0.20));
    if (hasPanels && vis > 0) {
      // determine which side of the roof they go on
      const chimneyExists = (Math.floor(r4 * 3) === 0);
      const chimneyLeft = chimneyExists ? (r4 < 0.5) : null;

      let sideLeft = r8 < 0.5;
      if (chimneyExists && ((chimneyLeft && sideLeft) || (!chimneyLeft && !sideLeft))) {
        sideLeft = !sideLeft; // avoid chimney side
      }

      // link tilt angle to side (±30°)
      const angle = (sideLeft ? -1 : 1) * (Math.PI / 6);

      // slightly bigger base sizes than before
      const basePW = Math.max(10, Math.round(pxW * 0.18));
      const basePH = Math.max(5, Math.round(roofH * 0.65));
      const s = 0.7 + 0.4 * vis; // [0.7..1.1]
      let pW = basePW * s;
      let pH = basePH * s;

      // screen-space safe clamp
      const marginSide = Math.max(4, pxW * 0.08);
      const halfW = pxW / 2;
      const sideW = halfW - marginSide;

      // 2 or 3 panels
      const panelCount = 2 + (r6 < 0.33 ? 1 : 0);

      // limit width to side span
      const maxPW = Math.max(8, (sideW / panelCount) * 0.95);
      pW = Math.min(pW, maxPW);

      // height clamp so they don’t dwarf small roofs
      pH = Math.min(pH, Math.max(6, roofH * 0.9));

      // Y: slightly above the roof top line (roofY is the top edge)
      const yOnRoof = roofY - Math.max(2, roofH * 0.6);

      // X: pack on chosen side
      let startX;
      const spacing = pW * 0.2;
      if (sideLeft) {
        startX = pxX + marginSide + pW / 2;
      } else {
        startX = pxX + pxW - marginSide - pW / 2 - (panelCount - 1) * (pW + spacing);
      }

      // color & draw (no external gradient blend for panels)
      let panelTint = HOUSE_BASE_PALETTE.solarPanel;
      panelTint = applyExposureContrast(panelTint, ex, ct);

      p.push();
      p.rectMode(p.CENTER);
      p.noStroke();
      fillRgb(p, panelTint, Math.round(alpha * vis));

      for (let i = 0; i < panelCount; i++) {
        const jitter = (i === 0) ? 0 : ((r7 * 2 - 1) * pW * 0.06);
        const cx = startX + i * (pW + spacing) + jitter;
        const cy = yOnRoof - (r8 * 2 - 1) * Math.min(3, roofH * 0.06);

        p.push();
        p.translate(cx, cy);
        p.rotate(angle);
        p.rect(0, 0, pW, pH, Math.round(Math.min(pW, pH) * 0.12));
        p.pop();

        // subtle highlight stripe
        p.push();
        p.translate(cx, cy);
        p.rotate(angle);
        const hi = {
          r: Math.min(255, panelTint.r + 22),
          g: Math.min(255, panelTint.g + 22),
          b: Math.min(255, panelTint.b + 22)
        };
        fillRgb(p, hi, Math.round(alpha * vis * 0.35));
        p.rect(-pW * 0.18, -pH * 0.06, pW * 0.70, pH * 0.10, Math.round(Math.min(pW, pH) * 0.12));
        p.pop();
      }
      p.pop();
    }
  }
  // --- end solar panels ---

  // chimney (~1 in 3)
  if (Math.floor(r4 * 3) === 0) {
    const baseW = Math.max(6, Math.round(pxW * 0.15));
    const baseH = Math.max(4, Math.round(bodyH * 0.10));
    const scale = val(HOUSE.chimney.scaleRange, u);
    const cW = baseW * scale;
    const cH = baseH * scale;

    const onLeft = r4 < 0.5;
    const margin = Math.max(2, pxW * 0.1);
    const cx = onLeft ? pxX + margin : pxX + pxW - margin - cW;
    const cy = roofY;

    // smoke behind chimney
    {
      const smokeColW = Math.max(8, Math.round(cW * 0));
      const smokeColH = Math.max(48, Math.round(cell * 2));
      const smokeX = cx + cW / 2 - smokeColW / 2;
      const smokeY = cy - cH - Math.round(cell * 0.7);

      const spawnX0 = Math.min(val(SMOKE.spawnX, 0), val(SMOKE.spawnX, u));
      const spawnX1 = Math.max(val(SMOKE.spawnX, u), 1 - (1 - val(SMOKE.spawnX, u)));
      const spawnY0 = Math.min(val(SMOKE.spawnY, 0), val(SMOKE.spawnY, u));
      const spawnY1 = Math.max(val(SMOKE.spawnY, u), 1 - (1 - val(SMOKE.spawnY, u)));

      const count     = Math.max(4, Math.floor(val(SMOKE.count, u)));
      const sizeMin   = val(SMOKE.sizeMin, u);
      const sizeMax   = Math.max(sizeMin, val(SMOKE.sizeMax, u));
      const lifeMin   = Math.max(0.05, val(SMOKE.lifeMin, u));
      const lifeMax   = Math.max(lifeMin, val(SMOKE.lifeMax, u));
      const sAlpha    = Math.max(0, Math.min(255, Math.round(val(SMOKE.alpha, u))));

      const speedMin  = val(SMOKE.speedMin, u);
      const speedMax  = Math.max(speedMin, val(SMOKE.speedMax, u));
      const gravity   = val(SMOKE.gravity, u);
      const drag      = val(SMOKE.drag, u);
      const jPos      = val(SMOKE.jitterPos, u);
      const jAng      = val(SMOKE.jitterAngle, u);
      const spreadAng = val(SMOKE.spreadAngle, u);

      const blendK    = val(SMOKE.blendK, u);
      const satAmp    = val(SMOKE.satOscAmp, u);
      const satSpd    = val(SMOKE.satOscSpeed, u);

      const baseSmoke = opts.gradientRGB
        ? blendRGB(SMOKE.base, opts.gradientRGB, blendK)
        : SMOKE.base;

      let smoked = oscillateSaturation(baseSmoke, t, { amp: satAmp, speed: satSpd, phase: 0 });
      smoked = clampBrightness(smoked, SMOKE.brightnessRange[0], SMOKE.brightnessRange[1]);
      smoked = applyExposureContrast(smoked, ex, ct);

      const smokeColor = { r: smoked.r, g: smoked.g, b: smoked.b, a: sAlpha };
      const dt = Math.max(0.001, (p.deltaTime || 16) / 1000);

      stepAndDrawPuffs(p, {
        key: `chimney-smoke:${f.r0}:${f.c0}:${f.w}x${f.h}`,
        rect: { x: smokeX, y: smokeY, w: smokeColW, h: smokeColH },
        dir: SMOKE.dir,
        spreadAngle: spreadAng,
        speed: { min: speedMin, max: speedMax },
        gravity,
        drag,
        accel: { x: 0, y: 0 },

        spawn: { x0: spawnX0, x1: spawnX1, y0: spawnY0, y1: spawnY1 },
        jitter: { pos: jPos, velAngle: jAng },

        count,
        size: { min: sizeMin, max: sizeMax },
        sizeHz: SMOKE.sizeHz,

        lifetime: { min: lifeMin, max: lifeMax },
        fadeInFrac: SMOKE.fadeInFrac,
        fadeOutFrac: SMOKE.fadeOutFrac,
        edgeFadePx: SMOKE.edgeFadePx,

        color: smokeColor,
        respawn: true,
      }, dt);
    }

    // chimney on top
    fillRgb(p, bodyTint, alpha);
    p.rectMode(p.CORNER);
    p.rect(cx, cy - cH, cW, cH);
  }

// ------- Door (3 profiles: short / mid / tall) -------
{
  let doorTint = pick(HOUSE_BASE_PALETTE.door, r5);
  if (opts.gradientRGB) {
    doorTint = blendRGB(doorTint, opts.gradientRGB, val(HOUSE.body.colorBlend, u));
  }
  doorTint = applyExposureContrast(doorTint, ex, ct);

  // Choose profile by building height (in cells)
  const cellsH = bodyH / cell;
  const low = HOUSE.windows.thresholds.low;
  const mid = HOUSE.windows.thresholds.mid;
  let profile = 'short';
  if (cellsH >= low) profile = 'mid';
  if (cellsH > mid)  profile = 'tall';

  // Per-profile tuning
  const DOOR_PROFILES = {
    short: { W_FRAC: 0.18, H_FRAC: 0.20, Y_OFFSET_FRAC: 0.00 },
    mid:   { W_FRAC: 0.18, H_FRAC: 0.18, Y_OFFSET_FRAC: 0.00 },
    tall:  { W_FRAC: 0.18, H_FRAC: 0.14, Y_OFFSET_FRAC: -0.02 },
  };

  const cfg = DOOR_PROFILES[profile];

  // Fractions of body size
  const doorW = Math.max(3, Math.round(pxW * cfg.W_FRAC));
  const doorH = Math.max(6, Math.round(bodyH * cfg.H_FRAC));

  const doorX = pxX + (pxW - doorW) / 2;
  const doorY = bodyY + bodyH - doorH + Math.round(bodyH * cfg.Y_OFFSET_FRAC);

  fillRgb(p, doorTint, alpha);
  p.rect(doorX, doorY, doorW, doorH, Math.round(cell * 0.03));
}

// ------- Windows (3 size profiles: short / mid / tall; 2 per row; max 6) -------
{
  // lit/dark tints (safe)
  let winLit  = HOUSE_BASE_PALETTE.window.lit;
  let winDark = HOUSE_BASE_PALETTE.window.dark;
  if (opts.gradientRGB) {
    const k = val(HOUSE.body.colorBlend, u);
    winLit  = blendRGB(winLit,  opts.gradientRGB, k);
    winDark = blendRGB(winDark, opts.gradientRGB, k);
  }
  winLit  = applyExposureContrast(winLit,  ex, ct);
  winDark = applyExposureContrast(winDark, ex, ct);

  const cellsH = bodyH / cell;
  const low = HOUSE.windows.thresholds.low;
  const mid = HOUSE.windows.thresholds.mid;

  const PROFILES = {
    // ↓ tweaked to feel "shorter": smaller windows, higher band, more bottom keep
    short: { rows: 1, WIN_W_FRAC: 0.12, WIN_H_FRAC: 0.34, H_GAP_FRAC: 0.16, V_GAP_FRAC: 0.06, TOP_FRAC: 0.20, BOT_FRAC: 0.34 },
    mid:   { rows: 2, WIN_W_FRAC: 0.16, WIN_H_FRAC: 0.16, H_GAP_FRAC: 0.12, V_GAP_FRAC: 0.10, TOP_FRAC: 0.16, BOT_FRAC: 0.26 },
    tall:  { rows: 3, WIN_W_FRAC: 0.16, WIN_H_FRAC: 0.10, H_GAP_FRAC: 0.12, V_GAP_FRAC: 0.12, TOP_FRAC: 0.14, BOT_FRAC: 0.26 },
  };

  const profile =
    (cellsH > mid) ? PROFILES.tall :
    (cellsH >= low) ? PROFILES.mid :
    PROFILES.short;

  const cols = 2;
  let rows = profile.rows;

  let winW = Math.max(2, Math.round(pxW   * profile.WIN_W_FRAC));
  let winH = Math.max(2, Math.round(bodyH * profile.WIN_H_FRAC));
  let gapX = Math.max(2, Math.round(pxW   * profile.H_GAP_FRAC));
  let gapY = Math.max(2, Math.round(bodyH * profile.V_GAP_FRAC));

  const targetRowW = 2 * winW + gapX;
  const maxRowW = Math.floor(pxW * 0.92);
  if (targetRowW > maxRowW) {
    const over = targetRowW - maxRowW;
    const giveW = Math.min(over * 0.6, Math.max(0, winW - 2));
    const giveG = Math.min(over * 0.4, Math.max(0, gapX - 2));
    winW = Math.max(2, winW - Math.round(giveW));
    gapX = Math.max(2, gapX - Math.round(giveG));
  }

  const topOffset  = Math.round(bodyH * profile.TOP_FRAC);
  const bottomKeep = Math.round(bodyH * profile.BOT_FRAC);
  const usableH    = Math.max(0, bodyH - topOffset - bottomKeep);

  while (rows > 1 && rows * winH + (rows - 1) * gapY > usableH) rows -= 1;
  if (rows < 1) rows = 1;

  let totalWindows = Math.min(rows * cols, 6);
  if (totalWindows < 2) totalWindows = 2;

  const litCount = Math.round((1 - u) * totalWindows);

  const actualBandH = (rows > 1) ? (rows - 1) * gapY + rows * winH : winH;
  const extra = usableH - actualBandH;
  const bandStartY = bodyY + topOffset + Math.floor(extra * 0.5);

  let drawn = 0;
  for (let rr = 0; rr < rows; rr++) {
    if (drawn >= totalWindows) break;

    const y = bandStartY + rr * (winH + gapY);
    const rowWidth = 2 * winW + gapX;
    const startX = pxX + (pxW - rowWidth) / 2;

    for (let cc = 0; cc < cols; cc++) {
      if (drawn >= totalWindows) break;
      const x = startX + cc * (winW + gapX);

      if (y >= roofY + 2 && y + winH <= bodyY + bodyH - 2) {
        const tint = (drawn < litCount) ? winLit : winDark;
        fillRgb(p, tint, alpha);
        p.rect(x, y, winW, winH, Math.round(cell * 0.02));
      }
      drawn++;
    }
  }
}

  p.pop(); // undo appear transform
}
