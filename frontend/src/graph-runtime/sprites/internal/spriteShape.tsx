// graph-runtime/sprites/api/spriteShape.tsx
import * as React from 'react';
import * as THREE from 'three';

import { computeVisualStyle } from "../../../canvas-engine/modifiers/color-modifiers/style.ts";

import type { ShapeKey } from '../selection/types.ts';
import { chooseShape, quantizeAvgWithDownshift, pickVariantSlot, makeStaticKey, makeFrozenKey, resolveDpr, DEFAULT_VARIANT_SLOTS } from '../internal/spritePolicy.ts';

import { DRAWERS } from '../selection/drawers.ts';
import { FOOTPRINTS, BLEED, VISUAL_SCALE, ANCHOR_BIAS_Y, PARTICLE_SHAPES } from '../selection/footprints.ts';

import { textureRegistry } from '../textures/registry.ts';

import {
  getStaticTexture,
  getFrozenTexture,
  requestStaticTexture,
  requestFrozenTexture,
} from '../internal/spriteRuntime.ts';

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

const __GLOBAL_TEX = new Set<THREE.CanvasTexture>();
function track(tex: THREE.CanvasTexture) {
  __GLOBAL_TEX.add(tex);
  return tex;
}

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
  variantSlots = DEFAULT_VARIANT_SLOTS,
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

  const shape: ShapeKey = React.useMemo(
    () => chooseShape({ avg: tShape, seed: seed ?? tShape, orderIndex }),
    [tShape, seed, orderIndex]
  );

  const TILE = Math.min(tileSize, 128);
  const dpr = resolveDpr(1);

  const wantsFrozen = !!(freezeParticles && PARTICLE_SHAPES.has(shape));
  const simulateMs = Math.max(0, particleFrames * particleStepMs);

  const vs = computeVisualStyle(bucketAvg);
  const alphaUse = vs.alpha ?? alpha;

  const variant = React.useMemo(() => {
    const vSeed = variantSeed ?? `${shape}|B${bucketId}|${seed ?? ''}|${orderIndex ?? 0}`;
    return pickVariantSlot(String(vSeed), Math.max(1, variantSlots));
  }, [shape, bucketId, seed, orderIndex, variantSeed, variantSlots]);

  const key = React.useMemo(() => {
    return wantsFrozen
      ? makeFrozenKey({
          shape,
          tileSize: TILE,
          dpr,
          alpha: alphaUse,
          simulateMs,
          stepMs: particleStepMs,
          bucketId,
          variant,
        })
      : makeStaticKey({
          shape,
          tileSize: TILE,
          dpr,
          alpha: alphaUse,
          bucketId,
          variant,
        });
  }, [wantsFrozen, shape, TILE, dpr, alphaUse, simulateMs, particleStepMs, bucketId, variant]);

  const [tex, setTex] = React.useState<THREE.CanvasTexture | null>(() => {
    return wantsFrozen ? (getFrozenTexture(key) || null) : (getStaticTexture(key) || null);
  });

  React.useEffect(() => {
    let cancelled = false;
    let off: (() => void) | undefined;
    let watchdog: any;

    const setIfAlive = (t: THREE.CanvasTexture | null) => {
      if (!cancelled && t) setTex(track(t));
    };

    const drawer = DRAWERS[shape];
    if (!drawer) return;

    if (tex) return;

    const footprint = FOOTPRINTS[shape] ?? { w: 1, h: 1 };
    const bleed = BLEED[shape];

    const common = {
      tileSize: TILE,
      dpr,
      alpha: alphaUse,
      liveAvg: bucketAvg,
      blend: (vs.blend ?? blend ?? 1.0),
      gradientRGB: vs.rgb,
      footprint,
      bleed,
      seedKey: `${key}|seed:${shape}|${variant}`,
    } as const;

    const requestStatic = () => {
      const sKey = makeStaticKey({
        shape,
        tileSize: TILE,
        dpr,
        alpha: alphaUse,
        bucketId,
        variant,
      });

      const existing = textureRegistry.get(sKey);
      if (existing) {
        setIfAlive(existing);
        return () => {};
      }

      off = requestStaticTexture(
        {
          key: sKey,
          drawer,
          tileSize: TILE,
          dpr,
          alpha: alphaUse,
          gradientRGB: vs.rgb,
          liveAvg: bucketAvg,
          blend: vs.blend ?? blend ?? 1.0,
          footprint,
          bleed,
          seedKey: `${sKey}|seed:${shape}|${variant}`,
          prio: 0,
        },
        (t) => setIfAlive(t)
      );

      return off;
    };

    if (wantsFrozen) {
      const cached = getFrozenTexture(key);
      if (cached) {
        setIfAlive(cached);
        return () => {};
      }

      off = requestFrozenTexture({
        key,
        shape,
        drawer,
        tileSize: TILE,
        dpr,
        alpha: alphaUse,
        bucketAvg,
        gradientRGB: vs.rgb,
        blend: (vs.blend ?? blend ?? 1.0),
        footprint,
        bleed,
        seedKey: common.seedKey,
        simulateMs,
        stepMs: particleStepMs,
        onReady: (t) => setIfAlive(t),
        onFail: () => { requestStatic(); },
      });

      watchdog = setTimeout(() => {
        if (!cancelled && !getFrozenTexture(key) && !textureRegistry.get(key)) {
          requestStatic();
        }
      }, 1000);

      return () => {
        cancelled = true;
        if (off) off();
        if (watchdog) clearTimeout(watchdog);
      };
    }

    off = requestStaticTexture(
      {
        key,
        drawer,
        tileSize: TILE,
        dpr,
        alpha: alphaUse,
        gradientRGB: vs.rgb,
        liveAvg: bucketAvg,
        blend: (vs.blend ?? blend ?? 1.0),
        footprint,
        bleed,
        seedKey: common.seedKey,
        prio: 0,
      },
      (t) => setIfAlive(t)
    );

    return () => {
      cancelled = true;
      if (off) off();
    };
  }, [
    key,
    tex,
    wantsFrozen,
    shape,
    TILE,
    dpr,
    alphaUse,
    bucketAvg,
    simulateMs,
    particleStepMs,
    variant,
    bucketId,
    blend,
    vs.blend,
    vs.rgb,
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
  const pos = Array.isArray(position) ? ([...position] as [number, number, number]) : [0, 0, 0];
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
