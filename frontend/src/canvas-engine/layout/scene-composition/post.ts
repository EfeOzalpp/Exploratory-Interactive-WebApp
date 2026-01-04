// src/canvas/layout/scene-composition/post.ts
import type { BreakBand } from '../grid-layout/config.ts';
import { bandFromWidth } from '../grid-layout/config.ts';
import { RowRules } from '../grid-layout/rowRules.ts';
import type { FootRect } from './types.ts';
import type { ShapeName } from '../../condition/types.ts';

export function ensureAtLeastOneSunAtLowAvg(
  items: Array<{ shape?: ShapeName; footprint: FootRect }>,
  u: number,
  usedRows: number,
  band: BreakBand
) {
  if (u > 0.02) return;
  if (items.some((it) => it.shape === 'sun')) return;

  const { rMin, rMax } = RowRules.skyBand('sun', usedRows, band);

  let idx = items.findIndex(
    (it) =>
      it.shape !== 'clouds' &&
      it.footprint.w === 1 &&
      it.footprint.h === 1 &&
      it.footprint.r0 >= rMin &&
      it.footprint.r0 <= rMax
  );

  if (idx === -1) {
    idx = items.findIndex(
      (it) =>
        it.footprint.w === 1 &&
        it.footprint.h === 1 &&
        it.footprint.r0 >= rMin &&
        it.footprint.r0 <= rMax
    );
  }

  if (idx === -1) {
    idx = items.findIndex(
      (it) =>
        it.shape !== 'clouds' && it.footprint.w === 1 && it.footprint.h === 1
    );
  }

  if (idx === -1) {
    idx = items.findIndex((it) => it.footprint.w === 1 && it.footprint.h === 1);
  }

  if (idx !== -1) {
    items[idx].shape = 'sun';
    items[idx].footprint = { ...items[idx].footprint, w: 1, h: 1 };
  }
}

export function bandFromCanvasWidth(w: number) {
  return bandFromWidth(w);
}
