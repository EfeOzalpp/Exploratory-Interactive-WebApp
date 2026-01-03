// ─────────────────────────────────────────────────────────────
// src/components/dotGraph/colorboost.utils.ts
// Small math/color helpers used by DotGraph
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';

export function nonlinearLerp(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return a + (b - a) * (1 - Math.pow(1 - x, 5));
}

// Perceptual "pop": move a bit toward fully saturated, slightly darker version
export function boostColor(rgbHexOrCss: string): string {
  const c = new THREE.Color(rgbHexOrCss);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const target = new THREE.Color().setHSL(hsl.h, 1, Math.max(0, hsl.l * 0.9));
  const tt = 0.9 * (1 - hsl.s);
  c.lerp(target, tt);
  return `#${c.getHexString()}`;
}
