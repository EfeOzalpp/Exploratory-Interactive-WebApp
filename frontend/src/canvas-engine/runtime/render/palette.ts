// src/canvas-engine/runtime/render/palette.ts

import { Stop } from "../../modifiers/color-modifiers/stops.ts";
import { gradientColor, BRAND_STOPS_VIVID } from "../../modifiers/index.ts";

export type RGB = { r: number; g: number; b: number };

export type PaletteCache = {
  lastU: number;
  cachedGradient: RGB | null;
};

export function createPaletteCache(BRAND_STOPS_VIVID: Stop[]): PaletteCache {
  return { lastU: NaN, cachedGradient: null };
}

export function getGradientRGB(params: {
  liveAvg: number;
  override: RGB | null;
  cache: PaletteCache;
}): RGB | null {
  const { liveAvg, override, cache } = params;
  if (override) return override;

  const uq = Math.round(liveAvg * 1000) / 1000;
  if (uq !== cache.lastU) {
    cache.lastU = uq;
    cache.cachedGradient = gradientColor(BRAND_STOPS_VIVID, uq).rgb;
  }

  return cache.cachedGradient;
}
