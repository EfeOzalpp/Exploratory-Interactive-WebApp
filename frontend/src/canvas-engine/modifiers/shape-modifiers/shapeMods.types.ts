// modifiers/shape-modifiers/shapeMods.types.ts

export type Anchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center"
  | "top-center";

export interface Scale {
  value?: number;
  anchor?: Anchor;
}

export interface Scale2D {
  x?: number;
  y?: number;
  anchor?: Anchor;
}

export interface SizeOsc {
  speed?: number;
  phase?: number;
  anchor?: Anchor;
  mode?: "relative" | "absolute";

  bias?: number;
  amp?: number;

  biasAbs?: number;
  ampAbs?: number;
}

export interface Scale2DOsc {
  mode?: "relative" | "absolute";

  biasX?: number;
  ampX?: number;
  biasY?: number;
  ampY?: number;

  biasAbsX?: number;
  ampAbsX?: number;
  biasAbsY?: number;
  ampAbsY?: number;

  speed?: number;
  phaseX?: number;
  phaseY?: number;
  anchor?: Anchor;
}

export interface OpacityOsc {
  amp?: number;
  speed?: number;
  phase?: number;
}

export interface Rotation {
  speed?: number;
}

export interface RotationOsc {
  amp?: number;
  speed?: number;
  phase?: number;
}

export interface SaturationOsc {
  amp?: number;
  speed?: number;
  phase?: number;
}

export interface AppearMod {
  scaleFrom?: number;
  alphaFrom?: number;
  anchor?: Anchor;
  ease?: "linear" | "cubic" | "back";
  backOvershoot?: number;
}

export interface TranslateClampX {
  min?: number;
  max?: number;
}
export interface TranslateClampY {
  min?: number;
  max?: number;
}

export interface TranslateOscX {
  amp?: number;
  speed?: number;
  phase?: number;
}
export interface TranslateOscY {
  amp?: number;
  speed?: number;
  phase?: number;
}

export interface ShapeMods {
  appear?: AppearMod;

  scale?: Scale;
  scale2D?: Scale2D;
  sizeOsc?: SizeOsc;
  scale2DOsc?: Scale2DOsc;

  opacityOsc?: OpacityOsc;
  rotation?: Rotation;
  rotationOsc?: RotationOsc;
  saturationOsc?: SaturationOsc;

  translateClampX?: TranslateClampX;
  translateClampY?: TranslateClampY;
  translateOscX?: TranslateOscX;
  translateOscY?: TranslateOscY;
}

export interface ApplyShapeModsOpts {
  p: any;
  x: number;
  y: number;
  r: number;
  opts?: {
    alpha?: number;
    timeMs?: number;
    liveAvg?: number;
    rootAppearK?: number;
  };
  mods?: ShapeMods;
}
