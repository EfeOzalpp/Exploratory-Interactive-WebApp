// src/canvas-engine/runtime/layout/padding.ts

import { CANVAS_PADDING } from "../../adjustable-rules/canvasPadding.ts";
import type { CanvasPaddingSpec } from "../../adjustable-rules/canvasPadding.ts";
import type { SceneMode } from "../../adjustable-rules/sceneRuleSets.ts";
import { resolveCanvasPaddingSpec } from "../../adjustable-rules/resolveCanvasPadding.ts";

/**
 * Runtime padding policy.
 * - If override is set, use it.
 * - Otherwise resolve from CANVAS_PADDING for current mode.
 */
export function getPaddingSpecForState(
  widthPx: number,
  sceneMode: SceneMode,
  override: CanvasPaddingSpec | null
): CanvasPaddingSpec {
  if (override) return override;

  const byDevice = (CANVAS_PADDING as any)[sceneMode] as
    | typeof CANVAS_PADDING.start
    | undefined;

  if (!byDevice) {
    return resolveCanvasPaddingSpec(widthPx, CANVAS_PADDING.start);
  }

  return resolveCanvasPaddingSpec(widthPx, byDevice);
}
