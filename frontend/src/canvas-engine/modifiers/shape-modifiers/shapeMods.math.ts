// modifiers/shape-modifiers/shapeMods.math.ts
import { clamp01 } from "./useLerp.ts";
import type { Anchor } from "./shapeMods.types.ts";

export function applyAnchorShiftForScale(
  anchor: Anchor,
  dx: number,
  dy: number
): { offX: number; offY: number } {
  switch (anchor) {
    case "top":
      return { offX: 0, offY: dy / 2 };
    case "bottom":
      return { offX: 0, offY: -dy / 2 };
    case "left":
      return { offX: dx / 2, offY: 0 };
    case "right":
      return { offX: -dx / 2, offY: 0 };
    case "top-left":
      return { offX: dx / 2, offY: dy / 2 };
    case "top-right":
      return { offX: -dx / 2, offY: dy / 2 };
    case "bottom-left":
      return { offX: dx / 2, offY: -dy / 2 };
    case "bottom-right":
      return { offX: -dx / 2, offY: -dy / 2 };
    case "bottom-center":
      return { offX: 0, offY: -dy / 2 };
    case "top-center":
      return { offX: 0, offY: dy / 2 };
    default:
      return { offX: 0, offY: 0 };
  }
}

export function easeOutCubic(t: number) {
  t = clamp01(t);
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeOutBack(t: number, s = 1.6) {
  t = clamp01(t);
  const invS = s + 1;
  const x = t - 1;
  return 1 + invS * x * x * x + s * x * x;
}
