// src/canvas-engine/scene-logic/composeField.ts

import { deviceType } from "../shared/responsiveness.ts";

import { CANVAS_PADDING } from "../adjustable-rules/canvasPadding.ts";
import { resolveCanvasPaddingSpec } from "../adjustable-rules/resolveCanvasPadding.ts";

import { makeCenteredSquareGrid } from "../grid-layout/layoutCentered.ts";

import type { ComposeOpts, ComposeResult, PoolItem } from "./types.ts";
import { clamp01, usedRowsFromSpec } from "./math.ts";
import { placePoolItems } from "./place.ts";
import { ensureAtLeastOneSunAtLowAvg } from "./post.ts";
import { retargetKindsStable, assignShapesByPlanner } from "./plan.ts";

import type { ConditionKind, CurveSet } from "../condition/types.ts";
import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";

export function composeField(opts: ComposeOpts): ComposeResult {
  const w = Math.round(opts.canvas.w);
  const h = Math.round(opts.canvas.h);

  const u = clamp01(opts.allocAvg);

  const mode: SceneMode = opts.mode;
  const overlay = mode === "overlay";
  const questionnaireOpen = mode === "questionnaire";

  const device = deviceType(w);

  // single source of truth for padding selection
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

  const pool: PoolItem[] = opts.pool.map((p) => ({
    ...p,
    shape: undefined,
    size: undefined,
    footprint: undefined,
    x: undefined,
    y: undefined,
  }));

  retargetKindsStable(pool as any, u, desiredSize);
  assignShapesByPlanner(pool as any, u, salt, opts.quotaCurves);

  const { placed, nextPool } = placePoolItems({
    device,
    pool,
    spec,
    rows,
    cols,
    cell,
    usedRows,
    salt,

    // If place/post logic still expects booleans, compute them from mode here.
    questionnaireOpen,
    overlay,
  } as any);

  ensureAtLeastOneSunAtLowAvg(
    placed.map((p: any) => ({ shape: p.shape, footprint: p.footprint })),
    u,
    usedRows,
    device
  );

  return { placed, nextPool, meta };
}

export function makeDefaultPoolItem(id: number): PoolItem {
  return { id, cond: "A" as ConditionKind };
}
