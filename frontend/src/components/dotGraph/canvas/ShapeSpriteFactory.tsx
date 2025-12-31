// src/components/dotGraph/canvas/ShapeSpriteFactory.tsx
import * as React from 'react';
import * as THREE from 'three';

import { shapeForAvg, type ShapeKey } from './shapeForAvg.ts';
import { computeVisualStyle } from '../../../canvas/utils/avgToStyle.ts';

// Existing build paths
import { makeFrozenTextureFromDrawer } from './CanvasAnimatedTexture.ts';

// Perf infra
import { textureRegistry, type MakeArgs } from './textureRegistry.ts';
import { enqueueTexture } from './textureQueue.ts';

// LRU particle cache
import {
  particleCacheGet,
  particleCacheSet,
  particleCacheClear,
  particleCacheSize,
} from './particleCache.ts';

// Drawers
import {
  drawClouds, drawSnow, drawHouse, drawPower, drawSun,
  drawVilla, drawCarFactory, drawCar, drawSea, drawBus, drawTrees,
} from '../../../canvas/shape/index.js';

/* --------------------------------- drawers --------------------------------- */
const DRAWERS: Partial<Record<ShapeKey, (p: any, x: number, y: number, size: number, opts?: any) => void>> = {
  sea: drawSea, trees: drawTrees, house: drawHouse, power: drawPower, carFactory: drawCarFactory,
  car: drawCar, bus: drawBus, clouds: drawClouds, sun: drawSun, snow: drawSnow, villa: drawVilla,
};

/* --------------------------- footprints & bleed ---------------------------- */
const FOOTPRINT: Record<ShapeKey, { w: number; h: number }> = {
  clouds: { w: 2, h: 3 }, bus: { w: 2, h: 1 }, snow: { w: 1, h: 3 }, house: { w: 1, h: 3 },
  power: { w: 1, h: 3 }, sun: { w: 2, h: 2 }, villa: { w: 2, h: 2 }, car: { w: 1, h: 1 },
  sea: { w: 2, h: 1 }, carFactory: { w: 2, h: 2 }, trees: { w: 1, h: 1 },
};
const BLEED: Partial<Record<ShapeKey, { top?: number; right?: number; bottom?: number; left?: number }>> = {
  trees: { top: 0.75, left: 0.08, right: 0.08, bottom: 0.10 },
  clouds:{ top: 0.35, left: 0.18, right: 0.35, bottom: 0.35 },
  snow:  { top: 0.10, bottom: 0.10, left: 0.35, right: 0.35 },
  villa: { top: 0.08, bottom: 0.12, left: 0.08, right: 0.08 },
  house: { top: 0, bottom: 0, left: 0, right: 0 },
  power: { top: 0.08, bottom: 0.12, left: 0.5, right: 0.5 },
  carFactory: { top: 0.75, bottom: 0.12, left: 0.12, right: 0.12 },
  sea:   { top: 0.10, bottom: 0.10, left: 0.10, right: 0.10 },
  car:   { top: 0.16, bottom: 0.28, left: 0.36, right: 0.36 },
  bus:   { top: 0.06, bottom: 0.08, left: 0.10, right: 0.10 },
  sun:   { top: 2, bottom: 2, left: 2, right: 2 },
};

/* --------------------------- per-shape visual tweaks ----------------------- */
const VISUAL_SCALE: Partial<Record<ShapeKey, number>> = { car: 0.86, snow: 1.18 };
const ANCHOR_BIAS_Y: Partial<Record<ShapeKey, number>> = { car: -0.14 };

/* -------------------------------- particles -------------------------------- */
const PARTICLE_SHAPES = new Set<ShapeKey>(['snow', 'clouds']);

/* --------------------------- avg bucketing (extra-strong bias) ------------ */
export const SPRITE_TINT_BUCKETS = 10;

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

/** Heavier skew into the lower half before quantization. */
const BIAS_GAMMA = 1.8; // 1.6 strong, 1.8 extra-strong, 2.0 extreme
function biasDown(t: number, gamma = BIAS_GAMMA) {
  return Math.pow(clamp01(t), Math.max(1, gamma));
}

/** 0..9 bucket from the *biased* avg */
function rawBucketIdFromAvg(avg: number) {
  const t = Number.isFinite(avg) ? avg : 0.5;
  const tb = biasDown(t);
  return Math.min(SPRITE_TINT_BUCKETS - 1, Math.floor(tb * SPRITE_TINT_BUCKETS));
}

