// src/canvas-engine/scene-logic/poolSizes.ts

export type WidthBucket = 'sm' | 'md' | 'lg';

export const POOL_SIZES = {
  start: { sm: 18, md: 26, lg: 28 },
  questionnaire: { sm: 24, md: 32, lg: 28 },
  overlay: { sm: 60, md: 80, lg: 100 },
} as const;

export function widthBucket(width?: number): WidthBucket {
  if (width == null) return 'lg';
  if (width <= 768) return 'sm';
  if (width <= 1024) return 'md';
  return 'lg';
}
