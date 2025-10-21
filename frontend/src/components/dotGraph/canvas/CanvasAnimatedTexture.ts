// src/components/dotGraph/canvas/CanvasAnimatedTexture.ts
import * as THREE from 'three';
import { makePFromCanvas } from '../../../canvas/q5-lite.js';

type Drawer = (p: any, x: number, y: number, r: number, opts?: any) => void;

export type AnimatedTextureParams = {
  drawer: Drawer;
  tileSize?: number;
  dpr?: number;
  alpha?: number;
  gradientRGB?: { r: number; g: number; b: number };
  liveAvg?: number;
  blend?: number;
  footprint?: { w: number; h: number };
  bleed?: { top?: number; right?: number; bottom?: number; left?: number };
  seedKey?: string | number;

  /** Target paint FPS (animated only). */
  fps?: number; // default 15

  /** Texture quality knobs */
  generateMipmaps?: boolean; // default false for animated, true is OK for frozen
  anisotropy?: number;       // default 1
  minFilter?: THREE.TextureFilter; // default THREE.LinearFilter
  magFilter?: THREE.TextureFilter; // default THREE.LinearFilter
};

function resolveCanvasSize(
  tileSize: number,
  footprint: { w: number; h: number },
  bleed: { top?: number; right?: number; bottom?: number; left?: number }
) {
  const wTiles = Math.max(1e-6, footprint.w || 1);
  const hTiles = Math.max(1e-6, footprint.h || 1);
  const bTop = Math.max(0, bleed.top ?? 0);
  const bRight = Math.max(0, bleed.right ?? 0);
  const bBottom = Math.max(0, bleed.bottom ?? 0);
  const bLeft = Math.max(0, bleed.left ?? 0);

  const logicalW = Math.max(2, Math.round((wTiles + bLeft + bRight) * tileSize));
  const logicalH = Math.max(2, Math.round((hTiles + bTop + bBottom) * tileSize));
  return { logicalW, logicalH, wTiles, hTiles, bTop, bLeft };
}

function makePainter(
  cnv: HTMLCanvasElement,
  {
    drawer, dpr, alpha, gradientRGB, liveAvg, blend, tileSize,
    wTiles, hTiles, bTop, bLeft, seedKey
  }: {
    drawer: Drawer;
    dpr: number;
    alpha: number;
    gradientRGB?: { r: number; g: number; b: number };
    liveAvg: number;
    blend: number;
    tileSize: number;
    wTiles: number; hTiles: number; bTop: number; bLeft: number;
    seedKey?: string | number;
  }
) {
  const p = makePFromCanvas(cnv, { dpr });
  const ctx = p.drawingContext as CanvasRenderingContext2D;
  const centerX = cnv.width  / (2 * dpr);
  const centerY = cnv.height / (2 * dpr);
  const r = Math.min(cnv.width / dpr, cnv.height / dpr) * 0.8;

  // Sprite-only pixel/world scale relative to ~192px tuning
  const pixelScale = Math.max(1, tileSize / 192);

  const baseOpts = {
    alpha,
    gradientRGB,
    liveAvg,
    blend,
    cell: tileSize,
    footprint: { r0: bTop, c0: bLeft, w: wTiles, h: hTiles },
    seedKey,
    // lock out heavy “shapeMods” on the animated/frozen path
    fitToFootprint: true,
    /** Tell drawers how “big” this sprite texture is vs the ~192px baseline */
    coreScaleMult: pixelScale,
    pixelScale, // alias for clarity
    oscAmp: 0,
    oscSpeed: 0,
    opacityOsc: { amp: 0 },
    sizeOsc: { mode: 'none' },
  };

  function clear() {
    const prev = (ctx as any).getTransform?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    if (prev) (ctx as any).setTransform?.(prev);
  }

  let lastPaintMs = typeof performance !== 'undefined' ? performance.now() : 0;

  function paint(nowMs: number) {
    const dtMs = Math.max(0, nowMs - lastPaintMs);
    lastPaintMs = nowMs;
    clear();
    drawer(p, centerX, centerY, r, {
      ...baseOpts,
      timeMs: nowMs,
      dtMs,
      dtSec: dtMs / 1000,
    });
  }

  return { paint };
}

