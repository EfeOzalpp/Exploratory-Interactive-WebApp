// src/canvas/condition/quotaCurves.ts
import type { ConditionKind, ShapeName } from './types.ts';

export type CurveSet = 'default' | 'overlay';

/**
 * Quota value:
 * - number: a finite cap for that shape
 * - null: unbounded "fill" candidate (used when finite caps are exhausted)
 */
export type Quota = number | null;

export type Limits = Partial<Record<ShapeName, Quota>>;

export type Anchor = { t: number; limits: Limits };

/**
 * Quota curves define per-condition caps for shape assignment as a function of u in [0..1].
 * A quota value of null means the shape is an unbounded fill candidate.
 */
export const QUOTA_CURVES_DEFAULT: Record<ConditionKind, Anchor[]> = {
  A: [
    { t: 0.0, limits: { sun: 1, bus: 0, clouds: null } },
    { t: 1.0, limits: { sun: 3, bus: 3, clouds: null } },
  ],
  B: [
    { t: 0.0, limits: { snow: 1, trees: 3, villa: null } },
    { t: 1.0, limits: { snow: 2, trees: 3, villa: null } },
  ],
  C: [
    { t: 0.0, limits: { power: 3, house: null } },
    { t: 1.0, limits: { power: 2, house: null } },
  ],
  D: [
    { t: 0.0, limits: { sea: 1, carFactory: 2, car: null } },
    { t: 1.0, limits: { sea: 1, carFactory: 1, car: null } },
  ],
};

/**
 * Overlay-tuned curves shift overall composition for a denser, more layered scene.
 */
export const QUOTA_CURVES_OVERLAY: Record<ConditionKind, Anchor[]> = {
  A: [
    { t: 0.0, limits: { sun: 4, clouds: 4, bus: null } },
    { t: 1.0, limits: { sun: 6, clouds: 7, bus: null } },
  ],
  B: [
    { t: 0.0, limits: { snow: 1, trees: 4, villa: null } },
    { t: 1.0, limits: { snow: 5, trees: 10, villa: null } },
  ],
  C: [
    { t: 0.0, limits: { power: 9, house: null } },
    { t: 1.0, limits: { power: 6, house: null } },
  ],
  D: [
    { t: 0.0, limits: { sea: 5, carFactory: 6, car: null } },
    { t: 1.0, limits: { sea: 8, carFactory: 3, car: null } },
  ],
};
