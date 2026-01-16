// src/canvas/layout/grid-layout/footprintUtils.ts

import type { Anchor } from "../modifiers/shape-modifiers/shapeMods.types.ts";

export type CellSize = { cellW: number; cellH: number; ox?: number; oy?: number };

function o(v?: number) { return Number.isFinite(v) ? (v as number) : 0; }

export type Footprint = {
  r0: number; // row origin
  c0: number; // col origin
  w: number;  // width in cells
  h: number;  // height in cells
};

export type PlaceOpts = {
  // Pixel offset applied to the final point
  px?: [number, number];

  // Absolute canvas pixel position override (bypasses footprint positioning)
  xyCanvas?: [number, number];

  // Choose a specific sub-cell inside the footprint (row, col), clamped
  rc?: [number, number];

  // Position inside the chosen cell (0..1). Default 0.5, 0.5
  fracInCell?: [number, number];

  // Position inside the footprint rect (0..1)
  xyFrac?: [number, number];

  // Anchor in pixel-space
  anchor?: Anchor;

  // Additional blend fraction (0..1) used in your anchor+frac mixing logic
  frac?: [number, number];
};

export function rectFromFootprint2(size: CellSize, f: Footprint) {
  const ox = o(size.ox), oy = o(size.oy);
  const x = ox + f.c0 * size.cellW;
  const y = oy + f.r0 * size.cellH;
  const w = f.w * size.cellW;
  const h = f.h * size.cellH;
  return { x, y, w, h, cx: x + w * 0.5, cy: y + h * 0.5 };
}

export function pointInFootprint2(size: CellSize, f: Footprint, opts: PlaceOpts = {}) {
  const { x, y, w, h, cx, cy } = rectFromFootprint2(size, f);
  const px = opts.px ?? [0, 0];

  if (opts.xyCanvas) {
    return { x: opts.xyCanvas[0] + px[0], y: opts.xyCanvas[1] + px[1], w, h, cx, cy };
  }

  if (opts.rc) {
    const [rr, cc] = opts.rc;
    const rClamped = Math.max(0, Math.min(f.h - 1, rr));
    const cClamped = Math.max(0, Math.min(f.w - 1, cc));

    const subX = x + cClamped * size.cellW;
    const subY = y + rClamped * size.cellH;

    const fx = Math.max(0, Math.min(1, (opts.fracInCell?.[0] ?? 0.5)));
    const fy = Math.max(0, Math.min(1, (opts.fracInCell?.[1] ?? 0.5)));

    return {
      x: subX + fx * size.cellW + px[0],
      y: subY + fy * size.cellH + px[1],
      w, h, cx, cy,
    };
  }

  if (opts.xyFrac) {
    const fx = Math.max(0, Math.min(1, opts.xyFrac[0]));
    const fy = Math.max(0, Math.min(1, opts.xyFrac[1]));
    return { x: x + w * fx + px[0], y: y + h * fy + px[1], w, h, cx, cy };
  }

  // Anchor behavior stays the same conceptually; it operates in pixel-space.
  const anchor = opts.anchor ?? "center";
  let ax = cx, ay = cy;

  switch (anchor) {
    case "top-left":     ax = x;     ay = y;     break;
    case "top":          ax = cx;    ay = y;     break;
    case "top-right":    ax = x + w; ay = y;     break;
    case "left":         ax = x;     ay = cy;    break;
    case "right":        ax = x + w; ay = cy;    break;
    case "bottom-left":  ax = x;     ay = y + h; break;
    case "bottom":       ax = cx;    ay = y + h; break;
    case "bottom-right": ax = x + w; ay = y + h; break;
    case "center":
    default:             ax = cx;    ay = cy;    break;
  }

  const fxy: [number, number] = [
    Math.max(0, Math.min(1, (opts.frac?.[0] ?? 0.5))),
    Math.max(0, Math.min(1, (opts.frac?.[1] ?? 0.5))),
  ];

  const fxPos = x + w * fxy[0];
  const fyPos = y + h * fxy[1];

  const bx = (ax + fxPos) * 0.5;
  const by = (ay + fyPos) * 0.5;

  return { x: bx + px[0], y: by + px[1], w, h, cx, cy };
}

/* Legacy square API stays as-is below */
export function rectFromFootprint(cell: number, f: Footprint) { /* unchanged */ }
export function pointInFootprint(cell: number, f: Footprint, opts: PlaceOpts = {}) { /* unchanged */ }
