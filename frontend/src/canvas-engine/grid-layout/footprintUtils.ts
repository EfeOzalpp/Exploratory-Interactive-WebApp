// src/canvas/grid/footprintUtils.ts
export type Anchor =
  | 'center'
  | 'top-left' | 'top' | 'top-right'
  | 'left'     |        'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

type Footprint = { r0: number; c0: number; w: number; h: number };

export function rectFromFootprint(cell: number, f: Footprint) {
  const x = f.c0 * cell;
  const y = f.r0 * cell;
  const w = f.w * cell;
  const h = f.h * cell;
  return { x, y, w, h, cx: x + w * 0.5, cy: y + h * 0.5 };
}

type PlaceOpts = {
  // 1) absolute canvas coords (highest priority)
  xyCanvas?: [number, number];

  // 2) pick a specific sub-cell inside the footprint (row/col offset)
  //    and then a local frac inside that 1×1 cell
  rc?: [number, number];                 // row, col inside the footprint
  fracInCell?: [number, number];         // 0..1 inside that sub-cell (default: center)

  // 3) fractional position across the whole footprint
  xyFrac?: [number, number];             // 0..1 across entire footprint

  // 4) anchor + slide (nice for “near bottom-right but nudged a bit”)
  anchor?: Anchor;                       // default 'center'
  frac?: [number, number];               // 0..1 slide across the whole rect (default [0.5,0.5])

  // extra pixel nudge (always applied last)
  px?: [number, number];
};

/** Returns a canvas-space point inside (or overriding) the footprint. */
export function pointInFootprint(cell: number, f: Footprint, opts: PlaceOpts = {}) {
  const { x, y, w, h, cx, cy } = rectFromFootprint(cell, f);
  const px = opts.px ?? [0, 0];

  // 1) absolute canvas coordinates override everything
  if (opts.xyCanvas) {
    return { x: opts.xyCanvas[0] + px[0], y: opts.xyCanvas[1] + px[1], w, h, cx, cy };
  }

  // 2) row/col sub-cell inside the footprint (like a local grid)
  if (opts.rc) {
    const [rr, cc] = opts.rc;
    // clamp rr/cc to the footprint grid
    const rClamped = Math.max(0, Math.min(f.h - 1, rr));
    const cClamped = Math.max(0, Math.min(f.w - 1, cc));

    const subX = x + cClamped * cell;
    const subY = y + rClamped * cell;
    const fx = Math.max(0, Math.min(1, (opts.fracInCell?.[0] ?? 0.5)));
    const fy = Math.max(0, Math.min(1, (opts.fracInCell?.[1] ?? 0.5)));
    return { x: subX + fx * cell + px[0], y: subY + fy * cell + px[1], w, h, cx, cy };
  }

  // 3) pure fractional across the entire footprint
  if (opts.xyFrac) {
    const fx = Math.max(0, Math.min(1, opts.xyFrac[0]));
    const fy = Math.max(0, Math.min(1, opts.xyFrac[1]));
    return { x: x + w * fx + px[0], y: y + h * fy + px[1], w, h, cx, cy };
  }

  // 4) anchor + slide (default)
  const anchor = opts.anchor ?? 'center';
  let ax = cx, ay = cy;
  switch (anchor) {
    case 'top-left':     ax = x;        ay = y;        break;
    case 'top':          ax = cx;       ay = y;        break;
    case 'top-right':    ax = x + w;    ay = y;        break;
    case 'left':         ax = x;        ay = cy;       break;
    case 'right':        ax = x + w;    ay = cy;       break;
    case 'bottom-left':  ax = x;        ay = y + h;    break;
    case 'bottom':       ax = cx;       ay = y + h;    break;
    case 'bottom-right': ax = x + w;    ay = y + h;    break;
    case 'center':
    default:             ax = cx;       ay = cy;       break;
  }

  const fxy = [
    Math.max(0, Math.min(1, (opts.frac?.[0] ?? 0.5))),
    Math.max(0, Math.min(1, (opts.frac?.[1] ?? 0.5))),
  ];
  const fxPos = x + w * fxy[0];
  const fyPos = y + h * fxy[1];

  // blend anchor with frac (50/50). If you want frac to fully override, return fxPos/fyPos.
  const bx = (ax + fxPos) * 0.5;
  const by = (ay + fyPos) * 0.5;

  return { x: bx + px[0], y: by + px[1], w, h, cx, cy };
}
