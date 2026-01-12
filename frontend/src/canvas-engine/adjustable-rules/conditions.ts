// src/canvas-engine/condition/conditions.ts

import type { ConditionKind, ShapeKind } from "./shapeCatalog.ts";
import { CONDITION_KINDS, SHAPES } from "./shapeCatalog.ts";

export { CONDITION_KINDS, SHAPES };
export type { ConditionKind };

export type Size = { w: number; h: number };

export type Variant = { shape: ShapeKind; footprint: Size };
export type ConditionSpec = { variants: Variant[] };

export const CONDITIONS: Record<ConditionKind, ConditionSpec> = {
  A: {
    variants: [
      { shape: "clouds", footprint: { w: 2, h: 3 } },
      { shape: "sun", footprint: { w: 2, h: 2 } },
      { shape: "bus", footprint: { w: 2, h: 1 } },
    ],
  },
  B: {
    variants: [
      { shape: "snow", footprint: { w: 1, h: 3 } },
      { shape: "villa", footprint: { w: 2, h: 2 } },
      { shape: "trees", footprint: { w: 1, h: 1 } },
    ],
  },
  C: {
    variants: [
      { shape: "house", footprint: { w: 1, h: 3 } },
      { shape: "power", footprint: { w: 1, h: 3 } },
    ],
  },
  D: {
    variants: [
      { shape: "car", footprint: { w: 1, h: 1 } },
      { shape: "sea", footprint: { w: 2, h: 1 } },
      { shape: "carFactory", footprint: { w: 2, h: 2 } },
    ],
  },
} as const;
