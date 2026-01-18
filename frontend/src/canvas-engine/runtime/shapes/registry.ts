// src/canvas-engine/runtime/shapes/registry.ts

import type { PLike } from "../p/makeP.ts";
import type { EngineFieldItem } from "../types.ts";
import { deviceType } from "../../shared/responsiveness.ts";

// NOTE: JS in repo today
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
} from "../../shapes/index.js";

export type DrawFn = (p: PLike, it: EngineFieldItem, rEff: number, opts: any) => void;

export function createRegistry<T extends Record<string, DrawFn>>(entries: T) {
  return new Map<string, DrawFn>(Object.entries(entries));
}

export type ShapeRegistry = ReturnType<typeof createRegistry>;

export function createDefaultShapeRegistry(): ShapeRegistry {
  return createRegistry({
    snow: (p2, it, rEff, opts) => {
      const vw = p2.width;
      const dt = deviceType(vw);
      const hideFrac = dt === "mobile" ? 0.32 : dt === "tablet" ? 0.4 : 0.2;

      drawSnow(p2 as any, it.x, it.y, rEff, {
        ...opts,
        footprint: it.footprint,
        usedRows: (opts as any)?.usedRows,
        hideGroundAboveFrac: hideFrac,
        showGround: true,
      });
    },

    house: (p2, it, rEff, opts) => drawHouse(p2 as any, it.x, it.y, rEff, opts),
    power: (p2, it, rEff, opts) => drawPower(p2 as any, it.x, it.y, rEff, opts),
    villa: (p2, it, rEff, opts) => drawVilla(p2 as any, it.x, it.y, rEff, opts),
    carFactory: (p2, it, rEff, opts) => drawCarFactory(p2 as any, it.x, it.y, rEff, opts),
    bus: (p2, it, rEff, opts) => drawBus(p2 as any, it.x, it.y, rEff, opts),
    trees: (p2, it, rEff, opts) => drawTrees(p2 as any, it.x, it.y, rEff, opts),
    car: (p2, it, rEff, opts) => drawCar(p2 as any, it.x, it.y, rEff, opts),
    sea: (p2, it, rEff, opts) => drawSea(p2 as any, it.x, it.y, rEff, opts),
    sun: (p2, it, rEff, opts) => drawSun(p2 as any, it.x, it.y, rEff, opts),
    clouds: (p2, it, rEff, opts) => drawClouds(p2 as any, it.x, it.y, rEff, opts),
  });
}
