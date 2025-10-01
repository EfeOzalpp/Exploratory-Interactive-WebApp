import type { RGB, Stop } from './colorStops';

export const clamp01 = (v: number | undefined) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpRGB = (c1: RGB, c2: RGB, t: number): RGB => ({
  r: Math.round(lerp(c1.r, c2.r, t)),
  g: Math.round(lerp(c1.g, c2.g, t)),
  b: Math.round(lerp(c1.b, c2.b, t)),
});

export function gradientColor(stops: Stop[], tRaw: number) {
  const t = clamp01(tRaw);
  if (!stops?.length) {
    const rgb = { r: 127, g: 127, b: 127 };
    return { rgb, css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, t };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i], s2 = stops[i + 1];
    if (t >= s1.stop && t <= s2.stop) {
      const lt = (t - s1.stop) / (s2.stop - s1.stop);
      const rgb = lerpRGB(s1.color, s2.color, lt);
      return { rgb, css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, t };
    }
  }

  const end = t <= stops[0].stop ? stops[0].color : stops[stops.length - 1].color;
  return { rgb: end, css: `rgb(${end.r}, ${end.g}, ${end.b})`, t };
}
