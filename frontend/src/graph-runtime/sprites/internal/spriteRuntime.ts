// graph-runtime/sprites/internal/spriteRuntime.ts
import * as THREE from 'three';

import { computeVisualStyle } from '../../../canvas-engine/modifiers/color-modifiers/avgToStyle.ts';

import type { ShapeKey } from '../selection/types.ts';
import { DRAWERS } from '../selection/drawers.ts';
import {
  FOOTPRINTS,
  BLEED,
  PARTICLE_SHAPES,
} from '../selection/footprints.ts';

import { makeFrozenTextureFromDrawer } from '../textures/animatedTexture.ts';
import { textureRegistry, type MakeArgs } from '../textures/registry.ts';
import { enqueueTexture } from '../textures/queue.ts';

import {
  frozenGet,
  frozenSet,
  frozenIsFailed,
  frozenMarkFailed,
  frozenBeginInflight,
  frozenEndInflight,
  frozenIsInflight,
  frozenClearAll,
  frozenSize,
} from '../cache/frozenRegistry.ts';

import {
  chooseShape,
  quantizeAvgWithDownshift,
  pickVariantSlot,
  makeStaticKey,
  makeFrozenKey,
  resolveDpr,
  DEFAULT_VARIANT_SLOTS,
} from './spritePolicy.ts';

/* texture tracking */
const __GLOBAL_TEX = new Set<THREE.CanvasTexture>();
function track(tex: THREE.CanvasTexture) {
  __GLOBAL_TEX.add(tex);
  return tex;
}

export function disposeAllSpriteTextures() {
  try {
    for (const t of __GLOBAL_TEX) {
      try { t.dispose(); } catch {}
    }
  } catch {}
  __GLOBAL_TEX.clear();

  try { frozenClearAll(); } catch {}
  try { (textureRegistry as any)?.clear?.(); } catch {}
}

export function hasSpriteTexture(key: string) {
  return !!(textureRegistry.get(key) || frozenGet(key));
}

export function makeSpriteKey(args: {
  avg: number;
  seed?: string | number;
  orderIndex?: number;
  tileSize: number;
  alpha: number;
  dpr?: number;
  freezeParticles: boolean;
  particleFrames: number;
  particleStepMs: number;
  variantSlots?: number;
  variantSeed?: string | number;
}) {
  const { bucketId } = quantizeAvgWithDownshift(args.avg);
  const shape = chooseShape({ avg: args.avg, seed: args.seed, orderIndex: args.orderIndex });

  const dpr = resolveDpr(args.dpr ?? 1);
  const simulateMs = Math.max(0, args.particleFrames * args.particleStepMs);

  const slots = Math.max(1, args.variantSlots ?? DEFAULT_VARIANT_SLOTS);
  const vSeed =
    args.variantSeed ??
    `${shape}|B${bucketId}|${args.seed ?? ''}|${args.orderIndex ?? 0}`;
  const variant = pickVariantSlot(String(vSeed), slots);

  const TILE = args.tileSize;

  return args.freezeParticles
    ? makeFrozenKey({
        shape,
        tileSize: TILE,
        dpr,
        alpha: args.alpha,
        simulateMs,
        stepMs: args.particleStepMs,
        bucketId,
        variant,
      })
    : makeStaticKey({
        shape,
        tileSize: TILE,
        dpr,
        alpha: args.alpha,
        bucketId,
        variant,
      });
}

