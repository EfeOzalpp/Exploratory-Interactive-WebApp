// conditionPlanner.ts
import { ConditionKind, ConditionSpec, type ShapeKind } from './conditions.ts';

export type ShapeName = ShapeKind;
export type Size = { w: number; h: number };
export type PoolItem = { id: number; cond: 'A'|'B'|'C'|'D' };

/* ---------- defaults ---------- */
const DEFAULT_FOOTPRINTS: Record<ShapeName, Size> = {
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
  trees:    { w: 1, h: 1 },
};

function footprintFor(kind: 'A'|'B'|'C'|'D', shape: ShapeName): Size {
  const spec = CONDITIONS[kind];
  const hit = spec?.variants.find(v => v.shape === shape);
  if (hit?.footprint) return hit.footprint;
  const def = DEFAULT_FOOTPRINTS[shape];
  if (def) {
    if (typeof console !== 'undefined') {
      console.warn(`[planner] Using default footprint for "${shape}" in kind "${kind}"`);
    }
    return def;
  }
  throw new Error(`No footprint for "${shape}" in kind "${kind}"`);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Strongly-typed Object.entries for records keyed by ShapeName
function entries<V>(obj: Partial<Record<ShapeName, V>>): [ShapeName, V][] {
  return Object.entries(obj) as [ShapeName, V][];
}

/* ---------- quota curves by condition ---------- */
type QuotaValue = number | 'Infinity';
type Limits = Partial<Record<ShapeName, QuotaValue>>;
type ResolvedLimits = Record<ShapeName, QuotaValue>;
type Anchor = { t: number; limits: Limits };

function allShapesFor(kind: 'A'|'B'|'C'|'D'): ShapeName[] {
  return (CONDITIONS[kind]?.variants ?? []).map(v => v.shape);
}

const QUOTA_CURVES: Record<'A'|'B'|'C'|'D', Anchor[]> = {
  A: [
    { t: 0.0, limits: { sun: 1, bus: 0, clouds: 'Infinity' } },
    { t: 1.0, limits: { sun: 3, bus: 2, clouds: 'Infinity' } },
  ],
  B: [
    { t: 0.0, limits: { snow: 1, trees: 3, villa: 'Infinity' } },
    { t: 1.0, limits: { snow: 2, trees: 3, villa: 'Infinity' } },
  ],
  C: [
    { t: 0.0, limits: { power: 3, house: 'Infinity' } },
    { t: 1.0, limits: { power: 2, house: 'Infinity' } },
  ],
  D: [
    { t: 0.0, limits: { sea: 1, carFactory: 2, car: 'Infinity' } },
    { t: 1.0, limits: { sea: 1, carFactory: 1, car: 'Infinity' } },
  ],
};

/* ---------- blending & finalization ---------- */
// Blend two quota objects (numbers only; Infinity stays Infinity if present)
function blendLimits(A: Limits, B: Limits, k: number): ResolvedLimits {
  const out: Partial<ResolvedLimits> = {};
  const keys = new Set<ShapeName>([
    ...(Object.keys(A) as ShapeName[]),
    ...(Object.keys(B) as ShapeName[]),
  ]);
  for (const key of keys) {
    const a = A[key];
    const b = B[key];
    if (a === 'Infinity' && b === 'Infinity') {
      out[key] = 'Infinity';
    } else if (a === 'Infinity' || b === 'Infinity') {
      out[key] = 'Infinity';
    } else {
      const aNum = typeof a === 'number' ? a : 0;
      const bNum = typeof b === 'number' ? b : 0;
      out[key] = lerp(aNum, bNum, k);
    }
  }
  return out as ResolvedLimits;
}

// Turn possibly-float quotas into usable integers (round down), preserve Infinity
function finalizeQuotas(kind: 'A'|'B'|'C'|'D', q: ResolvedLimits): ResolvedLimits {
  const out: Partial<ResolvedLimits> = {};
  // copy what was provided
  for (const [k, v] of entries(q)) {
    out[k] = (v === 'Infinity') ? 'Infinity' : Math.max(0, Math.floor(v));
  }
  // ensure all shapes for this kind exist (default 0)
  for (const sh of allShapesFor(kind)) {
    if (!(sh in out)) out[sh] = 0;
  }
  return out as ResolvedLimits;
}

// Interpolate the curve for a given kind and u∈[0..1]
function quotasFor(kind: 'A'|'B'|'C'|'D', u: number): ResolvedLimits {
  const anchors = QUOTA_CURVES[kind] ?? [];
  if (!anchors.length) return finalizeQuotas(kind, {} as ResolvedLimits);

  const t = clamp01(u);
  let i = 0;
  while (i < anchors.length - 1 && t > anchors[i + 1].t) i++;
  const A = anchors[i];
  const B = anchors[Math.min(i + 1, anchors.length - 1)];

  if (A.t === B.t) {
    // Use the union of A and B, defaulting missing ones to 0
    const merged: Partial<ResolvedLimits> = {};
    for (const [k, v] of entries(A.limits)) merged[k] = v;
    for (const [k, v] of entries(B.limits)) if (!(k in merged)) merged[k] = v;
    return finalizeQuotas(kind, merged as ResolvedLimits);
  }

  const kk = (t - A.t) / (B.t - A.t);
  const blended = blendLimits(A.limits, B.limits, kk);
  return finalizeQuotas(kind, blended);
}

/* ---------- planner ---------- */
export function planForBucket(
  kind: 'A'|'B'|'C'|'D',
  items: PoolItem[],
  u: number,         // pass liveAvg here
  salt = 0
): Map<number, { shape: ShapeName; size: Size }> {
  const m = new Map<number, { shape: ShapeName; size: Size }>();
  if (!items.length) return m;

  // deterministic order
  const sorted = [...items].sort(
    (a, b) => (a.id - b.id) || (((a.id ^ salt) >>> 0) - ((b.id ^ salt) >>> 0))
  );

  // quotas at this u
  const raw = quotasFor(kind, u); // ResolvedLimits

  // split finite vs infinite (fillers)
  const finiteEntries = entries(raw).filter(([, v]) => v !== 'Infinity') as [ShapeName, number][];
  const fillEntries   = entries(raw).filter(([, v]) => v === 'Infinity') as [ShapeName, 'Infinity'][];

  // track finite caps usage
  const assignedCounts: Record<ShapeName, number> =
    Object.fromEntries(finiteEntries.map(([k]) => [k, 0])) as Record<ShapeName, number>;
  const finiteOrder = finiteEntries.map(([k]) => k);

  // prefer the first fill shape if multiple are marked Infinity
  const fillShape: ShapeName | null = fillEntries.length ? fillEntries[0][0] : null;

  for (const it of sorted) {
    let assigned: ShapeName | null = null;

    // try finite caps first (in declared order)
    for (const sh of finiteOrder) {
      const cap = raw[sh] as number; // safe: finiteEntries filtered
      if (assignedCounts[sh] < cap) {
        assignedCounts[sh]++;
        assigned = sh;
        break;
      }
    }

    // otherwise use filler
    if (!assigned && fillShape) {
      assigned = fillShape;
    }

    // last resort: fall back to first variant for this kind
    if (!assigned) {
      const spec = CONDITIONS[kind];
      assigned = (spec?.variants[0]?.shape ?? 'car') as ShapeName;
    }

    const size = footprintFor(kind, assigned);
    m.set(it.id, { shape: assigned, size });
  }

  return m;
}export const CONDITIONS: Record<ConditionKind, ConditionSpec> = {
  A: {
    variants: [
      { shape: 'clouds', footprint: { w: 2, h: 3 } },
      { shape: 'sun', footprint: { w: 2, h: 2 } },
      { shape: 'bus', footprint: { w: 2, h: 1 } },
    ],
  },
  B: {
    variants: [
      { shape: 'snow', footprint: { w: 1, h: 3 } },
      { shape: 'villa', footprint: { w: 2, h: 2 } },
      { shape: 'trees', footprint: { w: 1, h: 1 } },
    ],
  },
  C: {
    variants: [
      { shape: 'house', footprint: { w: 1, h: 3 } },
      { shape: 'power', footprint: { w: 1, h: 3 } },
    ],
  },
  D: {
    variants: [
      { shape: 'car', footprint: { w: 1, h: 1 } },
      { shape: 'sea', footprint: { w: 2, h: 1 } },
      { shape: 'carFactory', footprint: { w: 2, h: 2 } },
    ],
  },
};

