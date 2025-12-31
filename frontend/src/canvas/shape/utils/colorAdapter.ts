// src/canvas/shape/utils/colorAdapter.ts
// Small helper to convert a CSS color string into numeric RGB
// using the canvas engine's p-style drawing context.
import type { RGB } from '../../color/colorStops.ts';

export function cssToRgbViaCanvas(p: any, css: string): RGB {
  const c = p.color(css);
  return { r: p.red(c), g: p.green(c), b: p.blue(c) };
}
