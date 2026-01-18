// src/canvas-engine/runtime/index.ts

import type { EngineControls, EngineFieldItem, StartCanvasEngineOpts } from "./types.ts";

import { registerEngineInstance, stopCanvasEngine, isCanvasRunning, stopAllCanvasEngines } from "./engine/registry.ts";
import { startEngineLoop } from "./engine/loop.ts";

import { ensureMount, applyCanvasStyle } from "./platform/mount.ts";
import { makeP, type PLike } from "./p/makeP.ts";

import { clamp01 } from "./util/easing.ts";

import type { SceneMode } from "../adjustable-rules/sceneRuleSets.ts";
import type { CanvasPaddingSpec } from "../adjustable-rules/canvasPadding.ts";

import { resolveBounds } from "./layout/bounds.ts";
import { createGridCache, invalidateGridCache } from "./layout/gridCache.ts";
import { installResizeHandlers } from "./platform/resize.ts";

import { createPaletteCache } from "./render/palette.ts";
import { type LiveState, defaultShapeKeyOfItem } from "./render/items.ts";

import { Z_INDEX } from "./shapes/zIndex.ts";
import { createDefaultShapeRegistry, type ShapeRegistry } from "./shapes/registry.ts";

import { BRAND_STOPS_VIVID } from "../modifiers/color-modifiers/stops.ts";
import { DEBUG_DEFAULT, type DebugFlags } from "./debug/flags.ts";

export type { EngineControls as CanvasEngineControls } from "./types.ts";

/**
 * STYLE = knobs/config that change rendering but are not "signals".
 * Signals like liveAvg go into inputs instead.
 *
 * Debug flags are nested under style.debug.
 */
const REG_STYLE_DEFAULT = {
  r: 11,
  perShapeScale: {} as Record<string, number>,
  gradientRGBOverride: null as null | { r: number; g: number; b: number },
  blend: 0.5,
  exposure: 1.0,
  contrast: 1.0,
  appearMs: 300,
  exitMs: 300,
  debug: { ...DEBUG_DEFAULT } as DebugFlags,
};

