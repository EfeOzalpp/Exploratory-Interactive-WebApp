// src/canvas-engine/adjustable-rules/poolSize.ts

import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";
import { deviceType, type DeviceType } from "../shared/responsiveness.ts";

/**
 * Pool sizing is a *policy knob* (good place for adjustable-rules).
 * Scene logic / hooks should call targetPoolSize({ mode, width }).
 */
export const POOL_SIZES: Record<SceneMode, Record<DeviceType, number>> = {
  start:         { small: 18, medium: 26, large: 28 },
  questionnaire: { small: 24, medium: 32, large: 28 },
  overlay:       { small: 60, medium: 80, large: 100 },
};

function deviceTypeOrDefault(width?: number): DeviceType {
  // Keep behavior consistent with your old widthBucket(undefined) => "lg"
  if (width == null) return "large";
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
