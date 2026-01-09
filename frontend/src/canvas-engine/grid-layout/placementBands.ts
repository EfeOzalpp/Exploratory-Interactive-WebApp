// src/canvas-engine/grid-layout/placementBands.ts
import type { DeviceType } from '../shared/responsiveness.ts';
import type { ShapeName } from '../adjustable-rules/shapeCatalog.ts';
import {
  SHAPE_BANDS,
  SHAPE_BANDS_OVERLAY,
  SHAPE_BANDS_Q,
  type Band,
  type PickOpts,
} from '../adjustable-rules/placementRules.ts';

function clampBandToRows(topK: number, botK: number, usedRows: number, hCell = 1) {
  topK = Math.max(0, Math.min(1, topK));
  botK = Math.max(topK, Math.min(1, botK));

  let top = Math.floor(usedRows * topK);
  let bot = Math.floor(usedRows * botK);

  bot = Math.min(usedRows - hCell, bot);
  top = Math.max(0, Math.min(top, bot));

  return { top, bot };
}

function pickBand(shape: ShapeName | undefined, band: DeviceType, opts?: PickOpts): Band {
  const s = (shape ?? 'clouds') as ShapeName;
  const base = SHAPE_BANDS[band];

  if (opts?.overlay) {
    const o = SHAPE_BANDS_OVERLAY[band]?.[s];
    if (o) return o;
  }

  if (opts?.questionnaire) {
    const q = SHAPE_BANDS_Q[band]?.[s];
    if (q) return q;
  }

  return base[s] ?? (s === 'clouds' || s === 'snow' || s === 'sun' ? base['clouds'] : base['house']);
}

export const PlacementBands = {
  band(shape: ShapeName | undefined, usedRows: number, band: DeviceType, hCell = 1, opts?: PickOpts) {
    const { topK, botK } = pickBand(shape, band, opts);
    return clampBandToRows(topK, botK, usedRows, hCell); // returns { top, bot }
  },
};