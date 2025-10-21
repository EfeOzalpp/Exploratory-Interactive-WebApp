import * as React from 'react';
import * as THREE from 'three';
import { shapeForAvg, type ShapeKey } from './shapeForAvg.ts';
import { makeTextureFromDrawer } from './CanvasTextureBridge.ts';
import { makeFrozenTextureFromDrawer } from './CanvasAnimatedTexture.ts';
import { computeVisualStyle } from '../../../canvas/utils/avgToStyle.ts';

import {
  drawClouds, drawSnow, drawHouse, drawPower, drawSun,
  drawVilla, drawCarFactory, drawCar, drawSea, drawBus, drawTrees,
} from '../../../canvas/shape/index.js';

const DRAWERS: Partial<Record<ShapeKey, (p: any, x: number, y: number, size: number, opts?: any) => void>> = {
  sea: drawSea,
  trees: drawTrees,
  house: drawHouse,
  power: drawPower,
  carFactory: drawCarFactory,
  car: drawCar,
  bus: drawBus,
  clouds: drawClouds,
  sun: drawSun,
  snow: drawSnow,
  villa: drawVilla,
};

// Shapes eligible for particle “frozen” snapshot
const PARTICLE_SHAPES = new Set<ShapeKey>(['snow', 'clouds']);

// Footprints (in tiles)
const FOOTPRINT: Record<ShapeKey, { w: number; h: number }> = {
  clouds: { w: 2, h: 3 },
  bus: { w: 2, h: 1 },
  snow:   { w: 1, h: 3 },
  house:  { w: 1, h: 3 },
  power:  { w: 1, h: 3 },
  sun:    { w: 2, h: 2 },
  villa:  { w: 2, h: 2 },
  car:    { w: 1, h: 1 },
  sea:    { w: 2, h: 1 },
  carFactory: { w: 2, h: 2 },
  trees:  { w: 1, h: 1 },
};

// Extra bleed (in tiles)
const BLEED: Partial<Record<ShapeKey, { top?: number; right?: number; bottom?: number; left?: number }>> = {
  trees: { top: 0.45, left: 0.08, right: 0.08, bottom: 0.10 },
  clouds:{ top: 0.35, left: 0.18, right: 0.35, bottom: 0.35 },
  snow:  { top: 0.10, bottom: 0.10, left: 0.35, right: 0.35 },
  villa: { top: 0.08, bottom: 0.12, left: 0.08, right: 0.08 },
  house: { top: 0, bottom: 0, left: 0, right: 0 },
  power: { top: 0.08, bottom: 0.12, left: 0.5, right: 0.5 },
  carFactory: { top: 0.16, bottom: 0.12, left: 0.12, right: 0.12 },
  sea:   { top: 0.10, bottom: 0.10, left: 0.10, right: 0.10 },
  car:   { top: 0.16, bottom: 0.28, left: 0.36, right: 0.36 },
  bus:   { top: 0.06, bottom: 0.08, left: 0.10, right: 0.10 },
  sun:   { top: 2, bottom: 2, left: 2, right: 2 },
};

/** per-shape sprite-only scale multipliers */
const VISUAL_SCALE: Partial<Record<ShapeKey, number>> = {
  car: 0.86,
  snow: 1.18,
};

/** per-shape anchor Y bias (in units of the **sprite’s final height**) */
const ANCHOR_BIAS_Y: Partial<Record<ShapeKey, number>> = {
  car: -0.14,
};

/** softstep */
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Low-end *lerp* compression */
function compressLowLerp(
  x: number,
  { lowKnee = 0.65, kneeWidth = 0.08, lowBias = 0.55 }: { lowKnee?: number; kneeWidth?: number; lowBias?: number } = {}
) {
  const X = Math.max(0, Math.min(1, x));
  if (X >= lowKnee) return X;
  const w0 = lowKnee - kneeWidth;
  const t = 1 - smoothstep(w0, lowKnee, X);
  const target = X * Math.max(0, Math.min(1, lowBias));
  return (1 - t) * X + t * target;
}

