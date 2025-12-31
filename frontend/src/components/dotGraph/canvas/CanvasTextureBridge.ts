// src/components/dotGraph/canvas/CanvasTextureBridge.ts
import * as THREE from 'three';
import { makePFromCanvas } from '../../../canvas/canvas-engine.js';

type Drawer = (p: any, x: number, y: number, r: number, opts?: any) => void;

export type Footprint = { w: number; h: number };
export type BleedFrac = { top?: number; right?: number; bottom?: number; left?: number };

/**
 * Make a CanvasTexture by rendering a shape drawer on an offscreen canvas,
 * with support for tile footprints (w×h) and per-side BLEED padding
 * so overflow (like tree tops) never gets clipped.
 *
 * - `tileSize` is the pixel size of ONE TILE (the "cell").
 * - Canvas size = (w + left + right) * tileSize by (h + top + bottom) * tileSize.
 * - The shape footprint is placed at (c0 = leftBleed, r0 = topBleed).
 */
export function makeTextureFromDrawer({
  drawer,
  tileSize = 192,
  alpha = 235,
  dpr = typeof window !== 'undefined'
    ? Math.min(2, window.devicePixelRatio || 1)
    : 1,
  gradientRGB,
  liveAvg = 0.5,
  blend = 0.6,
  footprint = { w: 1, h: 1 },
  bleed = {},
  timeMs = (typeof performance !== 'undefined' ? performance.now() : 0),
  seedKey,
}: {
  drawer: Drawer;
  tileSize?: number;
  alpha?: number;
  dpr?: number;
  gradientRGB?: { r: number; g: number; b: number };
  liveAvg?: number;
  blend?: number;
  footprint?: Footprint;
  bleed?: BleedFrac;
  timeMs?: number;
  seedKey?: string | number;
}): THREE.CanvasTexture {
  const wTiles = Math.max(1e-6, footprint.w || 1);
  const hTiles = Math.max(1e-6, footprint.h || 1);

  const bTop    = Math.max(0, bleed.top    ?? 0);
  const bRight  = Math.max(0, bleed.right  ?? 0);
  const bBottom = Math.max(0, bleed.bottom ?? 0);
  const bLeft   = Math.max(0, bleed.left   ?? 0);

  // Canvas size in tiles
  const totalTilesW = wTiles + bLeft + bRight;
  const totalTilesH = hTiles + bTop  + bBottom;

  // Canvas size in CSS pixels (logical)
  const logicalW = Math.max(2, Math.round(totalTilesW * tileSize));
  const logicalH = Math.max(2, Math.round(totalTilesH * tileSize));

  // offscreen canvas
  const cnv = document.createElement('canvas');
  // Set CSS size so makePFromCanvas can compute backing store with DPR
  cnv.style.width = `${logicalW}px`;
  cnv.style.height = `${logicalH}px`;

  // build p facade with DPR; this sets intrinsic width/height and transform
  const p = makePFromCanvas(cnv, { dpr });
  const ctx = p.drawingContext as CanvasRenderingContext2D;

  // IMPORTANT: makePFromCanvas already handled DPR transform.
  // Do NOT re-apply setTransform(dpr, …) here; just clear safely.
  {
    const prev = (ctx as any).getTransform?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    if (prev) (ctx as any).setTransform?.(prev);
  }

  // logical center (the p facade already maps logical coords → device)
  const centerX = logicalW / 2;
  const centerY = logicalH / 2;

  // tile cell size (logical)
  const cell = tileSize;

  // place the footprint INSIDE the padded canvas
  const footprintForDrawer = {
    r0: bTop,
    c0: bLeft,
    w:  wTiles,
    h:  hTiles,
  };

  const opts = {
    alpha,
    gradientRGB,
    liveAvg,
    blend,
    timeMs,
    fitToFootprint: true,
    cell,
    footprint: footprintForDrawer,
    seedKey,
    coreScaleMult: 1,
    oscAmp: 0,
    oscSpeed: 0,
    opacityOsc: { amp: 0 },
    sizeOsc: { mode: 'none' },
  };

  let failed = false;
  try {
    // many drawers rely entirely on footprint/cell; pass x/y/r anyway
    const r = Math.min(logicalW, logicalH) * 0.8;
    drawer(p, centerX, centerY, r, opts);
  } catch (err) {
    console.warn('[CanvasTextureBridge] drawer failed → fallback', err);
    failed = true;
  }

  // Only show fallback if the drawer actually errored
  if (failed) {
    ctx.save();
    // clear with current transform intact
    const prev = (ctx as any).getTransform?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    if (prev) (ctx as any).setTransform?.(prev);

    ctx.fillStyle = 'rgba(180,180,180,0.5)';
    const rr = Math.min(logicalW, logicalH) * 0.25;
    ctx.beginPath();
    ctx.arc(centerX, centerY, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // build the THREE texture
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  (tex as any).anisotropy = 8;
  tex.needsUpdate = true;

  return tex;
}
