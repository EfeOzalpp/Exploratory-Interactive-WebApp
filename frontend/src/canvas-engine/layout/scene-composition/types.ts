// src/canvas/layout/scene-composition/types.ts
import type { BreakBand, GridSpec } from '../grid-layout/config.ts';
import type { Place } from '../grid-layout/occupancy.ts';
import type {
  ConditionKind,
  CurveSet,
  ShapeName,
  Size,
} from '../../condition/types.ts';

export type FootRect = Place;

export type PoolItem = {
  id: number;
  cond: ConditionKind;
  shape?: ShapeName;
  size?: Size;
  footprint?: FootRect;
  x?: number;
  y?: number;
};

export type PlacedItem = {
  id: number;
  x: number;
  y: number;
  shape?: ShapeName;
  footprint: FootRect;
};

export type ComposeOpts = {
  questionnaireOpen: boolean;
  overlay: boolean;
  allocAvg: number | undefined;
  viewportKey?: number | string;

  canvas: { w: number; h: number };

  pool: PoolItem[];

  curveSet?: CurveSet;

  salt?: number;
};

export type ComposeMeta = {
  band: BreakBand;
  spec: GridSpec;
  rows: number;
  cols: number;
  cell: number;
  usedRows: number;
};

export type ComposeResult = {
  placed: PlacedItem[];
  nextPool: PoolItem[];
  meta: ComposeMeta;
};
