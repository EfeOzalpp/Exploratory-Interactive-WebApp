// modifiers/index.ts

/* =========================
 * COLOR
 * ========================= */

export { clamp01 } from "./color-modifiers/math.ts";

export { rgbToHsl, hslToRgb } from "./color-modifiers/colorspace.ts";

export { blendRGB, blendRGBGamma } from "./color-modifiers/blend.ts";

export { cssToRgbViaCanvas } from "./color-modifiers/adapter.ts";

export {
  oscillateSaturation,
  clampBrightness,
  clampSaturation,
  driveSaturation,
} from "./color-modifiers/effects.ts";

// Runtime uses these
export { gradientColor } from "./color-modifiers/gradient.ts";
export { BRAND_STOPS_VIVID } from "./color-modifiers/stops.ts";


/* =========================
 * SHAPE MODIFIERS
 * ========================= */

export { displacementOsc } from "./shape-modifiers/osc.ts";
export { makeArchLobes } from "./shape-modifiers/geom.ts";

// legacy surface expects clamp01/val/mix to come from here.
// clamp01 would collide with color clamp01, so keep the old names:
// - clamp01 from color
// - val/mix from useLerp
export { val, mix } from "./shape-modifiers/useLerp.ts";

export { applyShapeMods } from "./shape-modifiers/shapeMods.apply.ts";
export type { Anchor, ShapeMods, ApplyShapeModsOpts } from "./shape-modifiers/shapeMods.types.ts";


/* =========================
 * PARTICLES 
 * ========================= */

export { stepAndDrawParticles } from "./particle-systems/particle-1.ts";
export { stepAndDrawPuffs } from "./particle-systems/particle-2.ts";