export function startCanvasEngine(opts: StartCanvasEngineOpts = {}): EngineControls {
  const { mount = "#canvas-root", onReady, dprMode = "fixed1", zIndex = 2, layout = "fixed" } = opts;

  const parentEl = ensureMount(mount, zIndex, layout);

  // style knobs/config (NOT signals)
  const style = { ...REG_STYLE_DEFAULT, debug: { ...REG_STYLE_DEFAULT.debug } };

  // inputs/signals
  const inputs = { liveAvg: 0.5 };

  const field = { items: [] as EngineFieldItem[], visible: false, epoch: 0 };
  const hero = { x: null as number | null, y: null as number | null, visible: false };

  let canvasEl: HTMLCanvasElement | null = null;
  let p: PLike | null = null;

  // runtime policy inputs
  let sceneMode: SceneMode = "start";
  let paddingSpecOverride: CanvasPaddingSpec | null = null;

  // live/ghost state storage (owned by runtime)
  const liveStates = new Map<string, LiveState>();

  // ───────────────────────────────────────────────────────────
  // init canvas + p facade
  // ───────────────────────────────────────────────────────────
  {
    const canvas = document.createElement("canvas");
    canvasEl = canvas;
    applyCanvasStyle(canvasEl);
    parentEl.appendChild(canvasEl);

    const ctx = canvasEl.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D canvas context not available");
    p = makeP(canvasEl, ctx);
  }

  // ───────────────────────────────────────────────────────────
  // layout + caches
  // ───────────────────────────────────────────────────────────
  const gridCache = createGridCache();
  const paletteCache = createPaletteCache(BRAND_STOPS_VIVID);

  const cleanupResize = installResizeHandlers({
    parentEl,
    canvasEl: canvasEl!,
    p: p!,
    dprMode,
    resizeTo: () => resolveBounds(parentEl, opts.bounds),
    onAfterResize: () => {
      invalidateGridCache(gridCache);
      if (p && hero.x == null) hero.x = Math.round(p.width * 0.5);
      if (p && hero.y == null) hero.y = Math.round(p.height * 0.3);
    },
  });

  // ───────────────────────────────────────────────────────────
  // shapes: registry (overrideable)
  // ───────────────────────────────────────────────────────────
  const shapeRegistry: ShapeRegistry = opts.shapeRegistry ?? createDefaultShapeRegistry();

  // ───────────────────────────────────────────────────────────
  // start loop
  // ───────────────────────────────────────────────────────────
  const ghostsRef = { current: [] as any[] }; // loop.ts will type this as Ghost[]; keep it strict there.

  const loop = startEngineLoop({
    p: p!,
    field,
    hero,
    style,
    inputs,
    getSceneMode: () => sceneMode,
    getPaddingSpecOverride: () => paddingSpecOverride,
    gridCache,
    paletteCache,
    liveStates,
    ghostsRef,
    shapeRegistry,
    Z: Z_INDEX,
    shapeKeyOfItem: defaultShapeKeyOfItem,
  });

  // ───────────────────────────────────────────────────────────
  // stop + global instance registry
  // ───────────────────────────────────────────────────────────

  let unregister: null | (() => void) = null;
  let didStop = false;

  function stop() {
    if (didStop) return;
    didStop = true;

    try {
      cleanupResize?.();
    } catch {}

    try {
      loop.stop();
    } catch {}

    try {
      canvasEl?.remove?.();
    } catch {}

    try {
      unregister?.();
    } catch {}
  }

  // ───────────────────────────────────────────────────────────
  // controls
  // ───────────────────────────────────────────────────────────

  function setInputs(args: any = {}) {
    if (typeof args.liveAvg === "number") inputs.liveAvg = clamp01(args.liveAvg);
  }

  function setFieldItems(nextItems: EngineFieldItem[] = []) {
    field.epoch++;
    field.items = Array.isArray(nextItems) ? nextItems : [];
  }

  function setFieldStyle(args: any = {}) {
    const { r, gradientRGBOverride, blend, perShapeScale, exposure, contrast, appearMs, exitMs } = args;

    if (Number.isFinite(r) && r > 0) style.r = r;

    if ("gradientRGBOverride" in args) {
      style.gradientRGBOverride = gradientRGBOverride ?? { r: 255, g: 255, b: 255 };
    }

    if (typeof blend === "number") style.blend = Math.max(0, Math.min(1, blend));
    if (typeof exposure === "number") style.exposure = Math.max(0.1, Math.min(3, exposure));
    if (typeof contrast === "number") style.contrast = Math.max(0.5, Math.min(2, contrast));

    if (perShapeScale && typeof perShapeScale === "object") {
      style.perShapeScale = { ...style.perShapeScale, ...perShapeScale };
    }

    if (Number.isFinite(appearMs) && appearMs >= 0) style.appearMs = appearMs | 0;
    if (Number.isFinite(exitMs) && exitMs >= 0) style.exitMs = exitMs | 0;

    if (args.debug && typeof args.debug === "object") {
  const d = args.debug as Partial<DebugFlags>;
  if (typeof d.grid === "boolean") style.debug.grid = d.grid;
  if (typeof d.gridAlpha === "number") style.debug.gridAlpha = Math.max(0, Math.min(1, d.gridAlpha));
  if (typeof d.forbiddenAlpha === "number")
    style.debug.forbiddenAlpha = Math.max(0, Math.min(1, d.forbiddenAlpha));
    }
  }

  function setDebug(next: Partial<DebugFlags>) {
    if (!next || typeof next !== "object") return;
    if (typeof next.grid === "boolean") style.debug.grid = next.grid;
    if (typeof next.gridAlpha === "number") style.debug.gridAlpha = Math.max(0, Math.min(1, next.gridAlpha));
    if (typeof next.forbiddenAlpha === "number")
      style.debug.forbiddenAlpha = Math.max(0, Math.min(1, next.forbiddenAlpha));
  }

  function setFieldVisible(v: boolean) {
    field.visible = !!v;
  }
  function setHeroVisible(v: boolean) {
    hero.visible = !!v;
  }
  function setVisibleCanvas(v: boolean) {
    if (canvasEl?.style) canvasEl.style.opacity = v ? "1" : "0";
  }

  function setSceneMode(next: SceneMode) {
    sceneMode = next;
    invalidateGridCache(gridCache);
  }

  function setPaddingSpec(spec: CanvasPaddingSpec | null) {
    paddingSpecOverride = spec ?? null;
    invalidateGridCache(gridCache);
  }

  const controls: EngineControls = {
    setInputs,
    setFieldItems,
    setFieldStyle,
    setFieldVisible,
    setHeroVisible,
    setVisible: setVisibleCanvas,
    setSceneMode,
    setPaddingSpec,
    stop,
    setDebug,
    get canvas() {
      return canvasEl;
    },
  };

  // Register this engine instance (stops any previous one for same mount/element)
  unregister = registerEngineInstance({
    mount,
    parentEl,
    stop,
  });

  onReady?.(controls);
  return controls;
}

// Build a p-like facade on an existing canvas (no animation / no DOM attach).
export function makePFromCanvas(canvas: HTMLCanvasElement, { dpr = 1 } = {}) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2D canvas context not available");
  const p = makeP(canvas, ctx);
  const cssW = canvas.style.width ? parseFloat(canvas.style.width) : canvas.width / dpr;
  const cssH = canvas.style.height ? parseFloat(canvas.style.height) : canvas.height / dpr;
  p.pixelDensity(Math.max(1, dpr || 1));
  p.resizeCanvas(cssW, cssH);
  return p;
}

export { stopCanvasEngine, isCanvasRunning, stopAllCanvasEngines };

export default startCanvasEngine;
