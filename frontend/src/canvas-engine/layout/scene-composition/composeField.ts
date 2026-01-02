// src/canvas/layout/scene-composition/composeField.ts
import { bandFromWidth, getGridSpec } from '../grid-layout/config.ts';
import { makeCenteredSquareGrid } from '../grid-layout/layoutCentered.ts';

import type { ComposeOpts, ComposeResult, PoolItem } from './types.ts';
import { clamp01, usedRowsFromSpec } from './math.ts';
import { placePoolItems } from './place.ts';
import { ensureAtLeastOneSunAtLowAvg } from './post.ts';
import { retargetKindsStable, assignShapesByPlanner } from './plan.ts';

import type { ConditionKind, CurveSet } from '../../condition-utils/types.ts';

export function composeField(opts: ComposeOpts): ComposeResult {
  const questionnaireOpen = !!opts.questionnaireOpen;
  const overlay = !!opts.overlay;

  const w = Math.round(opts.canvas.w);
  const h = Math.round(opts.canvas.h);

  const u = clamp01(opts.allocAvg);

  const band = bandFromWidth(w);
  const spec = getGridSpec(w, questionnaireOpen, { overlay });

  const { cell, rows, cols } = makeCenteredSquareGrid({
    w,
    h,
    rows: spec.rows,
    useTopRatio: spec.useTopRatio ?? 1,
  });

  const usedRows = usedRowsFromSpec(rows, spec.useTopRatio);

  const meta = { band, spec, rows, cols, cell, usedRows };

  if (!rows || !cols || !cell) {
    return { placed: [], nextPool: opts.pool.slice(), meta };
  }

  const curveSet: CurveSet = opts.curveSet ?? (overlay ? 'overlay' : 'default');

  const salt =
    typeof opts.salt === 'number' ? opts.salt : (rows * 73856093) ^ (cols * 19349663);

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
  assignShapesByPlanner(pool as any, u, salt, curveSet);

  const { placed, nextPool } = placePoolItems({
    pool,
    spec,
    band,
    rows,
    cols,
    cell,
    usedRows,
    salt,
    questionnaireOpen,
    overlay,
  });

  ensureAtLeastOneSunAtLowAvg(
    placed.map((p) => ({ shape: p.shape, footprint: p.footprint })),
    u,
    usedRows,
    band
  );

  return { placed, nextPool, meta };
}

export function makeDefaultPoolItem(id: number): PoolItem {
  return { id, cond: 'A' as ConditionKind };
}
