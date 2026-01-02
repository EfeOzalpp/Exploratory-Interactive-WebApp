// modifiers/index.ts
export {
  oscillateSaturation,
  driveSaturation,
  clampBrightness,
  clampSaturation,
  rgbToHsl,
  hslToRgb,
} from "./color-modifiers/colorUtils.ts";

export { blendRGB, blendRGBGamma } from "./color-modifiers/colorBlend.ts";
export { displacementOsc } from "./shape-modifiers/osc.ts";
export { cssToRgbViaCanvas } from "./color-modifiers/colorAdapter.ts";

export { stepAndDrawParticles } from "./particle-systems/particle-1.ts";
export { stepAndDrawPuffs } from "./particle-systems/particle-2.ts";

export { makeArchLobes } from "./shape-modifiers/geom.ts";
export { clamp01, mix, val } from "./shape-modifiers/useLerp.ts";

export { applyShapeMods } from "./shape-modifiers/shapeMods.apply.ts";
export type { Anchor, ShapeMods, ApplyShapeModsOpts } from "./shape-modifiers/shapeMods.types.ts";
