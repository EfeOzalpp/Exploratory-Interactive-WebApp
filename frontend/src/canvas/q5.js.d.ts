// src/canvas/q5.js.d.ts
export type Q5Controls = {
  setFieldItems(items: Array<{ id?: number; x: number; y: number; shape?: string; z?: number; footprint?: any }>): void;
  setFieldStyle(opts: {
    r?: number;
    gradientRGB?: { r: number; g: number; b: number } | null;
    blend?: number;
    liveAvg?: number;
    perShapeScale?: Record<string, number>;
  }): void;
  setFieldVisible(v: boolean): void;
  setHeroVisible(v: boolean): void;
  setVisible(v: boolean): void;
  stop(): void;
  readonly canvas?: HTMLCanvasElement | null;
};

export type StartQ5Opts = {
  mount?: string;
  onReady?: (controls: Q5Controls) => void; 
  dprMode?: 'fixed1' | 'cap2';
};

export function startQ5(opts?: StartQ5Opts): Q5Controls;
export default startQ5;
