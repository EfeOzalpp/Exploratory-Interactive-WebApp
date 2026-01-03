// graph-runtime/sprites/selection/footprints.ts
import type { ShapeKey } from './types';

export const FOOTPRINTS: Record<ShapeKey, { w: number; h: number }> = {
  clouds: { w: 2, h: 3 },
  bus: { w: 2, h: 1 },
  snow: { w: 1, h: 3 },
  house:{ w: 1, h: 3 },
  power:{ w: 1, h: 3 },
  sun:  { w: 2, h: 2 },
  villa:{ w: 2, h: 2 },
  car:  { w: 1, h: 1 },
  sea:  { w: 2, h: 1 },
  carFactory: { w: 2, h: 2 },
  trees: { w: 1, h: 1 },
};

export const BLEED: Partial<Record<ShapeKey, { top?: number; right?: number; bottom?: number; left?: number }>> = {
  trees: { top: 0.75, left: 0.08, right: 0.08, bottom: 0.10 },
  clouds:{ top: 0.35, left: 0.18, right: 0.35, bottom: 0.35 },
  snow:  { top: 0.10, bottom: 0.10, left: 0.35, right: 0.35 },
  villa: { top: 0.08, bottom: 0.12, left: 0.08, right: 0.08 },
  house: { top: 0, bottom: 0, left: 0, right: 0 },
  power: { top: 0.08, bottom: 0.12, left: 0.5, right: 0.5 },
  carFactory: { top: 0.75, bottom: 0.12, left: 0.12, right: 0.12 },
  sea:   { top: 0.10, bottom: 0.10, left: 0.10, right: 0.10 },
  car:   { top: 0.16, bottom: 0.28, left: 0.36, right: 0.36 },
  bus:   { top: 0.06, bottom: 0.08, left: 0.10, right: 0.10 },
  sun:   { top: 2, bottom: 2, left: 2, right: 2 },
};

export const VISUAL_SCALE: Partial<Record<ShapeKey, number>> = { car: 0.86, snow: 1.18 };
export const ANCHOR_BIAS_Y: Partial<Record<ShapeKey, number>> = { car: -0.14 };

export const PARTICLE_SHAPES = new Set<ShapeKey>(['snow', 'clouds']);
