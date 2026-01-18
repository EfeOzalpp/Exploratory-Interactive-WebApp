// src/canvas-engine/runtime/engine/loop.ts

import type { PLike } from "../p/makeP.ts";
import { normalizeDprTransform, reassertDprTransformIfMutated } from "../util/transform.ts";

import type { SceneMode } from "../../adjustable-rules/sceneRuleSets.ts";
import type { CanvasPaddingSpec } from "../../adjustable-rules/canvasPadding.ts";

import { getPaddingSpecForState } from "../layout/padding.ts";
import { computeGridCached, type GridCacheState } from "../layout/gridCache.ts";

import { drawBackground } from "../render/background.ts";
import { drawGridOverlay } from "../render/gridOverlay.ts";
import { getGradientRGB, type PaletteCache } from "../render/palette.ts";
import { drawGhosts, type Ghost } from "../render/ghosts.ts";
import { drawItems, type LiveState } from "../render/items.ts";

import { drawItemFromRegistry } from "../shapes/draw.ts";
import type { ShapeRegistry } from "../shapes/registry.ts";

import type { EngineFieldItem } from "../types.ts";
import type { DebugFlags } from "../debug/flags.ts";

export type LoopDeps = {
  p: PLike;

  // state
  field: { items: EngineFieldItem[]; visible: boolean };
  hero: { x: number | null; y: number | null; visible: boolean };

  style: {
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

  inputs: { liveAvg: number };

  // policy getters (so loop doesn't own policy vars)
  getSceneMode: () => SceneMode;
  getPaddingSpecOverride: () => CanvasPaddingSpec | null;

  // caches
  gridCache: GridCacheState;
  paletteCache: PaletteCache;

  // lifecycle state
  liveStates: Map<string, LiveState>;
  ghostsRef: { current: Ghost[] };

  // shapes
  shapeRegistry: ShapeRegistry;

  // ordering
  Z: Record<string, number>;

  // identity/lifecycle
  shapeKeyOfItem: (it: EngineFieldItem) => string;
};

export function startEngineLoop(deps: LoopDeps) {
  const {
    p,
    field,
    hero,
    style,
    inputs,
    getSceneMode,
    getPaddingSpecOverride,
    gridCache,
    paletteCache,
    liveStates,
    ghostsRef,
    shapeRegistry,
    Z,
    shapeKeyOfItem,
  } = deps;

  let running = true;
  let rafId: number | null = null;

  function renderOneSandboxed(it: EngineFieldItem, rEff: number, sharedOpts: any, rootAppearK: number) {
    p.push();
    try {
      const opts2 = {
        ...sharedOpts,
        rootAppearK,
        usedRows: gridCache.usedRows,
      };
      drawItemFromRegistry(shapeRegistry, p, it, rEff, opts2);
    } finally {
      p.pop();
      reassertDprTransformIfMutated(p);
    }
  }

  function frame(now: number) {
    if (!running) return;

    p.__tick(now);

    normalizeDprTransform(p);
    drawBackground(p);

    const spec = getPaddingSpecForState(p.width, getSceneMode(), getPaddingSpecOverride());
    const grid = computeGridCached(gridCache, p, spec);

    drawGridOverlay(
      p,
      {
        cellW: grid.cellW,
        cellH: grid.cellH,
        ox: grid.ox,
        oy: grid.oy,
        rows: grid.rows,
        cols: grid.cols,
        usedRows: grid.usedRows,
      },
      spec,
      {
        enabled: !!style.debug.grid,
        gridAlpha: style.debug.gridAlpha ?? 0.35,
        forbiddenAlpha: style.debug.forbiddenAlpha ?? 0.25,
      }
    );

    const tMs = p.millis();
    const tSec = tMs / 1000;
    const bpm = 120;
    const beatPhase = ((tSec * bpm) / 60) % 1;
    const transport = { tSec, bpm, beatPhase };

    const signal1 = inputs.liveAvg;

    const gradientRGB = getGradientRGB({
      liveAvg: signal1,
      override: style.gradientRGBOverride,
      cache: paletteCache,
    });

    const baseShared = {
      cell: grid.cell,
      gradientRGB,
      blend: style.blend,
      liveAvg: signal1,
      alpha: 235,
      timeMs: tMs,
      exposure: style.exposure,
      contrast: style.contrast,
      transport,
    };

    ghostsRef.current = drawGhosts({
      p,
      nowMs: tMs,
      ghosts: ghostsRef.current,
      exitMs: style.exitMs,
      baseShared,
      perShapeScale: style.perShapeScale,
      baseR: style.r,
      renderOne: (it, rEff, shared, rootAppearK) => renderOneSandboxed(it, rEff, shared, rootAppearK),
    });

    drawItems({
      items: field.items,
      visible: field.visible, // <- use actual field visibility
      nowMs: tMs,
      appearMs: style.appearMs,
      Z,
      liveStates,
      perShapeScale: style.perShapeScale,
      baseR: style.r,
      baseShared,
      shapeKeyOfItem,
      renderOne: (it, rEff, shared, rootAppearK) => renderOneSandboxed(it, rEff, shared, rootAppearK),
      onGhost: (g) => ghostsRef.current.push(g),
    });

    if (hero.visible && hero.x != null && hero.y != null) {
      p.fill(255, 0, 0, 255);
      p.circle(hero.x, hero.y, style.r * 2);
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      if (rafId != null) {
        try {
          cancelAnimationFrame(rafId);
        } catch {}
      }
    },
  };
}
