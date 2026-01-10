// src/canvas-engine/scene-logic/composeField.ts

import { deviceType } from "../shared/responsiveness.ts";

import { CANVAS_PADDING } from "../adjustable-rules/canvasPadding.ts";
import { resolveCanvasPaddingSpec } from "../adjustable-rules/resolveCanvasPadding.ts";

import { makeCenteredSquareGrid } from "../grid-layout/layoutCentered.ts";

import type { ComposeOpts, ComposeResult, PoolItem } from "./types.ts";
import { clamp01, usedRowsFromSpec } from "./math.ts";
import { placePoolItems } from "./place.ts";
import { retargetKindsStable, assignShapesByPlanner } from "./plan.ts";

export function composeField(opts: ComposeOpts): ComposeResult {
  const w = Math.round(opts.canvas.w);
  const h = Math.round(opts.canvas.h);

  const u = clamp01(opts.allocAvg);

  // mode is data (meta/debug + padding selection). No mode branching here.
  const mode = opts.mode;

  const device = deviceType(w);

  // padding selection stays here for now (can be moved into rule layer later)
  const spec = resolveCanvasPaddingSpec(w, CANVAS_PADDING, mode);

  const { cell, rows, cols } = makeCenteredSquareGrid({
    w,
    h,
    rows: spec.rows,
    useTopRatio: spec.useTopRatio ?? 1,
  });

  const usedRows = usedRowsFromSpec(rows, spec.useTopRatio);
  const meta = { device, mode, spec, rows, cols, cell, usedRows };

  if (!rows || !cols || !cell) {
    return { placed: [], nextPool: opts.pool.slice(), meta };
  }

  const salt =
    typeof opts.salt === "number"
      ? opts.salt
      : (rows * 73856093) ^ (cols * 19349663);

  const desiredSize = opts.pool.length;

  // reset volatile placement fields
  const pool: PoolItem[] = opts.pool.map((p) => ({
    ...p,
    shape: undefined,
    size: undefined,
    footprint: undefined,
    x: undefined,
    y: undefined,
  }));

  // planner assigns sizes/shapes based on policy (quotaCurves etc.)
  retargetKindsStable(pool, u, desiredSize);
  assignShapesByPlanner(pool, u, salt, opts.quotaCurves);

  // placement consumes resolved rule data (bands) + derived layout info
  const { placed, nextPool } = placePoolItems({
    device,
    pool,
    spec,
    rows,
    cols,
    cell,
    usedRows,
    salt,
    bands: opts.bands,
    shapeMeta: opts.shapeMeta,
  });

  return { placed, nextPool, meta };
}
