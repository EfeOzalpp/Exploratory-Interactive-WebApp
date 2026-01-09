import type { DeviceType } from "../shared/responsiveness.ts";
import type { CanvasPaddingSpec } from "../adjustable-rules/canvasPadding.ts";
import type { ConditionKind } from "../condition/types.ts";
import type { QuotaAnchor } from "../adjustable-rules/quotaSpecification.ts";

export type SceneMode = "start" | "questionnaire" | "overlay";

export type ShapeMeta = {
  layer: "sky" | "ground";
  group: "sky" | "building" | "vehicle" | "nature";
  separation?: number;
};

export type PaddingPolicyByDevice = Record<DeviceType, CanvasPaddingSpec>;

export type BandsByDevice = Record<string, Record<string, unknown>>;

export type PoolSizesByMode = Record<SceneMode, Record<DeviceType, number>>;

export type QuotaCurvesByKind = Record<ConditionKind, QuotaAnchor[]>;

export type SceneProfile = {
  padding: PaddingPolicyByDevice; 
  bands: BandsByDevice;
  shapeMeta: Record<string, ShapeMeta>;

  // policy
  poolSizes: PoolSizesByMode;
  quotaCurves: QuotaCurvesByKind;
};
