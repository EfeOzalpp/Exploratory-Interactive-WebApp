// src/canvas/colorStops.ts
export type RGB = { r: number; g: number; b: number };
export type Stop = { stop: number; color: RGB };

/**
 * VIVID brand gradient (narrow yellow, deeper endpoints)
 */
export const BRAND_STOPS_VIVID: Stop[] = [
  { stop: 0.00, color: { r: 210, g:   0, b:  25 } },  // deeper, pure red
  { stop: 0.20, color: { r: 255, g:  90, b:   0 } },  // hot orange
  { stop: 0.46, color: { r: 255, g: 210, b:  40 } },  // golden yellow
  { stop: 0.52, color: { r: 255, g: 245, b: 120 } },  // sharp lemon peak
  { stop: 0.58, color: { r: 150, g: 235, b: 120 } },  // bright yellow-green
  { stop: 0.78, color: { r:   0, g: 175, b:  70 } },  // clean green
  { stop: 1.00, color: { r:   0, g: 120, b:  40 } },  // deep forest green
];
