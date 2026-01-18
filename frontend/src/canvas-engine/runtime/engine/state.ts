// src/canvas-engine/runtime/engine/state.ts
import type { PLike } from "../p/makeP.ts";
import type { EngineFieldItem } from "../types.ts";
import type { CanvasPaddingSpec } from "../../adjustable-rules/canvasPadding.ts";

import type { GridCacheState } from "../layout/gridCache.ts";
import type { LiveState } from "../render/items.ts";
import type { Ghost } from "../render/ghosts.ts";
import type { DebugFlags } from "../debug/flags.ts";

export type EngineStyle = {
  r: number;
  perShapeScale: Record<string, number>;
  gradientRGBOverride: null | { r: number; g: number; b: number };
  blend: number;
  exposure: number;
  contrast: number;
  appearMs: number;
  exitMs: number;
  debug: DebugFlags;
};

export type EngineInputs = { liveAvg: number };

export type EngineField = { items: EngineFieldItem[]; visible: boolean; epoch: number };
export type Hero = { x: number | null; y: number | null; visible: boolean };

export type EngineState = {
  p: PLike;
  canvasEl: HTMLCanvasElement;
  parentEl: HTMLElement;

  style: EngineStyle;
  inputs: EngineInputs;
  field: EngineField;
  hero: Hero;

  paddingSpecOverride: CanvasPaddingSpec | null;

  paletteCache: { lastU: number; gradientRGB: { r: number; g: number; b: number } | null };
  gridCache: GridCacheState;

  liveStates: Map<string, LiveState>;
  ghosts: Ghost[];
};
