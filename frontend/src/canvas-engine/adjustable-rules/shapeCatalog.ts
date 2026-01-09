// src/canvas-engine/adjustable-rules/catalog.ts

export const CONDITION_KINDS = ['A', 'B', 'C', 'D'] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

export const SHAPES = [
  'clouds',
  'snow',
  'house',
  'power',
  'sun',
  'villa',
  'car',
  'sea',
  'carFactory',
  'bus',
  'trees',
] as const;

export type ShapeName = (typeof SHAPES)[number];
export type ShapeKind = ShapeName;
