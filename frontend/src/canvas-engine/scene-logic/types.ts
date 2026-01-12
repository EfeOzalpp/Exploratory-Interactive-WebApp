// src/canvas-engine/scene-logic/types.ts

import type { DeviceType } from "../shared/responsiveness.ts";
import type { CanvasPaddingSpec } from "../adjustable-rules/canvasPadding.ts";
import type { Place } from "../grid-layout/occupancy.ts";
import type { QuotaCurvesByKind } from "../adjustable-rules/quotaSpecification.ts";
import type { ConditionKind, ShapeName, Size } from "../condition/domain.ts";
import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";
import type { ShapeBands } from "../adjustable-rules/placementRules.ts";
import type { ShapeMeta } from "../adjustable-rules/shapeMeta.ts"; 

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
  // keep mode for debugging/meta + padding selection
  mode: SceneMode;
  padding: Record<DeviceType, CanvasPaddingSpec>;

  // resolved rule data (NO mode branching needed in compose/placement)
  bands: ShapeBands;
  shapeMeta: Record<ShapeName, ShapeMeta>;

  quotaCurves: QuotaCurvesByKind;
  allocAvg: number | undefined;
  viewportKey?: number | string;

  canvas: { w: number; h: number };

  pool: PoolItem[];
  salt?: number;
};

export type ComposeMeta = {
  device: DeviceType;

  // keep spec in meta for debugging
  spec: CanvasPaddingSpec;

  rows: number;
  cols: number;
  cell: number;
  usedRows: number;

  mode: SceneMode;
};

export type ComposeResult = {
  placed: PlacedItem[];
  nextPool: PoolItem[];
  meta: ComposeMeta;
};
