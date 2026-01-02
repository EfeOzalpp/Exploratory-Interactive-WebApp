// src/canvas/layout/scene-composition/scoringSky.ts
import type { ShapeName } from '../../condition-utils/types.ts';
import { rand01Keyed } from '../../shared/hash32.ts';

export function isSky(shape?: ShapeName) {
  return shape === 'clouds' || shape === 'snow' || shape === 'sun';
}

export function scoreSkyCandidate(
  r0: number,
  c0: number,
  wCell: number,
  hCell: number,
  rows: number,
  cols: number,
  usedRows: number,
  placedSky: Array<{ r0: number; c0: number; w: number; h: number }>,
  salt: number,
  centerBias = true
) {
  const cx = c0 + wCell / 2;
  const cy = r0 + hCell / 2;

  const gridCx = (cols - 1) / 2;
  const usedCy = (usedRows - 1) / 2;

  const dCenter2 = (cx - gridCx) ** 2 + (cy - usedCy) ** 2;
  const centerPenalty = centerBias ? -0.12 * dCenter2 : 0;

  let minD2 = Infinity;
  for (const s of placedSky) {
    const sx = s.c0 + s.w / 2;
    const sy = s.r0 + s.h / 2;
    const dx = cx - sx;
    const dy = cy - sy;
    const d2 = dx * dx + dy * dy;
    if (d2 < minD2) minD2 = d2;
  }

  const spread = (placedSky.length ? Math.sqrt(minD2) : 0) * 1.2;
  const jitter = (rand01Keyed(`sky|${r0},${c0}|${salt}`) - 0.5) * 0.4;

  return spread + centerPenalty + jitter;
}