type TextureMode =
  | { kind: 'static' }
  | { kind: 'frozen'; simulateMs?: number; stepMs?: number };

function useShapeTexture(
  shape: ShapeKey,
  mode: TextureMode,
  {
    size = 192,
    alpha = 195,
    dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1,
    gradientRGB,
    liveAvg = 0.5,
    blend = 0.6,
    cacheKey,
    seed,
  }: {
    size?: number;
    alpha?: number;
    dpr?: number;
    gradientRGB?: { r: number; g: number; b: number };
    liveAvg?: number;
    blend?: number;
    cacheKey?: string;
    seed?: string | number;
  } = {}
) {
  const key = React.useMemo(() => {
    const g = gradientRGB
      ? `${Math.round(gradientRGB.r)}_${Math.round(gradientRGB.g)}_${Math.round(gradientRGB.b)}`
      : 'none';
    const lv = Math.round(Math.max(0, Math.min(1, liveAvg)) * 1000);
    const sd = seed == null ? 'n' : String(seed);
    const modeTag =
      mode.kind === 'frozen'
        ? `frozen_${Math.round((mode.simulateMs ?? 1200))}_${Math.round((mode.stepMs ?? 33))}`
        : 'static';
    return `${cacheKey ?? 'shape'}|${shape}|${size}|${dpr}|${alpha}|${g}|${lv}|${Math.round((blend ?? 0) * 1000)}|${sd}|${modeTag}`;
  }, [shape, size, dpr, alpha, gradientRGB?.r, gradientRGB?.g, gradientRGB?.b, liveAvg, blend, cacheKey, seed, (mode as any).kind, (mode as any).simulateMs, (mode as any).stepMs]);

  const [tex, setTex] = React.useState<THREE.CanvasTexture | null>(null);

  React.useEffect(() => {
    (window as any).__GP_TEX_CACHE = (window as any).__GP_TEX_CACHE || new Map<string, THREE.CanvasTexture>();
    const cache: Map<string, THREE.CanvasTexture> = (window as any).__GP_TEX_CACHE;

    const cached = cache.get(key);
    if (cached) {
      setTex(cached);
      return;
    }

    const drawer = DRAWERS[shape];
    const fallbackDrawer = (p: any, x: number, y: number, size: number) => {
      const r = size * 0.32;
      p.noStroke?.();
      p.fill?.(255, 255, 255, 220);
      p.circle?.(x, y, r * 2);
    };

    const footprint = FOOTPRINT[shape] ?? { w: 1, h: 1 };
    const bleed = BLEED[shape] ?? {};

    let t: THREE.CanvasTexture;

    if (mode.kind === 'frozen') {
      const { texture } = makeFrozenTextureFromDrawer({
        drawer: drawer ?? fallbackDrawer,
        tileSize: size,
        dpr,
        alpha,
        gradientRGB,
        liveAvg,
        blend,
        footprint,
        bleed,
        seedKey: key,
        simulateMs: mode.simulateMs ?? 1200,
        stepMs: mode.stepMs ?? 33,
        generateMipmaps: true,
        anisotropy: 2,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
      });
      t = texture;
    } else {
      t = makeTextureFromDrawer({
        drawer: drawer ?? fallbackDrawer,
        tileSize: size,
        alpha,
        dpr,
        gradientRGB,
        liveAvg,
        blend,
        footprint,
        bleed,
        seedKey: key,
      });
    }

    cache.set(key, t);
    setTex(t);
  }, [key, shape, size, alpha, dpr, gradientRGB?.r, gradientRGB?.g, gradientRGB?.b, liveAvg, blend, (mode as any).kind, (mode as any).simulateMs, (mode as any).stepMs]);

  return tex;
}

