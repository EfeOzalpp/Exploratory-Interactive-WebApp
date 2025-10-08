// src/canvas/hooks/rowRules.ts
import type { BreakBand } from "../grid/config.ts";

export type ShapeName =
  | "clouds" | "snow" | "house" | "power"
  | "sun" | "villa" | "car" | "sea" | "carFactory" | "bus" | "trees" ;

/**
 * A band is a [top, bottom] range expressed as FRACTIONS of usedRows.
 * Example: { topK: 0.30, botK: 0.48 } means: rows ~30%..48% of usedRows.
 */
type Band = { topK: number; botK: number };

/** Per-device, per-shape placement bands. Tune these to move groups up/down. */
const SHAPE_BANDS: Record<BreakBand, Record<ShapeName, Band>> = {
  small: {
    // SKY (highest → lower)
    sun:    { topK: 0.02, botK: 0.1 }, // sun hugs the top
    clouds: { topK: 0.1, botK: 0.3 }, // clouds right below sun
    snow:   { topK: 0.10, botK: 0.42 }, // snow sits below clouds

    // GROUND (upper → lower)
    house:  { topK: 0.24, botK: 0.58 },
    villa:  { topK: 0.24, botK: 0.58 },
    power:  { topK: 0.2, botK: 0.4 },
    carFactory:   { topK: 0.3, botK: 0.6 },
    car:    { topK: 0.3, botK: 0.78 }, 
    bus:   { topK: 0.3, botK: 0.82 },
    sea:   { topK: 0.20, botK: 0.9 },
    trees:   { topK: 0.3, botK: 0.9 },
  },

  medium: {
    sun:    { topK: 0.3, botK: 0.45 },
    clouds: { topK: 0.3, botK: 0.4 },
    snow:   { topK: 0.3, botK: 0.5 },

    house:  { topK: 0.5, botK: 0.8 },
    villa:  { topK: 0.45, botK: 0.8 },
    power:  { topK: 0.4, botK: 0.8 },
    carFactory:   { topK: 0.5, botK: 0.9 },
    car:    { topK: 0.50, botK: 0.70 },
    bus:   { topK: 0.5, botK: 0.82 },
    sea:   { topK: 0.18, botK: 0.82 },
    trees:   { topK: 0.7, botK: 0.9 },
  },

  large: {
    sun:    { topK: 0.08, botK: 0.15 },
    clouds: { topK: 0.04, botK: 0.2 },
    snow:   { topK: 0.1, botK: 0.4 },

    house:  { topK: 0.3, botK: 0.54 },
    villa:  { topK: 0.2, botK: 0.54 },
    power:  { topK: 0.2, botK: 0.50 },
    carFactory:   { topK: 0.5, botK: 0.7 },
    car:    { topK: 0.5, botK: 0.7 },
    bus:   { topK: 0.4, botK: 0.82 },
    sea:   { topK: 0.6, botK: 0.9 },
    trees:   { topK: 0.6, botK: 0.9 },
  },
};

/* ---------- internals ---------- */

function clampBandToRows(topK: number, botK: number, usedRows: number, hCell = 1) {
  // sanitize fractions
  topK = Math.max(0, Math.min(1, topK));
  botK = Math.max(topK, Math.min(1, botK));

  let top = Math.floor(usedRows * topK);
  let bot = Math.floor(usedRows * botK);

  // ensure footprint fits (inclusive band, so last usable row is usedRows - hCell)
  bot = Math.min(usedRows - hCell, bot);
  top = Math.max(0, Math.min(top, bot));

  return { top, bot };
}

function pickBand(shape: ShapeName | undefined, band: BreakBand): Band {
  const s = (shape ?? "line") as ShapeName;
  const table = SHAPE_BANDS[band];
  // default fallbacks if a shape isn't configured explicitly
  return (
    table[s] ??
    // unknown sky shapes → put near clouds; unknown ground → near house band
    (s === "clouds" || s === "snow" || s === "sun"
      ? table["clouds"]
      : table["house"])
  );
}

/* ---------- API ---------- */

export const RowRules = {
  /**
   * For ground shapes (house/villa/power/car), return integer row band in usedRows.
   * NOTE: We don't enforce "ground only" here—your hook decides which shapes are ground.
   */
  preferredGroundBand(
    shape: ShapeName | undefined,
    usedRows: number,
    band: BreakBand,
    hCell: number
  ) {
    const { topK, botK } = pickBand(shape, band);
    return clampBandToRows(topK, botK, usedRows, hCell);
  },

  /**
   * For sky shapes (sun/clouds/snow), return inclusive rMin..rMax range.
   * We now use full bands (not just caps), so you can give clouds/snow real ranges too.
   */
  skyBand(shape: ShapeName | undefined, usedRows: number, band: BreakBand) {
    const { topK, botK } = pickBand(shape, band);
    const { top, bot } = clampBandToRows(topK, botK, usedRows, /* hCell */ 1);
    return { rMin: top, rMax: bot };
  },
};