function makeCanvasTexture(
  cnv: HTMLCanvasElement,
  {
    generateMipmaps,
    anisotropy,
    minFilter,
    magFilter,
  }: {
    generateMipmaps: boolean;
    anisotropy: number;
    minFilter: THREE.TextureFilter;
    magFilter: THREE.TextureFilter;
  }
) {
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace; // r152+
  tex.generateMipmaps = generateMipmaps;
  tex.minFilter = minFilter;
  tex.magFilter = magFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  (tex as any).anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Runtime-animated texture (budgeted by fps) */
export function makeAnimatedTextureFromDrawer({
  drawer,
  tileSize = 192,
  dpr = typeof window !== 'undefined' ? Math.min(1.5, window.devicePixelRatio || 1) : 1,
  alpha = 235,
  gradientRGB,
  liveAvg = 0.5,
  blend = 0.6,
  footprint = { w: 1, h: 1 },
  bleed = {},
  seedKey,

  fps = 15,

  generateMipmaps = false,
  anisotropy = 1,
  minFilter = THREE.LinearFilter,
  magFilter = THREE.LinearFilter,
}: AnimatedTextureParams) {
  const { logicalW, logicalH, wTiles, hTiles, bTop, bLeft } =
    resolveCanvasSize(tileSize, footprint, bleed);

  const cnv = document.createElement('canvas');
  // Style sizes are purely cosmetic; q5-lite will set backing store by DPR
  cnv.style.width = `${logicalW}px`;
  cnv.style.height = `${logicalH}px`;

  const { paint } = makePainter(cnv, {
    drawer, dpr, alpha, gradientRGB, liveAvg, blend, tileSize,
    wTiles, hTiles, bTop, bLeft, seedKey
  });

  // initial paint
  paint(typeof performance !== 'undefined' ? performance.now() : 0);

  const texture = makeCanvasTexture(cnv, {
    generateMipmaps, anisotropy, minFilter, magFilter,
  });

  // throttle paints to target fps
  const frameInterval = 1000 / Math.max(1, fps);
  let lastTickMs = -Infinity;

  function redraw(nowMs: number) {
    if (nowMs - lastTickMs < frameInterval) return false;
    lastTickMs = nowMs;
    paint(nowMs);
    return true;
  }

  return { texture, redraw };
}

/** One-time simulated “frozen” texture (advance particles, then freeze last frame) */
export function makeFrozenTextureFromDrawer({
  drawer,
  tileSize = 192,
  dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1,
  alpha = 235,
  gradientRGB,
  liveAvg = 0.5,
  blend = 0.6,
  footprint = { w: 1, h: 1 },
  bleed = {},
  seedKey,

  // simulate a short warm-up so particles are clearly visible
  // (e.g., 1200ms total in 33ms steps ≈ 36 frames)
  simulateMs = 1200,
  stepMs = 33,

  // higher quality is fine because we won’t repaint
  generateMipmaps = true,
  anisotropy = 2,
  minFilter = THREE.LinearMipmapLinearFilter,
  magFilter = THREE.LinearFilter,
}: AnimatedTextureParams & { simulateMs?: number; stepMs?: number }) {
  const { logicalW, logicalH, wTiles, hTiles, bTop, bLeft } =
    resolveCanvasSize(tileSize, footprint, bleed);

  const cnv = document.createElement('canvas');
  cnv.style.width = `${logicalW}px`;
  cnv.style.height = `${logicalH}px`;

  const { paint } = makePainter(cnv, {
    drawer, dpr, alpha, gradientRGB, liveAvg, blend, tileSize,
    wTiles, hTiles, bTop, bLeft, seedKey
  });

  // Simulate several frames ahead so particles are “in motion” on the frozen frame.
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const total = Math.max(0, simulateMs | 0);
  const step  = Math.max(1, stepMs | 0);
  let t = start;

  // Paint initial
  paint(t);

  // Advance in fixed steps; last paint wins
  const end = start + total;
  for (t = start + step; t <= end; t += step) {
    paint(t);
  }

  const texture = makeCanvasTexture(cnv, {
    generateMipmaps, anisotropy, minFilter, magFilter,
  });

  // No redraw function needed for frozen; provide a stub
  function redraw() { return false; }

  return { texture, redraw };
}
