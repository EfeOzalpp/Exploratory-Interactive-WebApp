// graph-runtime/sprites/textures/canvasFacade.ts
import { makePFromCanvas } from '../../../canvas-engine/runtime/index.ts';

export type CanvasFacade = any;

export function makeCanvasFacade(canvas: HTMLCanvasElement, opts: { dpr: number }): CanvasFacade {
  return makePFromCanvas(canvas, opts);
}
