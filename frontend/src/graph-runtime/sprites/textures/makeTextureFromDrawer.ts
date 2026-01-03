// graph-runtime/sprites/textures/makeTextureFromDrawer.ts
import * as THREE from 'three';
import { makeCanvasFacade } from './canvasFacade.ts';

type Drawer = (p: any, x: number, y: number, r: number, opts?: any) => void;

export type Footprint = { w: number; h: number };
export type BleedFrac = { top?: number; right?: number; bottom?: number; left?: number };

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

  const totalTilesW = wTiles + bLeft + bRight;
  const totalTilesH = hTiles + bTop  + bBottom;

  const logicalW = Math.max(2, Math.round(totalTilesW * tileSize));
  const logicalH = Math.max(2, Math.round(totalTilesH * tileSize));

  const cnv = document.createElement('canvas');
  cnv.style.width = `${logicalW}px`;
  cnv.style.height = `${logicalH}px`;

  const p = makeCanvasFacade(cnv, { dpr });
  const ctx = p.drawingContext as CanvasRenderingContext2D;

  {
    const prev = (ctx as any).getTransform?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    if (prev) (ctx as any).setTransform?.(prev);
  }

  const centerX = logicalW / 2;
  const centerY = logicalH / 2;

  const cell = tileSize;

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
    const r = Math.min(logicalW, logicalH) * 0.8;
    drawer(p, centerX, centerY, r, opts);
  } catch (err) {
    console.warn('[CanvasTextureBridge] drawer failed → fallback', err);
    failed = true;
  }

  if (failed) {
    ctx.save();
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
