// src/canvas/layout/grid-layout/footprintUtils.ts

export type Anchor =
  | 'center'
  | 'top-left' | 'top' | 'top-right'
  | 'left'     |        'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

export type Footprint = { r0: number; c0: number; w: number; h: number };

export function rectFromFootprint(cell: number, f: Footprint) {
  const x = f.c0 * cell;
  const y = f.r0 * cell;
  const w = f.w * cell;
  const h = f.h * cell;
  return { x, y, w, h, cx: x + w * 0.5, cy: y + h * 0.5 };
}

export type PlaceOpts = {
  xyCanvas?: [number, number];

  rc?: [number, number];
  fracInCell?: [number, number];

  xyFrac?: [number, number];

  anchor?: Anchor;
  frac?: [number, number];

  px?: [number, number];
};

/**
 * Returns a pixel-space point within a footprint rectangle.
 * The selection supports multiple addressing modes (absolute, sub-cell, fractional, and anchor-based).
 */
export function pointInFootprint(
  cell: number,
  f: Footprint,
  opts: PlaceOpts = {}
) {
  const { x, y, w, h, cx, cy } = rectFromFootprint(cell, f);
  const px = opts.px ?? [0, 0];

  if (opts.xyCanvas) {
    return { x: opts.xyCanvas[0] + px[0], y: opts.xyCanvas[1] + px[1], w, h, cx, cy };
  }

  if (opts.rc) {
    const [rr, cc] = opts.rc;
    const rClamped = Math.max(0, Math.min(f.h - 1, rr));
    const cClamped = Math.max(0, Math.min(f.w - 1, cc));

    const subX = x + cClamped * cell;
    const subY = y + rClamped * cell;

    const fx = Math.max(0, Math.min(1, (opts.fracInCell?.[0] ?? 0.5)));
    const fy = Math.max(0, Math.min(1, (opts.fracInCell?.[1] ?? 0.5)));

    return {
      x: subX + fx * cell + px[0],
      y: subY + fy * cell + px[1],
      w, h, cx, cy,
    };
  }

  if (opts.xyFrac) {
    const fx = Math.max(0, Math.min(1, opts.xyFrac[0]));
    const fy = Math.max(0, Math.min(1, opts.xyFrac[1]));
    return { x: x + w * fx + px[0], y: y + h * fy + px[1], w, h, cx, cy };
  }

  const anchor = opts.anchor ?? 'center';
  let ax = cx, ay = cy;

  switch (anchor) {
    case 'top-left':     ax = x;     ay = y;     break;
    case 'top':          ax = cx;    ay = y;     break;
    case 'top-right':    ax = x + w; ay = y;     break;
    case 'left':         ax = x;     ay = cy;    break;
    case 'right':        ax = x + w; ay = cy;    break;
    case 'bottom-left':  ax = x;     ay = y + h; break;
    case 'bottom':       ax = cx;    ay = y + h; break;
    case 'bottom-right': ax = x + w; ay = y + h; break;
    case 'center':
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
