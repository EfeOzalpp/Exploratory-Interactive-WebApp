// src/canvas-engine/condition/specification.ts

import type { ConditionKind, ShapeKind, ShapeName } from './shapeCatalog.ts';
import { CONDITION_KINDS, SHAPES } from './shapeCatalog.ts';

export { CONDITION_KINDS };
export type { ConditionKind };

export { SHAPES };
export type { ShapeName, ShapeKind };

export type Size = { w: number; h: number };

export type Variant = { shape: ShapeKind; footprint: Size };
export type ConditionSpec = { variants: Variant[] };

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

// --- quotas (policy) ---
export type CurveSet = 'default' | 'overlay';

export type Quota = number | null;
export type Limits = Partial<Record<ShapeName, Quota>>;

export type QuotaAnchor = { t: number; limits: Limits };

export const QUOTA_CURVES_DEFAULT: Record<ConditionKind, QuotaAnchor[]> = {
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

export const QUOTA_CURVES_OVERLAY: Record<ConditionKind, QuotaAnchor[]> = {
  A: [
    { t: 0.0, limits: { sun: 4, clouds: null, bus: 5 } },
    { t: 1.0, limits: { sun: 6, clouds: null, bus: 9 } },
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