export function prewarmSpriteTextures(
  items: Array<{ avg: number; orderIndex?: number; seed?: string | number }>,
  {
    tileSize = 256,
    alpha = 215,
    dpr = resolveDpr(1),
    particleStepMs = 33,
    particleFrames = 36,
    maxCount = 32,
  }: {
    tileSize?: number;
    alpha?: number;
    dpr?: number;
    particleStepMs?: number;
    particleFrames?: number;
    maxCount?: number;
  } = {}
) {
  const TILE = Math.min(tileSize, 128);
  const simulateMs = Math.max(0, particleFrames * particleStepMs);

  const seen = new Set<string>(); // (shape,bucketId,variant)
  const jobs: MakeArgs[] = [];
  const frozenJobs: Array<() => void> = [];

  const limited = items.slice(0, Math.max(1, maxCount));

  for (let i = 0; i < limited.length; i++) {
    const it = limited[i];
    const shape = chooseShape({ avg: it.avg, seed: it.seed, orderIndex: it.orderIndex });

    const { bucketId, bucketAvg } = quantizeAvgWithDownshift(it.avg);

    const variant = pickVariantSlot(
      `${shape}|B${bucketId}|${it.seed ?? ''}|${it.orderIndex ?? 0}`
    );
    const seenKey = `${shape}:${bucketId}:V${variant}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const drawer = DRAWERS[shape];
    if (!drawer) continue;

    const footprint = FOOTPRINTS[shape] ?? { w: 1, h: 1 };
    const bleed = BLEED[shape];

    const vs = computeVisualStyle(bucketAvg);
    const alphaUse = vs.alpha ?? alpha;

    if (PARTICLE_SHAPES.has(shape)) {
      const key = makeFrozenKey({
        shape,
        tileSize: TILE,
        dpr,
        alpha: alphaUse,
        simulateMs,
        stepMs: particleStepMs,
        bucketId,
        variant,
      });

      if (!frozenGet(key) && !frozenIsFailed(key) && !frozenIsInflight(key)) {
        frozenBeginInflight(key);

        frozenJobs.push(() => {
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
            frozenSet(key, track(texture));
          } catch (err) {
            frozenMarkFailed(key);
            if ((window as any).__GP_LOG_LOAD_ERRORS) {
              console.warn('[SPRITE:FROZEN] build failed (prewarm)', key, err);
            }

            const sKey = makeStaticKey({
              shape,
              tileSize: TILE,
              dpr,
              alpha: alphaUse,
              bucketId,
              variant,
            });
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
            frozenEndInflight(key);
          }
        });
      }
    } else {
      const key2 = makeStaticKey({
        shape,
        tileSize: TILE,
        dpr,
        alpha: alphaUse,
        bucketId,
        variant,
      });
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
  for (const run of frozenJobs) enqueueTexture(run, 1000);

  if (typeof window !== 'undefined') {
    (window as any).__GP_FROZEN_TEX = { size: frozenSize() };
  }
}

/* runtime request helpers used by the React component */
export function getStaticTexture(key: string) {
  return textureRegistry.get(key);
}

export function getFrozenTexture(key: string) {
  return frozenGet(key);
}

export function requestStaticTexture(args: MakeArgs, onReady: (tex: THREE.CanvasTexture) => void) {
  const existing = textureRegistry.get(args.key);
  if (existing) {
    onReady(existing);
    return () => {};
  }

  textureRegistry.ensure({ ...args, prio: args.prio ?? 0 });
  const off = textureRegistry.onReady((readyKey, readyTex) => {
    if (readyKey === args.key) onReady(readyTex);
  });

  return off;
}

export function requestFrozenTexture(args: {
  key: string;
  shape: ShapeKey;
  drawer: (p: any, x: number, y: number, r: number, opts?: any) => void;
  tileSize: number;
  dpr: number;
  alpha: number;
  bucketAvg: number;
  gradientRGB?: { r: number; g: number; b: number };
  blend: number;
  footprint: { w: number; h: number };
  bleed?: { top?: number; right?: number; bottom?: number; left?: number };
  seedKey: string;
  simulateMs: number;
  stepMs: number;
  onReady: (tex: THREE.CanvasTexture) => void;
  onFail: () => void;
}) {
  const cached = frozenGet(args.key);
  if (cached) {
    args.onReady(cached);
    return () => {};
  }

  if (frozenIsFailed(args.key)) {
    args.onFail();
    return () => {};
  }

  if (!frozenIsInflight(args.key) && frozenBeginInflight(args.key)) {
    enqueueTexture(() => {
      try {
        const { texture } = makeFrozenTextureFromDrawer({
          drawer: args.drawer,
          tileSize: args.tileSize,
          dpr: args.dpr,
          alpha: args.alpha,
          gradientRGB: args.gradientRGB,
          liveAvg: args.bucketAvg,
          blend: args.blend,
          footprint: args.footprint,
          bleed: args.bleed,
          seedKey: args.seedKey,
          simulateMs: args.simulateMs,
          stepMs: args.stepMs,
          generateMipmaps: true,
          anisotropy: 1,
          minFilter: THREE.LinearMipmapLinearFilter,
          magFilter: THREE.LinearFilter,
        });
        frozenSet(args.key, track(texture));
        args.onReady(texture);
      } catch (err) {
        frozenMarkFailed(args.key);
        if ((window as any).__GP_LOG_LOAD_ERRORS) {
          console.warn('[SPRITE:FROZEN] build failed (runtime)', args.key, err);
        }
        args.onFail();
      } finally {
        frozenEndInflight(args.key);
      }
    }, 0);
  }

  return () => {};
}
