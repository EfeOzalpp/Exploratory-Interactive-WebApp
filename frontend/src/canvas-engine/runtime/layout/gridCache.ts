// src/canvas-engine/runtime/layout/gridCache.ts

import type { PLike } from "../p/makeP.ts";
import type { CanvasPaddingSpec } from "../../adjustable-rules/canvasPadding.ts";
import { makeCenteredSquareGrid } from "../../grid-layout/layoutCentered.ts";

export type GridCacheState = {
  w: number;
  h: number;
  cell: number;
  cellW: number;
  cellH: number;
  ox: number;
  oy: number;
  rows: number;
  cols: number;
  usedRows: number;
  specKey: string | null;
};

export function createGridCache(): GridCacheState {
  return {
    w: 0,
    h: 0,
    cell: 0,
    cellW: 0,
    cellH: 0,
    ox: 0,
    oy: 0,
    rows: 0,
    cols: 0,
    usedRows: 0,
    specKey: null,
  };
}

export function invalidateGridCache(cache: GridCacheState) {
  cache.w = 0;
  cache.h = 0;
  cache.cell = 0;
  cache.specKey = null;
}

function specKeyOf(spec: CanvasPaddingSpec) {
  return `${spec.rows}|${spec.useTopRatio ?? 1}`;
}

export function computeGridCached(
  cache: GridCacheState,
  p: PLike,
  spec: CanvasPaddingSpec
): GridCacheState {
  const key = specKeyOf(spec);

  if (
    p.width === cache.w &&
    p.height === cache.h &&
    cache.specKey === key &&
    cache.cell > 0
  ) {
    return cache;
  }

  const { cell, cellW, cellH, ox, oy, rows, cols } = makeCenteredSquareGrid({
    w: p.width,
    h: p.height,
    rows: spec.rows,
    useTopRatio: spec.useTopRatio ?? 1,
    cols: 12, // keep your current forced cols behavior
  });

  const useTop = Math.max(0.01, Math.min(1, spec.useTopRatio ?? 1));
  const usedRows = Math.max(1, Math.round(rows * useTop));

  cache.w = p.width;
  cache.h = p.height;
  cache.cell = cell;
  cache.cellW = cellW;
  cache.cellH = cellH;
  cache.ox = ox;
  cache.oy = oy;
  cache.rows = rows;
  cache.cols = cols;
  cache.usedRows = usedRows;
  cache.specKey = key;

  return cache;
}
