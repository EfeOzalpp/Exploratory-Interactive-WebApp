// src/canvas/shapeFootprints.ts
export type ShapeKind = 'circle' | 'triangle' | 'square' | 'octagon';

export type Footprint = { w: number; h: number };   // in grid cells

// You can add multiple options per shape (the i-th item will pick i%options)
export const SHAPE_FOOTPRINTS: Record<ShapeKind, Footprint[] | Footprint> = {
  circle:   { w: 1, h: 1 },
  triangle: { w: 1, h: 1 },
  square:   { w: 5, h: 5 },      // example variety
  octagon:  { w: 2, h: 2 },      // example variety
};
