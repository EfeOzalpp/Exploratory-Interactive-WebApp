// src/canvas-engine/scene-logic/post.ts

import type { DeviceType } from '../shared/utils/responsiveness.ts';
import { PlacementBands } from '../grid-layout/placementBands.ts';
import type { FootRect } from './types.ts';
import type { ShapeName } from '../condition/types.ts';

export function ensureAtLeastOneSunAtLowAvg(
  items: Array<{ shape?: ShapeName; footprint: FootRect }>,
  u: number,
  usedRows: number,
  device: DeviceType
) {
  if (u > 0.02) return;
  if (items.some((it) => it.shape === 'sun')) return;

  const { top: rMin, bot: rMax } = PlacementBands.band(
    'sun',
    usedRows,
    device,
    1
  );

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
      (it) => it.shape !== 'clouds' && it.footprint.w === 1 && it.footprint.h === 1
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
