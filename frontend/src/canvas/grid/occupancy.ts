// src/canvas/grid/occupancy.ts
export type Place = { r0: number; c0: number; w: number; h: number };

export function createOccupancy(rows: number, cols: number) {
  const used = new Array(rows * cols).fill(false);
  const idx = (r: number, c: number) => r * cols + c;

  function canPlace(r0: number, c0: number, w: number, h: number) {
    if (r0 < 0 || c0 < 0 || r0 + h > rows || c0 + w > cols) return false;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (used[idx(r0 + r, c0 + c)]) return false;
    }
    return true;
  }

  function mark(r0: number, c0: number, w: number, h: number) {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      used[idx(r0 + r, c0 + c)] = true;
    }
  }

  function tryPlaceAt(r0: number, c0: number, w: number, h: number): Place | null {
    if (!canPlace(r0, c0, w, h)) return null;
    mark(r0, c0, w, h);
    return { r0, c0, w, h };
  }

  return { canPlace, tryPlaceAt };
}
