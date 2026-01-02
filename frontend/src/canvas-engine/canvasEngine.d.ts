// src/canvas/canvas-engine.d.ts

export type CanvasEngineControls = {
  setFieldItems(items: Array<{ id?: number; x: number; y: number; shape?: string; z?: number; footprint?: any }>): void;
  setFieldStyle(opts: {
    r?: number;
    gradientRGB?: { r: number; g: number; b: number } | null;
    blend?: number;
    liveAvg?: number;
    perShapeScale?: Record<string, number>;
    exposure?: number;
    contrast?: number;
    appearMs?: number;
    exitMs?: number;
  }): void;
  setFieldVisible(v: boolean): void;
  setHeroVisible(v: boolean): void;
  setVisible(v: boolean): void;
  setQuestionnaireOpen?(v: boolean): void;
  stop(): void;
  readonly canvas?: HTMLCanvasElement | null;
};

export type StartCanvasEngineOpts = {
  mount?: string;
  onReady?: (controls: CanvasEngineControls) => void;
  dprMode?: 'fixed1' | 'cap2' | 'cap1_5' | 'auto';
  zIndex?: number;
};

export function startCanvasEngine(opts?: StartCanvasEngineOpts): CanvasEngineControls;
export function stopCanvasEngine(mount?: string): void;
export function isCanvasRunning(mount?: string): boolean;
export function stopAllCanvasEngines(): void;

// If you kept this helper export in JS:
export function makePFromCanvas(canvas: HTMLCanvasElement, opts?: { dpr?: number }): any;

export default startCanvasEngine;
