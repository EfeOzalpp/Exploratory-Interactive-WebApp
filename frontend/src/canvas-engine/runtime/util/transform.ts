// src/canvas-engine/runtime/util/transform.ts

import type { PLike } from "../p/makeP.ts";

/**
 * At the start of a frame, normalize the canvas transform so drawing code
 * can assume logical pixels. (Your makeP stores dpr on canvas._dpr.)
 */
export function normalizeDprTransform(p: PLike) {
  const dpr = (p.canvas as any)?._dpr || 1;
  p.drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * After a shape draw, some draw code may have mutated the ctx transform directly.
 * This reasserts the expected DPR transform if it was changed.
 */
export function reassertDprTransformIfMutated(p: PLike) {
  const ctx = p.drawingContext;
  const dpr = (p.canvas as any)?._dpr || 1;
  const T = ctx.getTransform();

  if (
    T.a !== dpr ||
    T.d !== dpr ||
    T.b !== 0 ||
    T.c !== 0 ||
    T.e !== 0 ||
    T.f !== 0
  ) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
