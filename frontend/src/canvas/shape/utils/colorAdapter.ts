// src/canvas/shape/utils/colorAdapter.ts
// Small helper to convert a CSS color string into numeric RGB via p5/q5 instance.
import type { RGB } from '../../color/colorStops.ts';

export function cssToRgbViaP5(p: any, css: string): RGB {
  const c = p.color(css);
  return { r: p.red(c), g: p.green(c), b: p.blue(c) };
}
