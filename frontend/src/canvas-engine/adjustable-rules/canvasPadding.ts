// src/canvas-engine/adjustable-rules/canvasPadding.ts

import { makeRowForbidden } from '../grid-layout/forbidden.ts';
import type { DeviceType } from '../shared/responsiveness.ts';

export type CanvasPaddingSpec = {
  rows: number;
  useTopRatio?: number;
  forbidden?: (r: number, c: number, rows: number, cols: number) => boolean;
};

export type CanvasPaddingMode = 'start' | 'questionnaire' | 'overlay';

const CENTER_100 = { center: '100%' } as const;
const LR_0 = { left: '0%', right: '0%' } as const;

// Enter a new section for a new canvas padding rule
export const CANVAS_PADDING: Record<CanvasPaddingMode, Record<DeviceType, CanvasPaddingSpec>> = {
  start: {
    mobile: {
      rows: 18,
      useTopRatio: 0.9,
      forbidden: makeRowForbidden([
        LR_0, LR_0, LR_0, LR_0, LR_0, LR_0, LR_0, LR_0,
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
      ]),
    },
    tablet: {
      rows: 17,
      useTopRatio: 0.8,
      forbidden: makeRowForbidden([
        CENTER_100, CENTER_100,
        { left: '2%', right: '2%' }, { left: '2%', right: '2%' },
        { left: '2%', right: '2%' }, { left: '2%', right: '2%' },
        { left: '2%', right: '2%' }, { left: '2%', right: '2%' },
        { left: '2%', right: '2%' }, { left: '2%', right: '2%' },
        { left: '2%', right: '2%' },
        CENTER_100, CENTER_100, CENTER_100, CENTER_100, CENTER_100,
      ]),
    },
    laptop: {
      rows: 14,
      useTopRatio: 0.8,
      forbidden: makeRowForbidden([
        CENTER_100,
        { left: '28%', right: '30%' },
        { left: '14%', right: '22%' },
        { left: '10%', right: '20%' },
        { left: '8%', right: '15%' },
        { left: '8%', right: '15%' },
        { left: '8%', right: '15%', center: '30%' },
        { left: '6%', right: '12%', center: '50%' },
        CENTER_100, CENTER_100, CENTER_100, CENTER_100, CENTER_100,
      ]),
    },
  },

  questionnaire: {
    mobile: {
      rows: 20,
      useTopRatio: 1,
      forbidden: makeRowForbidden([
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
        CENTER_100,
        { left: '0%', right: '0%', center: '50%' },
        { left: '0%', right: '0%', center: '50%' },
        { left: '0%', right: '0%', center: '50%' },
        { left: '0%', right: '0%', center: '60%' },
        { left: '0%', right: '0%', center: '20%' },
        { left: '0%', right: '0%', center: '20%' },
        { left: '0%', right: '0%', center: '20%' },
        { left: '0%', right: '0%', center: '20%' },
        { left: '0%', right: '0%', center: '20%' },
        { left: '0%', right: '0%', center: '20%' },
      ]),
    },
    tablet: {
      rows: 22,
      useTopRatio: 1,
      forbidden: makeRowForbidden([
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
        CENTER_100, CENTER_100, CENTER_100, CENTER_100,
        CENTER_100, CENTER_100, CENTER_100,
        { left: '0%', right: '0%', center: '50%' },
        { left: '0%', right: '0%', center: '56%' },
        { left: '0%', right: '0%', center: '56%' },
        { left: '0%', right: '0%', center: '66%' },
        { left: '0%', right: '0%', center: '66%' },
        { left: '0%', right: '0%', center: '40%' },
        { left: '0%', right: '0%', center: '40%' },
        { left: '0%', right: '0%', center: '40%' },
        { left: '0%', right: '0%', center: '40%' },
      ]),
    },
    laptop: {
      rows: 13,
      useTopRatio: 0.85,
      forbidden: makeRowForbidden([
        CENTER_100, 
        { left: '5%', right: '5%' },
        { left: '5%', right: '5%' },
        { left: '5%', right: '5%' },
        { left: '5%', right: '5%' },
        { left: '5%', right: '5%', center: '40%' },
        { left: '5%', right: '15%', center: '50%' },
        { left: '5%', right: '15%', center: '50%' },
        { left: '5%', right: '5%', center: '60%' },
        { left: '5%', right: '5%', center: '65%' },
        { left: '5%', right: '5%', center: '65%' },
        { left: '5%', right: '5%', center: '65%' },
        CENTER_100, CENTER_100,
      ]),
    },
  },

  overlay: {
    mobile: {
      rows: 24,
      useTopRatio: 1,
      forbidden: makeRowForbidden(Array.from({ length: 21 }, () => LR_0)),
    },
    tablet: {
      rows: 22,
      useTopRatio: 1,
      forbidden: makeRowForbidden(Array.from({ length: 21 }, () => LR_0)),
    },
    laptop: {
      rows: 16,
      useTopRatio: 0.9,
      forbidden: makeRowForbidden(Array.from({ length: 21 }, () => LR_0)),
    },
  },
} as const;
