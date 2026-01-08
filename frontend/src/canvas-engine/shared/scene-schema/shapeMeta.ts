// src/canvas-engine/shared/scene-schema/shapeMeta.ts

import type { ShapeName } from './shapeCatalog.ts';

/**
 * Generic engine concepts:
 * - layer: coarse placement layer
 * - group: used for heuristics like separation, ranking, etc.
 * - separation: soft minimum distance (in cells) from other shapes in same group
 */
export type ShapeLayer = 'sky' | 'ground';
export type ShapeGroup = 'sky' | 'building' | 'vehicle' | 'nature';

export type ShapeMeta = {
  layer: ShapeLayer;
  group: ShapeGroup;
  separation?: number; // in cells; 0/undefined means "no spacing preference"
};

export const SHAPE_META: Record<ShapeName, ShapeMeta> = {
  // sky
  sun: { layer: 'sky', group: 'sky', separation: 6 },
  clouds: { layer: 'sky', group: 'sky', separation: 4 },
  snow: { layer: 'sky', group: 'sky', separation: 4 },

  // buildings
  house: { layer: 'ground', group: 'building', separation: 3 },
  villa: { layer: 'ground', group: 'building', separation: 3 },
  power: { layer: 'ground', group: 'building', separation: 3 },
  carFactory: { layer: 'ground', group: 'building', separation: 3 },

  // vehicles
  car: { layer: 'ground', group: 'vehicle', separation: 2 },
  bus: { layer: 'ground', group: 'vehicle', separation: 2 },

  // nature
  sea: { layer: 'ground', group: 'nature', separation: 0 },
  trees: { layer: 'ground', group: 'nature', separation: 1 },
};

export function layerOf(shape?: ShapeName): ShapeLayer {
  if (!shape) return 'ground';
  return SHAPE_META[shape]?.layer ?? 'ground';
}

export function groupOf(shape?: ShapeName): ShapeGroup {
  if (!shape) return 'nature';
  return SHAPE_META[shape]?.group ?? 'nature';
}

export function separationOf(shape?: ShapeName): number {
  if (!shape) return 0;
  return SHAPE_META[shape]?.separation ?? 0;
}
