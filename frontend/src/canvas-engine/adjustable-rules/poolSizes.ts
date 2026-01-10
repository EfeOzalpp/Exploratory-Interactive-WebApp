// src/canvas-engine/adjustable-rules/poolSize.ts

import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";
import { deviceType, type DeviceType } from "../shared/responsiveness.ts";

/**
 * Pool sizing is a *policy knob* (good place for adjustable-rules).
 * Scene logic / hooks should call targetPoolSize({ mode, width }).
 */
export const POOL_SIZES: Record<SceneMode, Record<DeviceType, number>> = {
  start:         { mobile: 18, tablet: 26, laptop: 28 },
  questionnaire: { mobile: 24, tablet: 32, laptop: 28 },
  overlay:       { mobile: 60, tablet: 80, laptop: 100 },
};

function deviceTypeOrDefault(width?: number): DeviceType {
  // Keep behavior consistent with your old widthBucket(undefined) => "lg"
  if (width == null) return "laptop";
  return deviceType(width);
}

/**
 * API: mode is the single authority.
 * (No extra booleans: overlay/questionnaireOpen should be derived from mode.)
 */
export function targetPoolSize(opts: { mode: SceneMode; width?: number }): number {
  const dt = deviceTypeOrDefault(opts.width);
  return POOL_SIZES[opts.mode][dt];
}
