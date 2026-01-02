// src/canvas/condition-utils/types.ts
export type ConditionKind = 'A' | 'B' | 'C' | 'D';

export type ShapeKind =
  | 'clouds'
  | 'snow'
  | 'house'
  | 'power'
  | 'sun'
  | 'villa'
  | 'car'
  | 'sea'
  | 'carFactory'
  | 'bus'
  | 'trees';

export type Size = { w: number; h: number };

export type ShapeName = ShapeKind;

export type CurveSet = 'default' | 'overlay';
