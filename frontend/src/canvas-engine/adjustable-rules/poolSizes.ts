// src/canvas-engine/adjustable-rules/poolSizes.ts

import { deviceType, type DeviceType } from "../shared/responsiveness.ts";
import type { SceneMode } from "./sceneRuleSets.ts";

// types
// device-level (mode-resolved)
export type PoolSizes = Record<DeviceType, number>;

// mode-level table (ruleset-owned)
export type PoolSizesByMode = Record<SceneMode, PoolSizes>;

// policy
export const POOL_SIZES: PoolSizesByMode = {
  start:         { mobile: 18, tablet: 26, laptop: 28 },
  questionnaire: { mobile: 24, tablet: 32, laptop: 28 },
  overlay:       { mobile: 60, tablet: 80, laptop: 100 },
};

// helpers
function deviceTypeOrDefault(width?: number): DeviceType {
  if (width == null) return "laptop";
  return deviceType(width);
}

/**
 * Mode is already resolved by the ruleset
 */
export function targetPoolSize(
  poolSizes: PoolSizes,
  width?: number
): number {
  const dt = deviceTypeOrDefault(width);
  return poolSizes[dt];
}