/* --------------------------------- Sprite ----------------------------------- */

export function SpriteShape({
  avg,
  seed,
  orderIndex,
  position = [0, 0, 0],
  scale = 3.6,
  tileSize = 192,
  alpha = 195,
  blend = 0.6,
  cacheTag,
  opacity = 1,
  // Lerp compression
  lowKnee = 0.65,
  kneeWidth = 0.08,
  lowBias = 0.55,
  // Per-shape tweak (optional)
  perShapeGammaBoost = { power: 1.10 },
  // Snapshot particles so rain/snow look mid-motion by default
  freezeParticles = true,
  // Warm-up tuning for the snapshot
  particleSimulateMs = 13200,
  particleStepMs = 33,
}: {
  avg: number;
  seed?: string | number;
  orderIndex?: number;
  position?: [number, number, number];
  scale?: number;
  tileSize?: number;
  alpha?: number;
  blend?: number;
  cacheTag?: string;
  opacity?: number;
  lowKnee?: number;
  kneeWidth?: number;
  lowBias?: number;
  perShapeGammaBoost?: Partial<Record<ShapeKey, number>>;
  freezeParticles?: boolean;
  particleSimulateMs?: number;
  particleStepMs?: number;
}) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const raw = Number.isFinite(avg) ? avg : 0.5;
  const x = clamp01(raw);

  let biased = compressLowLerp(x, { lowKnee, kneeWidth, lowBias });

  const provisionalShape = React.useMemo(
    () => shapeForAvg(biased, seed ?? x, orderIndex),
    [biased, x, seed, orderIndex]
  );

  const gammaBoost = perShapeGammaBoost[provisionalShape] ?? 1;
  if (gammaBoost !== 1 && biased < lowKnee) {
    const boostedBias = Math.max(0, Math.min(1, lowBias / Math.max(1e-6, gammaBoost)));
    biased = compressLowLerp(x, { lowKnee, kneeWidth, lowBias: boostedBias });
    biased = Math.max(0, Math.min(lowKnee, biased));
  }

  const shape = provisionalShape;
  const visualStyle = React.useMemo(() => computeVisualStyle(biased), [biased]);

  // Default to a pre-warmed frozen snapshot for particle shapes
  const wantsFrozen = PARTICLE_SHAPES.has(shape) ? freezeParticles : false;
  const mode: TextureMode = wantsFrozen
    ? { kind: 'frozen', simulateMs: particleSimulateMs, stepMs: particleStepMs }
    : { kind: 'static' };

  const tex = useShapeTexture(shape, mode, {
    size: tileSize,
    alpha: visualStyle.alpha ?? alpha,
    dpr: typeof window !== 'undefined' ? Math.min(mode.kind === 'frozen' ? 2 : 2, window.devicePixelRatio || 1) : 1,
    gradientRGB: visualStyle.rgb,
    liveAvg: biased,
    blend: visualStyle.blend ?? blend,
    cacheKey: cacheTag,
    seed,
  });

  if (!tex) return null;

  const shapeScaleK = VISUAL_SCALE[shape] ?? 1;
  const finalScale = scale * shapeScaleK;

  const iw = (tex.image as HTMLCanvasElement | HTMLImageElement | undefined)?.width ?? 1;
  const ih = (tex.image as HTMLCanvasElement | HTMLImageElement | undefined)?.height ?? 1;
  const maxSide = Math.max(iw, ih) || 1;
  const sx = finalScale * (iw / maxSide);
  const sy = finalScale * (ih / maxSide);

  const biasY = ANCHOR_BIAS_Y[shape] ?? 0;
  const pos = Array.isArray(position) ? ([...position] as [number, number, number]) : [0, 0, 0];
  pos[1] += sy * biasY;

  return (
    <sprite position={pos as any} scale={[sx, sy, 1]} renderOrder={5}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} opacity={opacity} />
    </sprite>
  );
}
