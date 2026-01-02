// src/canvas/condition-utils/conditions.ts
import { hash32 } from '../shared/hash32.ts';
import type { ConditionKind, ShapeKind, Size } from './types.ts';

export type Variant = {
  shape: ShapeKind;
  footprint: Size;
};

export type ConditionSpec = {
  variants: Variant[];
};

export const CONDITIONS: Record<ConditionKind, ConditionSpec> = {
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

/**
 * Deterministic variant picker by (kind, id, salt).
 * If a kind has exactly two variants, a single hash bit is used for stable 50/50 behavior.
 */
export function pickVariant(kind: ConditionKind, id: number, salt = 0): Variant {
  const spec = CONDITIONS[kind];
  const n = spec.variants.length;
  if (n === 0) throw new Error(`No variants for kind ${kind}`);

  const h = hash32(kind, id, salt);

  if (n === 2) return (h & 1) === 0 ? spec.variants[0] : spec.variants[1];
  return spec.variants[h % n];
}
