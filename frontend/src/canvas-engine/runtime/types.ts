// src/canvas-engine/runtime/types.ts

import type { SceneMode } from "../adjustable-rules/sceneRuleSets.ts";
import type { CanvasPaddingSpec } from "../adjustable-rules/canvasPadding.ts";
import type { EngineLayoutMode } from "./mount.ts";
import type { DprMode } from "./viewport.ts";
import type { CanvasBounds } from "../multi-canvas-setup/hostDefs.ts";

/**
 * Payload item consumed by the runtime renderer.
 * Keep this stable: it's part of the engine "API".
 */
export type EngineFieldItem = {
  id: string;
  x: number;
  y: number;
  shape: string;
  footprint?: any;
};

/**
 * Style payload for runtime rendering.
 * Intentionally permissive: runtime owns the canonical defaults/knobs.
 */
export type EngineFieldStyle = Record<string, any>;

export type EngineControls = {
  // inbound signals (values provided by outside of engine to drive movement on shapes)
  setInputs: (args?: { liveAvg?: number }) => void;

  // field payload
  setFieldItems: (nextItems?: EngineFieldItem[]) => void;
  setFieldStyle: (args?: EngineFieldStyle) => void;
  setFieldVisible: (v: boolean) => void;

  // mode/policy inputs to runtime (THIS is the modular part)
  setSceneMode: (mode: SceneMode) => void;

  /**
   * Optional escape hatch: if caller already resolved padding, runtime uses it.
   * If not set, runtime resolves from CANVAS_PADDING + sceneMode.
   */
  setPaddingSpec: (spec: CanvasPaddingSpec | null) => void;

  // visibility
  setHeroVisible: (v: boolean) => void;
  setVisible: (v: boolean) => void;

  stop: () => void;

  readonly canvas: HTMLCanvasElement | null;
};

export type StartCanvasEngineOpts = {
  mount?: string;
  onReady?: (controls: EngineControls) => void;
  dprMode?: DprMode;
  zIndex?: number;
  layout?: EngineLayoutMode;
  bounds?: CanvasBounds; 
};
