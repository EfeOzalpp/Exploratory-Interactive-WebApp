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

/* ───────────────── default (non-questionnaire) bands ───────────────── */

const SHAPE_BANDS: Record<BreakBand, Record<ShapeName, Band>> = {
  small: {
    // SKY
    sun:    { topK: 0.02, botK: 0.10 },
    clouds: { topK: 0.10, botK: 0.30 },
    snow:   { topK: 0.10, botK: 0.42 },

    // GROUND
    house:  { topK: 0.24, botK: 0.58 },
    villa:  { topK: 0.24, botK: 0.58 },
    power:  { topK: 0.20, botK: 0.40 },
    carFactory: { topK: 0.30, botK: 0.60 },
    car:    { topK: 0.30, botK: 0.78 },
    bus:    { topK: 0.30, botK: 0.82 },
    sea:    { topK: 0.20, botK: 0.90 },
    trees:  { topK: 0.30, botK: 0.90 },
  },

  medium: {
    sun:    { topK: 0.30, botK: 0.45 },
    clouds: { topK: 0.30, botK: 0.40 },
    snow:   { topK: 0.30, botK: 0.50 },

    house:  { topK: 0.50, botK: 0.80 },
    villa:  { topK: 0.45, botK: 0.80 },
    power:  { topK: 0.40, botK: 0.80 },
    carFactory: { topK: 0.50, botK: 0.90 },
    car:    { topK: 0.50, botK: 0.70 },
    bus:    { topK: 0.50, botK: 0.82 },
    sea:    { topK: 0.18, botK: 0.82 },
    trees:  { topK: 0.70, botK: 0.90 },
  },

  large: {
    sun:    { topK: 0.08, botK: 0.15 },
    clouds: { topK: 0.04, botK: 0.20 },
    snow:   { topK: 0.10, botK: 0.40 },

    house:  { topK: 0.30, botK: 0.54 },
    villa:  { topK: 0.20, botK: 0.54 },
    power:  { topK: 0.20, botK: 0.50 },
    carFactory: { topK: 0.50, botK: 0.70 },
    car:    { topK: 0.50, botK: 0.70 },
    bus:    { topK: 0.40, botK: 0.82 },
    sea:    { topK: 0.60, botK: 0.90 },
    trees:  { topK: 0.60, botK: 0.90 },
  },
};

/* ─────────────── questionnaire-mode partial overrides ───────────────
   Define only the shapes you want to shift while the questionnaire is open.
   Everything else falls back to SHAPE_BANDS above.
   You can tweak these numbers freely.
*/
const SHAPE_BANDS_Q: Partial<Record<BreakBand, Partial<Record<ShapeName, Band>>>> = {
  small: {
    // push sky slightly higher to free room
    clouds: { topK: 0.06, botK: 0.22 },
    snow:   { topK: 0.12, botK: 0.38 },
    // bias more ground lower so the field looks calmer
    car:    { topK: 0.36, botK: 0.80 },
    bus:    { topK: 0.36, botK: 0.84 },
  },
  medium: {
    clouds: { topK: 0.26, botK: 0.38 },
    house:  { topK: 0.54, botK: 0.82 },
  },
  large: {
    // raise clouds a touch when the form is open
    clouds: { topK: 0.20, botK: 0.60 },
    // keep heavy ground a tad lower
    carFactory: { topK: 0.4, botK: 0.80 },
    bus:        { topK: 0.24, botK: 0.82 },
    snow:   { topK: 0.2, botK: 0.8 },
    villa:  { topK: 0.10, botK: 0.54 },
    sun:    { topK: 0, botK: 0.15 },
    power:  { topK: 0.40, botK: 0.80 },
  },
};

/* ───────────────────────── internals ───────────────────────── */

type PickOpts = { questionnaire?: boolean };

function clampBandToRows(topK: number, botK: number, usedRows: number, hCell = 1) {
  topK = Math.max(0, Math.min(1, topK));
  botK = Math.max(topK, Math.min(1, botK));

  let top = Math.floor(usedRows * topK);
  let bot = Math.floor(usedRows * botK);

  // (inclusive band) ensure the footprint fits
  bot = Math.min(usedRows - hCell, bot);
  top = Math.max(0, Math.min(top, bot));

  return { top, bot };
}

function pickBand(
  shape: ShapeName | undefined,
  band: BreakBand,
  opts?: PickOpts
): Band {
  const s = (shape ?? "clouds") as ShapeName;
  const base = SHAPE_BANDS[band];

  if (opts?.questionnaire) {
    const qTable = SHAPE_BANDS_Q[band] || {};
    const qHit = qTable[s];
    if (qHit) return qHit;
  }

  // default fallbacks if a shape isn't configured explicitly
  return (
    base[s] ??
    // unknown sky shapes → near clouds; unknown ground → near house
    (s === "clouds" || s === "snow" || s === "sun"
      ? base["clouds"]
      : base["house"])
  );
}

/* ──────────────────────────── API ──────────────────────────── */

export const RowRules = {
  /**
   * For ground shapes (house/villa/power/car/...), return integer row band.
   */
  preferredGroundBand(
    shape: ShapeName | undefined,
    usedRows: number,
    band: BreakBand,
    hCell: number,
    opts?: PickOpts
  ) {
    const { topK, botK } = pickBand(shape, band, opts);
    return clampBandToRows(topK, botK, usedRows, hCell);
  },

  /**
   * For sky shapes (sun/clouds/snow), return inclusive rMin..rMax range.
   */
  skyBand(
    shape: ShapeName | undefined,
    usedRows: number,
    band: BreakBand,
    opts?: PickOpts
  ) {
    const { topK, botK } = pickBand(shape, band, opts);
    const { top, bot } = clampBandToRows(topK, botK, usedRows, /* hCell */ 1);
    return { rMin: top, rMax: bot };
  },
};
