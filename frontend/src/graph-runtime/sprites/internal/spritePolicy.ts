// graph-runtime/sprites/internal/spritePolicy.ts
import { shapeForAvg, type ShapeKey } from '../selection/shapeForAvg.ts';

export const SPRITE_TINT_BUCKETS = 10;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/* avg bucketing */
const BIAS_GAMMA = 1.8;
function biasDown(t: number, gamma = BIAS_GAMMA) {
  return Math.pow(clamp01(t), Math.max(1, gamma));
}
function rawBucketIdFromAvg(avg: number) {
  const t = Number.isFinite(avg) ? avg : 0.5;
  const tb = biasDown(t);
  return Math.min(SPRITE_TINT_BUCKETS - 1, Math.floor(tb * SPRITE_TINT_BUCKETS));
}
const REMAP: number[] = [0, 0, 1, 1, 2, 3, 4, 6, 6, 6];
function adjustedBucketId(id: number) {
  return REMAP[Math.max(0, Math.min(9, id))];
}
function bucketMidpoint(id: number) {
  return (id + 0.5) / SPRITE_TINT_BUCKETS;
}

export function quantizeAvgWithDownshift(avg: number) {
  const base = rawBucketIdFromAvg(avg);
  const adj = adjustedBucketId(base);
  return { bucketId: adj, bucketAvg: bucketMidpoint(adj) };
}

/* variants */
export const DEFAULT_VARIANT_SLOTS = 3;

function hash01(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

export function pickVariantSlot(seedStr: string, slots = DEFAULT_VARIANT_SLOTS) {
  const s = Math.max(1, slots | 0);
  return Math.floor(hash01(seedStr) * s) % s;
}

/* key builders */
export function makeStaticKey(args: {
  shape: ShapeKey;
  tileSize: number;
  dpr: number;
  alpha: number;
  bucketId: number;
  variant: number;
}) {
  const { shape, tileSize, dpr, alpha, bucketId, variant } = args;
  return `SPRITE|${shape}|B${bucketId}|V${variant}|${tileSize}|${dpr}|${alpha}|STATIC_NATIVE`;
}

export function makeFrozenKey(args: {
  shape: ShapeKey;
  tileSize: number;
  dpr: number;
  alpha: number;
  simulateMs: number;
  stepMs: number;
  bucketId: number;
  variant: number;
}) {
  const { shape, tileSize, dpr, alpha, simulateMs, stepMs, bucketId, variant } = args;
  return `SPRITE|${shape}|B${bucketId}|V${variant}|${tileSize}|${dpr}|${alpha}|FROZEN_NATIVE_${Math.round(
    simulateMs
  )}_${Math.round(stepMs)}`;
}

export function chooseShape(args: { avg: number; seed?: string | number; orderIndex?: number }) {
  const t = clamp01(Number.isFinite(args.avg) ? args.avg : 0.5);
  return shapeForAvg(t, args.seed ?? t, args.orderIndex);
}

export function resolveDpr(fallback = 1) {
  return typeof window !== 'undefined'
    ? Math.min(1.5, window.devicePixelRatio || 1.5)
    : fallback;
}
