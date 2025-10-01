// src/canvas/grid/coords.ts
export function cellCenterToPx(cell: number, r: number, c: number) {
  return { x: c * cell + cell / 2, y: r * cell + cell / 2 };
}

export function cellRectToPx(cell: number, r0: number, c0: number, w: number, h: number) {
  return { x: c0 * cell, y: r0 * cell, w: w * cell, h: h * cell };
}