/**
 * Hard remap table (index = original bucket 0..9).
 * Effect:
 *  - 70–100% (7,8,9) -> 6  (→ 60–70%)
 *  - 60–70% (6)      -> 4  (→ 40–50%)
 *  - 50–60% (5)      -> 3  (→ 30–40%)
 *  - 40–50% (4)      -> 2  (→ 20–30%)
 *  - 30–40% (3)      -> 1  (→ 10–20%)
 *  - 20–30% (2)      -> 1  (→ 10–20%)
 *  - 10–20% (1)      -> 0  (→ 0–10%)
 *  - 0–10%  (0)      -> 0
 */
const REMAP: number[] = [0, 0, 1, 1, 2, 3, 4, 6, 6, 6];

function adjustedBucketId(id: number) {
  return REMAP[Math.max(0, Math.min(9, id))];
}

function bucketMidpoint(id: number) {
  return (id + 0.5) / SPRITE_TINT_BUCKETS;
}

export function quantizeAvgWithDownshift(avg: number) {
  const base = rawBucketIdFromAvg(avg);
  const adj  = adjustedBucketId(base);
  return { bucketId: adj, bucketAvg: bucketMidpoint(adj) };
}

/* --------------------------- texture tracking/cleanup ---------------------- */
const __GLOBAL_TEX = new Set<THREE.CanvasTexture>();
function track(tex: THREE.CanvasTexture) { __GLOBAL_TEX.add(tex); return tex; }
export function disposeAllSpriteTextures() {
  try { for (const t of __GLOBAL_TEX) { try { t.dispose(); } catch {} } } catch {}
  __GLOBAL_TEX.clear();
  try { particleCacheClear(); } catch {}
  try { (textureRegistry as any)?.clear?.(); } catch {}
}
if (typeof window !== 'undefined') (window as any).__GP_DISPOSE_TEX = disposeAllSpriteTextures;

/* --------------------------- variant slot helpers -------------------------- */
/**
 * Keep variety bounded: each (shape,bucket) gets VAR_SLOTS deterministic variants.
 * Bump VAR_SLOTS (2..4) if you want more variety; cache growth is linear in slots.
 */
const VAR_SLOTS = 3;

function hash01(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}
function pickVariantSlot(seedStr: string, slots = VAR_SLOTS) {
  return Math.floor(hash01(seedStr) * slots) % slots; // 0..slots-1
}

/* ------------------------------- key builders ------------------------------ */
/** Keys include bucket id AND a small V-slot for bounded variety. */
function staticKey({ shape, tileSize, dpr, alpha, bucketId, variant }:{
  shape: ShapeKey; tileSize: number; dpr: number; alpha: number; bucketId: number; variant: number;
}) {
  return `SPRITE|${shape}|B${bucketId}|V${variant}|${tileSize}|${dpr}|${alpha}|STATIC_NATIVE`;
}
function frozenKey({ shape, tileSize, dpr, alpha, simulateMs, stepMs, bucketId, variant }:{
  shape: ShapeKey; tileSize: number; dpr: number; alpha: number; simulateMs: number; stepMs: number; bucketId: number; variant: number;
}) {
  return `SPRITE|${shape}|B${bucketId}|V${variant}|${tileSize}|${dpr}|${alpha}|FROZEN_NATIVE_${Math.round(simulateMs)}_${Math.round(stepMs)}`;
}

/* ---------- Small helpers exported so dotGraph can hide loader smartly ----- */
export function makeSpriteKey(args: {
  avg: number; seed?: string|number; orderIndex?: number;
  tileSize: number; alpha: number; dpr?: number;
  freezeParticles: boolean; particleFrames: number; particleStepMs: number;
  /** optional: override number of variant slots or seed used to choose slot */
  variantSlots?: number; variantSeed?: string|number;
}) {
  const t = clamp01(Number.isFinite(args.avg) ? args.avg : 0.5);
  const { bucketId } = quantizeAvgWithDownshift(args.avg);
  const shape = shapeForAvg(t, args.seed ?? t, args.orderIndex);
  const dpr = typeof window !== 'undefined' ? Math.min(1.5, window.devicePixelRatio || 1.5) : (args.dpr ?? 1);
  const simulateMs = Math.max(0, args.particleFrames * args.particleStepMs);

  const slots = Math.max(1, args.variantSlots ?? VAR_SLOTS);
  const vSeed = args.variantSeed ?? `${shape}|B${bucketId}|${args.seed ?? ''}|${args.orderIndex ?? 0}`;
  const variant = pickVariantSlot(String(vSeed), slots);

  return args.freezeParticles
    ? `SPRITE|${shape}|B${bucketId}|V${variant}|${args.tileSize}|${dpr}|${args.alpha}|FROZEN_NATIVE_${simulateMs}_${args.particleStepMs}`
    : `SPRITE|${shape}|B${bucketId}|V${variant}|${args.tileSize}|${dpr}|${args.alpha}|STATIC_NATIVE`;
}
export function hasSpriteTexture(key: string) {
  return !!(textureRegistry.get(key) || particleCacheGet(key));
}

