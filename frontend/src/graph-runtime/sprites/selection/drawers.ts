// graph-runtime/sprites/selection/drawers.ts
import type { ShapeKey } from './types';

import {
  drawClouds,
  drawSnow,
  drawHouse,
  drawPower,
  drawSun,
  drawVilla,
  drawCarFactory,
  drawCar,
  drawSea,
  drawBus,
  drawTrees,
} from '../../../canvas-engine/shapes/index.js';

export type DrawerFn = (p: any, x: number, y: number, size: number, opts?: any) => void;

export const DRAWERS: Partial<Record<ShapeKey, DrawerFn>> = {
  sea: drawSea,
  trees: drawTrees,
  house: drawHouse,
  power: drawPower,
  carFactory: drawCarFactory,
  car: drawCar,
  bus: drawBus,
  clouds: drawClouds,
  sun: drawSun,
  snow: drawSnow,
  villa: drawVilla,
};
