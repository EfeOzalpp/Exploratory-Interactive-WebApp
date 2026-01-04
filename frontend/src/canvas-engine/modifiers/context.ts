export type RGB = { r: number; g: number; b: number };

export type ModifierContext = {
  // signals (inputs)
  liveAvg: number;          // 0..1
  timeMs: number;

  // derived (computed from signals and config)
  gradientRGB: RGB | null;

  // knobs/config
  blend: number;            // 0..1
  exposure: number;
  contrast: number;

  // render/frame info
  alpha: number;
  cell?: number;
  footprint?: any;
  transport?: any;
  rootAppearK?: number;

  // stable randomness
  seedKey?: string;
};
