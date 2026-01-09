// src/canvas/scene-logic/types.ts

import type { DeviceType } from "../shared/responsiveness.ts";
import type { CanvasPaddingSpec } from "../adjustable-rules/canvasPadding.ts";
import type { Place } from "../grid-layout/occupancy.ts";
import type { QuotaCurvesByKind } from "../condition/conditionPlanner.ts";
import type {
  ConditionKind,
  ShapeName,
  Size,
} from "../condition/types.ts";
import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";

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
  // single source of truth (replaces questionnaireOpen + overlay)
  mode: SceneMode;
  quotaCurves: QuotaCurvesByKind; 
  allocAvg: number | undefined;
  viewportKey?: number | string;

  canvas: { w: number; h: number };

  pool: PoolItem[];
  salt?: number;
};

export type ComposeMeta = {
  device: DeviceType;

  // still great to keep in meta for debugging
  spec: CanvasPaddingSpec;

  rows: number;
  cols: number;
  cell: number;
  usedRows: number;

  // helpful for debugging too
  mode: SceneMode;
};

export type ComposeResult = {
  placed: PlacedItem[];
  nextPool: PoolItem[];
  meta: ComposeMeta;
};
