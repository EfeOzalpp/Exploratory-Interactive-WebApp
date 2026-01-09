// src/canvas-engine/condition/types.ts

export type {
  // core catalog
  ConditionKind,
  ShapeName,
  ShapeKind,

  // condition spec
  Size,
  Variant,
  ConditionSpec,

  // quota planning
  CurveSet,
  Quota,
  Limits,
  QuotaAnchor,
  
} from "../adjustable-rules/quotaSpecification.ts";

export {
  // core catalog values
  CONDITION_KINDS,
  SHAPES,

  // condition definitions
  CONDITIONS,

  // quota curves
  QUOTA_CURVES_DEFAULT,
  QUOTA_CURVES_OVERLAY,
} from "../adjustable-rules/quotaSpecification.ts";
