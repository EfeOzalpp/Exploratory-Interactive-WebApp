// src/canvas/layout/grid-layout/coords.ts

/**
 * Returns the pixel position for the center of a single 1x1 cell.
 */
export function cellCenterToPx(cell: number, r: number, c: number) {
  return {
    x: c * cell + cell / 2,
    y: r * cell + cell / 2,
  };
}

/**
 * Returns the pixel rectangle for an occupied block of grid cells, top-left anchored.
 */
export function cellRectToPx(
  cell: number,
  r0: number,
  c0: number,
  w: number,
  h: number
) {
  return {
    x: c0 * cell,
    y: r0 * cell,
    w: w * cell,
    h: h * cell,
  };
}

/**
 * Returns an anchor point in pixel space for a footprint rectangle.
 * This is useful when different shapes want top-left or center anchoring.
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

  return {
    x: rect.c0 * cell,
    y: rect.r0 * cell,
  };
}
