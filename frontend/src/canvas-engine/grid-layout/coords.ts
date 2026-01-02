// src/canvas/grid/coords.ts

/**
 * Return the pixel position for the CENTER of a single 1x1 cell.
 */
export function cellCenterToPx(cell: number, r: number, c: number) {
  return {
    x: c * cell + cell / 2,
    y: r * cell + cell / 2,
  };
}

/**
 * Return the pixel rect for an occupied block of grid cells.
 * Top-left anchored, NOT centered.
 */
export function cellRectToPx(cell: number, r0: number, c0: number, w: number, h: number) {
  return {
    x: c0 * cell,
    y: r0 * cell,
    w: w * cell,
    h: h * cell,
  };
}

/**
 * Generic anchor helper: pick either top-left or center.
 * - r0,c0,w,h is the footprint grid rect
 * - anchor: "topleft" (default) or "center"
 */
export function cellAnchorToPx(
  cell: number,
  rect: { r0: number; c0: number; w: number; h: number },
  anchor: 'topleft' | 'center' = 'topleft'
) {
  if (anchor === 'center') {
    return {
      x: rect.c0 * cell + (rect.w * cell) / 2,
      y: rect.r0 * cell + (rect.h * cell) / 2,
    };
  }
  // default: top-left
  return {
    x: rect.c0 * cell,
    y: rect.r0 * cell,
  };
}
