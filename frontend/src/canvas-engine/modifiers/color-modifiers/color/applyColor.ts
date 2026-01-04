import type { ModifierContext } from "../../context.ts";
import { getAvgColor } from "./getAvgColor.ts";
import { BRAND_STOPS_VIVID } from "./colorStops.ts";

export function applyColor(ctx: ModifierContext) {
  const { rgb } = getAvgColor(ctx.liveAvg, BRAND_STOPS_VIVID);
  return {
    ...ctx,
    gradientRGB: rgb,
  };
}