/* --------------------- failure sentinel for particle builds ---------------- */
const FAILED_PARTICLE_KEYS = new Set<string>();

/* --------------------- in-flight guard for frozen builds -------------- */
const FROZEN_INFLIGHT = new Set<string>();

/* ------------------------------- prewarm API ------------------------------- */
export function prewarmSpriteTextures(
  items: Array<{ avg: number; orderIndex?: number; seed?: string | number }>,
  {
    tileSize = 256,
    alpha = 215,
    dpr = typeof window !== 'undefined' ? Math.min(1.5, window.devicePixelRatio || 1.5) : 1,
    particleStepMs = 33,
    particleFrames = 36,
    maxCount = 32,
  }: { tileSize?: number; alpha?: number; dpr?: number; particleStepMs?: number; particleFrames?: number; maxCount?: number } = {}
) {
  const TILE = Math.min(tileSize, 128);
  const simulateMs = Math.max(0, particleFrames * particleStepMs);

  const seen = new Set<string>(); // (shape,bucketId,variant)
  const jobs: MakeArgs[] = [];
  const particleJobs: Array<() => void> = [];

  const limited = items.slice(0, Math.max(1, maxCount));

  for (let i = 0; i < limited.length; i++) {
    const it = limited[i];

    const tShape = clamp01(Number.isFinite(it.avg) ? it.avg : 0.5);
    const shape = shapeForAvg(tShape, it.seed ?? tShape, it.orderIndex);

    const { bucketId, bucketAvg } = quantizeAvgWithDownshift(it.avg);

    const variant = pickVariantSlot(`${shape}|B${bucketId}|${it.seed ?? ''}|${it.orderIndex ?? 0}`);
    const seenKey = `${shape}:${bucketId}:V${variant}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const drawer = DRAWERS[shape]!;
    const footprint = FOOTPRINT[shape] ?? { w: 1, h: 1 };
    const bleed = BLEED[shape];

    const vs = computeVisualStyle(bucketAvg);
    const alphaUse = vs.alpha ?? alpha;

    if (PARTICLE_SHAPES.has(shape)) {
      const key = frozenKey({
        shape,
        tileSize: TILE,
        dpr,
        alpha: alphaUse,
        simulateMs,
        stepMs: particleStepMs,
        bucketId,
        variant,
      });

      if (!particleCacheGet(key) && !FAILED_PARTICLE_KEYS.has(key) && !FROZEN_INFLIGHT.has(key)) {
        FROZEN_INFLIGHT.add(key);

        particleJobs.push(() => {
          try {
            const { texture } = makeFrozenTextureFromDrawer({
              drawer,
              tileSize: TILE,
              dpr,
              alpha: alphaUse,
              gradientRGB: vs.rgb,
              liveAvg: bucketAvg,
              blend: vs.blend ?? 1.0,
              footprint,
              bleed,
              seedKey: `${key}|seed:${shape}|${variant}`,
              simulateMs,
              stepMs: particleStepMs,
              generateMipmaps: true,
              anisotropy: 1,
              minFilter: THREE.LinearMipmapLinearFilter,
              magFilter: THREE.LinearFilter,
            });
            particleCacheSet(key, track(texture));
          } catch (err) {
            FAILED_PARTICLE_KEYS.add(key);
            if ((window as any).__GP_LOG_LOAD_ERRORS) {
              console.warn('[SPRITE:FROZEN] build failed (prewarm)', key, err);
            }
            // immediate static fallback so there’s always something
            const sKey = staticKey({ shape, tileSize: TILE, dpr, alpha: alphaUse, bucketId, variant });
            if (!textureRegistry.get(sKey)) {
              textureRegistry.ensure({
                key: sKey,
                drawer,
                tileSize: TILE,
                dpr,
                alpha: alphaUse,
                gradientRGB: vs.rgb,
                liveAvg: bucketAvg,
                blend: vs.blend ?? 1.0,
                footprint,
                bleed,
                seedKey: `${sKey}|seed:${shape}|${variant}`,
                prio: 0,
              });
            }
          } finally {
            FROZEN_INFLIGHT.delete(key);
          }
        });
      }
    } else {
      const key2 = staticKey({ shape, tileSize: TILE, dpr, alpha: alphaUse, bucketId, variant });
      if (!textureRegistry.get(key2)) {
        jobs.push({
          key: key2,
          drawer,
          tileSize: TILE,
          dpr,
          alpha: alphaUse,
          gradientRGB: vs.rgb,
          liveAvg: bucketAvg,
          blend: vs.blend ?? 1.0,
          footprint,
          bleed,
          seedKey: `${key2}|seed:${shape}|${variant}`,
          prio: 0,
        });
      }
    }
  } 

  if (jobs.length) textureRegistry.prewarm(jobs, { prioBase: 0 } as any);
  for (const run of particleJobs) enqueueTexture(run, 1000);

  if (typeof window !== 'undefined') {
    (window as any).__GP_PARTICLE_TEX = { size: particleCacheSize() };
  }
} 

/* --------------------------------- Sprite --------------------------------- */
export function SpriteShape({
  avg,
  seed,
  orderIndex,
  position = [0, 0, 0],
  scale = 3.6,
  tileSize = 256,
  alpha = 215,
  blend = 1.0,
  opacity = 1,
  freezeParticles = true,
  particleFrames = 240,
  particleStepMs = 33,
  /** Optional knobs to control variant selection externally if needed */
  variantSlots = VAR_SLOTS,
  variantSeed,
}: {
  avg: number;
  seed?: string | number;
  orderIndex?: number;
  position?: [number, number, number];
  scale?: number;
  tileSize?: number;
  alpha?: number;
  blend?: number;
  opacity?: number;
  freezeParticles?: boolean;
  particleFrames?: number;
  particleStepMs?: number;
  variantSlots?: number;
  variantSeed?: string | number;
}) {
  const tShape = clamp01(Number.isFinite(avg) ? avg : 0.5);
  const { bucketId, bucketAvg } = quantizeAvgWithDownshift(avg);

  const shape = React.useMemo(
    () => shapeForAvg(tShape, seed ?? tShape, orderIndex),
    [tShape, seed, orderIndex]
  );

  // CAP TILE EVERYWHERE
  const TILE = Math.min(tileSize, 128);

  const dpr =
    typeof window !== 'undefined'
      ? Math.min(1.5, window.devicePixelRatio || 1.5)
      : 1;

  const wantsFrozen = freezeParticles && (shape === 'snow' || shape === 'clouds');
  const simulateMs = Math.max(0, particleFrames * particleStepMs);

  const vs = computeVisualStyle(bucketAvg);
  const alphaUse = vs.alpha ?? alpha;

  // Deterministic variant slot for this instance
  const variant = React.useMemo(() => {
    const vSeed = variantSeed ?? `${shape}|B${bucketId}|${seed ?? ''}|${orderIndex ?? 0}`;
    return pickVariantSlot(String(vSeed), Math.max(1, variantSlots));
  }, [shape, bucketId, seed, orderIndex, variantSeed, variantSlots]);

  const key = React.useMemo(() => {
    return wantsFrozen
      ? `SPRITE|${shape}|B${bucketId}|V${variant}|${TILE}|${dpr}|${alphaUse}|FROZEN_NATIVE_${simulateMs}_${particleStepMs}`
      : `SPRITE|${shape}|B${bucketId}|V${variant}|${TILE}|${dpr}|${alphaUse}|STATIC_NATIVE`;
  }, [shape, bucketId, variant, TILE, dpr, alphaUse, wantsFrozen, simulateMs, particleStepMs]);

  const [tex, setTex] = React.useState<THREE.CanvasTexture | null>(() =>
    wantsFrozen ? particleCacheGet(key) || null : textureRegistry.get(key) || null
  );

  React.useEffect(() => {
    let cancelled = false;
    let off: (() => void) | undefined;
    let watchdog: any;

    const setIfAlive = (t: THREE.CanvasTexture | null) => {
      if (!cancelled && t) setTex(track(t));
    };

    const drawer = DRAWERS[shape];
    if (!drawer) return;

    const common = {
      tileSize: TILE,
      dpr,
      alpha: alphaUse,
      liveAvg: bucketAvg,
      blend: vs.blend ?? 1.0,
      gradientRGB: vs.rgb,
      footprint: FOOTPRINT[shape] ?? { w: 1, h: 1 },
      bleed: BLEED[shape],
      seedKey: `${key}|seed:${shape}|${variant}`, // keep RNG in sync with cache key
    } as const;

    // quick exit if already have a texture
    if (tex) return;

    // helper to request the static texture (fallback)
    const requestStatic = () => {
      const sKey = staticKey({ shape, tileSize: TILE, dpr, alpha: alphaUse, bucketId, variant });
      const existing = textureRegistry.get(sKey);
      if (existing) { setIfAlive(existing); return; }
      textureRegistry.ensure({ key: sKey, drawer, ...common, prio: 0 });
      off = textureRegistry.onReady((readyKey, readyTex) => {
        if (readyKey === sKey) setIfAlive(readyTex);
      });
    };

    // particle path with fallback + watchdog
    if (wantsFrozen) {
      const cached = particleCacheGet(key);
      if (cached) { setIfAlive(cached); return () => { /* no cleanup */ }; }

      // If poisoned, skip straight to static fallback
      if (FAILED_PARTICLE_KEYS.has(key)) {
        requestStatic();
        return () => { if (off) off(); };
      }

      if (!FROZEN_INFLIGHT.has(key)) {
        FROZEN_INFLIGHT.add(key);

        enqueueTexture(() => {
          try {
            const { texture } = makeFrozenTextureFromDrawer({
              ...common,
              simulateMs,
              stepMs: particleStepMs,
              generateMipmaps: true,
              anisotropy: 1,
              minFilter: THREE.LinearMipmapLinearFilter,
              magFilter: THREE.LinearFilter,
            });
            particleCacheSet(key, track(texture));
            setIfAlive(texture);
          } catch (err) {
            FAILED_PARTICLE_KEYS.add(key);
            if ((window as any).__GP_LOG_LOAD_ERRORS) {
              console.warn('[SPRITE:FROZEN] build failed (runtime)', key, err);
            }
            requestStatic();
          } finally {
            FROZEN_INFLIGHT.delete(key);
          }
        }, 0);
      }

      // watchdog: if the particle job stalls silently, fall back to static
      watchdog = setTimeout(() => {
        if (!cancelled && !particleCacheGet(key) && !textureRegistry.get(key)) {
          requestStatic();
        }
      }, 1000);

      return () => {
        cancelled = true;
        if (off) off();
        if (watchdog) clearTimeout(watchdog);
      };
    }

    // static path
    const existing = textureRegistry.get(key);
    if (existing) { setIfAlive(existing); return; }
    textureRegistry.ensure({ key, drawer, ...common, prio: 0 });
    off = textureRegistry.onReady((readyKey, readyTex) => {
      if (readyKey === key) setIfAlive(readyTex);
    });

    return () => { cancelled = true; if (off) off(); };
  }, [
    key, tex, wantsFrozen, shape, alphaUse, bucketAvg,
    vs.blend, vs.rgb, TILE, dpr, simulateMs, particleStepMs,
    variant, bucketId
  ]);

  if (!tex) return null;

  const shapeScaleK = VISUAL_SCALE[shape] ?? 1;
  const finalScale = (scale ?? 1) * shapeScaleK;

  const iw = (tex.image as HTMLCanvasElement | HTMLImageElement | undefined)?.width ?? 1;
  const ih = (tex.image as HTMLCanvasElement | HTMLImageElement | undefined)?.height ?? 1;
  const maxSide = Math.max(iw, ih) || 1;
  const sx = finalScale * (iw / maxSide);
  const sy = finalScale * (ih / maxSide);

  const biasY = ANCHOR_BIAS_Y[shape] ?? 0;
  const pos = Array.isArray(position)
    ? ([...position] as [number, number, number])
    : [0, 0, 0];
  pos[1] += sy * biasY;

  return (
    <sprite position={pos as any} scale={[sx, sy, 1]} renderOrder={5}>
      <spriteMaterial
        map={tex}
        transparent
        depthWrite={false}
        depthTest={false}
        opacity={opacity}
        toneMapped={false}
        color="white"
      />
    </sprite>
  );
}
