// src/canvas-engine/adjustable-rules/resolveCanvasPadding.ts

import { deviceType, type DeviceType } from "../shared/responsiveness.ts";
import type { CanvasPaddingSpec } from "./canvasPadding.ts";

export function resolveCanvasPaddingSpec(
  w: number,
  paddingByDevice: Record<DeviceType, CanvasPaddingSpec>
): CanvasPaddingSpec {
  const band = deviceType(w);
  const spec = paddingByDevice[band];
  if (!spec) throw new Error(`Missing padding spec for band: ${band}. Keys: ${Object.keys(paddingByDevice).join(", ")}`);
  return spec;
}

