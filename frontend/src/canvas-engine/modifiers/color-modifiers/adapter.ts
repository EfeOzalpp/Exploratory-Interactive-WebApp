// canvas-engine/modifiers/color-modifiers/adapter.ts

import type { RGB } from "./types.ts";

/**
 * Convert a CSS color string into numeric RGB using the canvas engine's p-style context.
 * Expects `p` to provide: p.color(), p.red(), p.green(), p.blue().
 */
export function cssToRgbViaCanvas(p: any, css: string): RGB {
  const c = p.color(css);
  return { r: p.red(c), g: p.green(c), b: p.blue(c) };
}
