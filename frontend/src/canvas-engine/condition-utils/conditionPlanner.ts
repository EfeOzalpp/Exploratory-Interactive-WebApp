// src/canvas/condition/conditionPlanner.ts
import type { ConditionKind, ShapeKind, ShapeName, Size, CurveSet } from './types.ts';
import { CONDITIONS, type ConditionSpec } from './conditions.ts';
import { hash32 } from '../shared/hash32.ts';

import {
  type Quota,
  type Limits,
  type Anchor,
  QUOTA_CURVES_DEFAULT,
  QUOTA_CURVES_OVERLAY,
} from './quotaCurves.ts';

export type PoolItem = { id: number; cond: ConditionKind };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function entries<V>(obj: Partial<Record<ShapeName, V>>): [ShapeName, V][] {
  return Object.entries(obj) as [ShapeName, V][];
}

type ResolvedLimits = Record<ShapeName, Quota>;

function allShapesFor(kind: ConditionKind): ShapeName[] {
  return (CONDITIONS[kind]?.variants ?? []).map((v) => v.shape);
}

function footprintFor(kind: ConditionKind, shape: ShapeName): Size {
  const spec = CONDITIONS[kind];
  const hit = spec?.variants.find((v) => v.shape === shape);
  if (!hit) throw new Error(`Unknown shape "${shape}" for kind "${kind}"`);
  return hit.footprint;
}

/**
 * Blends two limit maps at k in [0..1]. If either side is unbounded, the result is unbounded.
 */
function blendLimits(A: Limits, B: Limits, k: number): ResolvedLimits {
  const out: Partial<ResolvedLimits> = {};
  const keys = new Set<ShapeName>([
    ...(Object.keys(A) as ShapeName[]),
    ...(Object.keys(B) as ShapeName[]),
  ]);

  for (const key of keys) {
    const a = A[key];
    const b = B[key];
    if (a == null || b == null) out[key] = null;
    else out[key] = lerp(a, b, k);
  }

  return out as ResolvedLimits;
}

/**
 * Converts blended limits into integer caps and ensures every shape in the condition spec is present.
 */
function finalizeQuotas(kind: ConditionKind, q: ResolvedLimits): ResolvedLimits {
  const out: Partial<ResolvedLimits> = {};

  for (const [k, v] of entries(q)) {
    out[k] = v == null ? null : Math.max(0, Math.floor(v));
  }

  for (const sh of allShapesFor(kind)) {
    if (!(sh in out)) out[sh] = 0;
  }

  return out as ResolvedLimits;
}

function curveAnchorsFor(kind: ConditionKind, curveSet: CurveSet): Anchor[] {
  const map = curveSet === 'overlay' ? QUOTA_CURVES_OVERLAY : QUOTA_CURVES_DEFAULT;
  return map[kind] ?? [];
}

/**
 * Produces per-shape quotas for a condition kind at u in [0..1] by interpolating the curve anchors.
 */
function quotasFor(kind: ConditionKind, u: number, curveSet: CurveSet): ResolvedLimits {
  const anchors = curveAnchorsFor(kind, curveSet);
  if (!anchors.length) return finalizeQuotas(kind, {} as ResolvedLimits);

  const t = clamp01(u);

  let i = 0;
  while (i < anchors.length - 1 && t > anchors[i + 1].t) i++;

  const A = anchors[i];
  const B = anchors[Math.min(i + 1, anchors.length - 1)];

  if (A.t === B.t) {
    const merged: Partial<ResolvedLimits> = {};
    for (const [k, v] of entries(A.limits)) merged[k] = v;
    for (const [k, v] of entries(B.limits)) if (!(k in merged)) merged[k] = v;
    return finalizeQuotas(kind, merged as ResolvedLimits);
  }

  const kk = (t - A.t) / Math.max(1e-6, B.t - A.t);
  return finalizeQuotas(kind, blendLimits(A.limits, B.limits, kk));
}

type PlanEntry = { shape: ShapeName; size: Size };

function stableShuffleKey(id: number, salt: number) {
  return hash32('planForBucket', id, salt) >>> 0;
}

/**
 * Plans shape assignment for items of a single condition kind using quota curves and deterministic ordering.
 * Items are assigned by filling finite caps first, then falling back to the first unbounded fill shape.
 */
export function planForBucket(
  kind: ConditionKind,
  items: PoolItem[],
  u: number,
  salt = 0,
  curveSet: CurveSet = 'default'
): Map<number, PlanEntry> {
  const m = new Map<number, PlanEntry>();
  if (!items.length) return m;

  const sorted = [...items].sort((a, b) => {
    const ka = stableShuffleKey(a.id, salt);
    const kb = stableShuffleKey(b.id, salt);
    return ka - kb || a.id - b.id;
  });

  const raw = quotasFor(kind, u, curveSet);

  const finiteEntries = entries(raw).filter(([, v]) => v != null) as [
    ShapeName,
    number
  ][];
  const fillEntries = entries(raw).filter(([, v]) => v == null) as [
    ShapeName,
    null
  ][];

  const assignedCounts: Partial<Record<ShapeName, number>> = {};
  for (const [sh] of finiteEntries) assignedCounts[sh] = 0;

  const finiteOrder = finiteEntries.map(([sh]) => sh);

  const fillShapes = fillEntries.map(([sh]) => sh);
  let fillIdx = 0;

  for (const it of sorted) {
    let assigned: ShapeName | null = null;

    for (const sh of finiteOrder) {
      const cap = raw[sh] as number;
      const cur = assignedCounts[sh] ?? 0;
      if (cur < cap) {
        assignedCounts[sh] = cur + 1;
        assigned = sh;
        break;
      }
    }

    if (!assigned && fillShapes.length) {
      assigned = fillShapes[fillIdx % fillShapes.length];
      fillIdx += 1;
    }

    if (!assigned) {
      const spec: ConditionSpec | undefined = CONDITIONS[kind];
      assigned = (spec?.variants[0]?.shape ?? 'car') as ShapeName;
    }

    m.set(it.id, { shape: assigned, size: footprintFor(kind, assigned) });
  }

  return m;
}
