// src/canvas-engine/grid-layout/placementBands.ts

import type { DeviceType } from "../shared/responsiveness.ts";
import type { ShapeName } from "../adjustable-rules/shapeCatalog.ts";
import type { Band, ShapeBands } from "../adjustable-rules/placementRules.ts";

function clampBandToRows(topK: number, botK: number, usedRows: number, hCell = 1) {
  topK = Math.max(0, Math.min(1, topK));
  botK = Math.max(topK, Math.min(1, botK));

  let top = Math.floor(usedRows * topK);
  let bot = Math.floor(usedRows * botK);

  bot = Math.min(usedRows - hCell, bot);
  top = Math.max(0, Math.min(top, bot));

  return { top, bot };
}

function getBand(bands: ShapeBands | undefined, device: DeviceType, shape: ShapeName): Band {
  if (!bands) {
    throw new Error(`[PlacementBands] bands table is undefined. Did you pass profile.bands into placePoolItems?`);
  }

  const byDevice = bands[device];
  if (!byDevice) {
    throw new Error(`[PlacementBands] bands table missing device="${device}". Keys: ${Object.keys(bands).join(", ")}`);
  }

  const band = byDevice[shape];
  if (!band) {
    throw new Error(`[PlacementBands] bands table missing shape="${shape}" for device="${device}".`);
  }

  return band;
}


export const PlacementBands = {
  band(bands: ShapeBands, shape: ShapeName, usedRows: number, device: DeviceType, hCell = 1) {
    const { topK, botK } = getBand(bands, device, shape);
    return clampBandToRows(topK, botK, usedRows, hCell);
  },
};
