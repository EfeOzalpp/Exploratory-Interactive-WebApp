// src/canvas-engine/adjustable-rules/resolveCanvasPadding.ts

import { deviceType } from "../shared/responsiveness.ts";
import type {
  CanvasPaddingBand,
  CanvasPaddingMode,
  CanvasPaddingSpec,
} from "./canvasPadding.ts";

export function resolveCanvasPaddingSpec(
  width: number,
  paddingByMode: Record<CanvasPaddingMode, Record<CanvasPaddingBand, CanvasPaddingSpec>>,
  mode: CanvasPaddingMode
): CanvasPaddingSpec {
  const band = deviceType(width);
  const table = paddingByMode[mode];
  if (!table) throw new Error(`Unknown padding mode: ${String(mode)}`);
  const spec = table[band];
  if (!spec) throw new Error(`Missing padding spec for band: ${String(band)} (mode: ${String(mode)})`);
  return spec;
}
