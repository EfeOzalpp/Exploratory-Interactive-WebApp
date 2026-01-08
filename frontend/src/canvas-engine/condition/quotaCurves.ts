// src/canvas-engine/condition/quotaCurves.ts

export type {
  CurveSet,
  Quota,
  Limits,
  QuotaAnchor,
  ConditionKind,
  ShapeName,
} from "./types.ts";

// Back-compat: the planner currently expects `Anchor`
export type Anchor = import("./types.ts").QuotaAnchor;

export {
  QUOTA_CURVES_DEFAULT,
  QUOTA_CURVES_OVERLAY,
} from "./specification.ts";
