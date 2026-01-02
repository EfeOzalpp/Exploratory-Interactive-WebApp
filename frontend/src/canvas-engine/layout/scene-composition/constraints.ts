// src/canvas/layout/scene-composition/constraints.ts
import type { GridSpec } from '../grid-layout/config.ts';
import { makeCellForbidden } from '../grid-layout/forbidden.ts';

/**
 * Combines grid spec forbidden rules into a single cell-level predicate.
 */
export function cellForbiddenFromSpec(spec: GridSpec, rows: number, cols: number) {
  return makeCellForbidden(spec, rows, cols);
}

/**
 * Checks whether a footprint rectangle is within bounds and contains no forbidden cells.
 */
export function footprintAllowed(
  r0: number,
  c0: number,
  w: number,
  h: number,
  rows: number,
  cols: number,
  isForbidden: (r: number, c: number) => boolean
) {
  if (r0 < 0 || c0 < 0 || r0 + h > rows || c0 + w > cols) return false;

  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      if (isForbidden(r0 + dr, c0 + dc)) return false;
    }
  }
  return true;
}

/**
 * Returns contiguous horizontal segments [cStart..cEnd] where a footprint can be placed on a row.
 * cEnd is inclusive and represents the footprint's left column.
 */
export function allowedSegmentsForRow(
  r0: number,
  wCell: number,
  hCell: number,
  rows: number,
  cols: number,
  isForbidden: (r: number, c: number) => boolean
): Array<{ cStart: number; cEnd: number }> {
  const segs: Array<{ cStart: number; cEnd: number }> = [];
  let c = 0;

  while (c <= cols - wCell) {
    while (
      c <= cols - wCell &&
      !footprintAllowed(r0, c, wCell, hCell, rows, cols, isForbidden)
    ) {
      c++;
    }
    if (c > cols - wCell) break;

    const cStart = c;

    while (
      c <= cols - wCell &&
      footprintAllowed(r0, c, wCell, hCell, rows, cols, isForbidden)
    ) {
      c++;
    }

    const cEnd = c - 1;
    segs.push({ cStart, cEnd });
  }

  return segs;
}
