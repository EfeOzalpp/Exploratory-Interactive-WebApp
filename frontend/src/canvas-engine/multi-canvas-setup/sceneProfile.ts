// src/canvas-engine/multi-canvas-setup/sceneProfile.ts

import type { DeviceType } from "../shared/responsiveness.ts";
import type { CanvasPaddingSpec } from "../adjustable-rules/canvasPadding.ts";
import type { ShapeBands } from "../adjustable-rules/placementRules.ts";
import type { ConditionKind } from "../condition/domain.ts";
import type { QuotaAnchor } from "../adjustable-rules/quotaSpecification.ts";

import type { PoolSizes } from "../adjustable-rules/poolSizes.ts";

// Shared
export type ShapeMeta = {
  layer: "sky" | "ground";
  group: "sky" | "building" | "vehicle" | "nature";
  separation?: number;
};

export type PaddingPolicyByDevice = Record<DeviceType, CanvasPaddingSpec>;
export type BandsByDevice = ShapeBands;
export type QuotaCurvesByKind = Record<ConditionKind, QuotaAnchor[]>;

// Profile
export type SceneProfile = {
  padding: PaddingPolicyByDevice;
  bands: BandsByDevice;
  shapeMeta: Record<string, ShapeMeta>;
  poolSizes: PoolSizes;
  quotaCurves: QuotaCurvesByKind;
};
