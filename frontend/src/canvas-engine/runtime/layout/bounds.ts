// src/canvas-engine/runtime/layout/bounds.ts

import type { CanvasBounds } from "../../multi-canvas-setup/hostDefs.ts";
import { getViewportSize } from "../platform/viewport.ts";

/**
 * Resolve canvas pixel size from bounds policy.
 */
export function resolveBounds(
  parentEl: HTMLElement,
  bounds?: CanvasBounds
): { w: number; h: number } {
  const b = bounds ?? { kind: "viewport" as const };

  if (b.kind === "fixed") return { w: b.w, h: b.h };

  if (b.kind === "parent") {
    const r = parentEl.getBoundingClientRect();
    return {
      w: Math.max(1, Math.round(r.width)),
      h: Math.max(1, Math.round(r.height)),
    };
  }

  return getViewportSize();
}
