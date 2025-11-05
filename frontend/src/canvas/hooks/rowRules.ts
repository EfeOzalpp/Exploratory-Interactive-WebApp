// src/canvas/hooks/rowRules.ts
import type { BreakBand } from "../grid/config.ts";

export type ShapeName =
  | "clouds" | "snow" | "house" | "power"
  | "sun" | "villa" | "car" | "sea" | "carFactory" | "bus" | "trees" ;

/** A band is a [top, bottom] range expressed as FRACTIONS of usedRows. */
type Band = { topK: number; botK: number };

/* ───────────────── default (non-questionnaire) bands ───────────────── */

const SHAPE_BANDS: Record<BreakBand, Record<ShapeName, Band>> = {
  small: {
    sun:    { topK: 0.02, botK: 0.10 },
    clouds: { topK: 0.10, botK: 0.30 },
    snow:   { topK: 0.10, botK: 0.42 },

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

/* ─────────────── questionnaire-mode partial overrides ─────────────── */
const SHAPE_BANDS_Q: Partial<Record<BreakBand, Partial<Record<ShapeName, Band>>>> = {
  small: {
    sun:    { topK: 0, botK: 0.8 },
    clouds: { topK: 0, botK: 0.8 },
    snow:   { topK: 0, botK: 0.8 },

    house:  { topK: 0, botK: 1 },
    villa:  { topK: 0, botK: 1 },
    power:  { topK: 0.7, botK: 1 },
    carFactory: { topK: 0.8, botK: 1 },
    car:    { topK: 0, botK: 1 },
    bus:    { topK: 0, botK: 1 },
    sea:    { topK: 0.8, botK: 1 },
    trees:  { topK: 0, botK: 1 },
  },
  medium: {
    sun:    { topK: 0, botK: 0.8 },
    clouds: { topK: 0, botK: 0.65 },
    snow:   { topK: 0, botK: 0.8 },

    house:  { topK: 0, botK: 1 },
    villa:  { topK: 0, botK: 1 },
    power:  { topK: 0.7, botK: 1 },
    carFactory: { topK: 0.8, botK: 1 },
    car:    { topK: 0, botK: 1 },
    bus:    { topK: 0, botK: 1 },
    sea:    { topK: 0.8, botK: 1 },
    trees:  { topK: 0, botK: 1 },
  },
  large: {
    sun:    { topK: 0, botK: 0.2 },
    clouds: { topK: 0.2, botK: 0.6 },
    snow:   { topK: 0.4, botK: 0.6 },

    house:  { topK: 0.3, botK: 1 },
    villa:  { topK: 0.25, botK: 1 },
    power:  { topK: 0.4, botK: 1 },
    carFactory: { topK: 0.4, botK: 1 },
    car:    { topK: 0.4, botK: 1 },
    bus:    { topK: 0.4, botK: 1 },
    sea:    { topK: 0.4, botK: 1 },
    trees:  { topK: 0.45, botK: 1 },
  },
};

/* ─────────────── overlay-mode partial overrides (distinct look) ─────────────── */
const SHAPE_BANDS_OVERLAY: Partial<Record<BreakBand, Partial<Record<ShapeName, Band>>>> = {
  small: {
    sun:       { topK: 0.0, botK: 0.2 },
    clouds:    { topK: 0.1, botK: 0.5 },
    snow:      { topK: 0.3, botK: 0.6 },
    house:     { topK: 0.2, botK: 1 },
    villa:     { topK: 0.2, botK: 1 },
    power:     { topK: 0.3, botK: 1 },
    car:       { topK: 0.3, botK: 0.8 },
    bus:       { topK: 0.3, botK: 0.8 },
    trees:     { topK: 0.3, botK: 1 },
    sea:       { topK: 0.2, botK: 1 },
    carFactory:{ topK: 0.3, botK: 1 },
  },

  medium: {
    sun:       { topK: 0.0, botK: 0.2 },
    clouds:    { topK: 0.1, botK: 0.3 },
    snow:      { topK: 0.3, botK: 0.4 },
    house:     { topK: 0.2, botK: 0.7 },
    villa:     { topK: 0.2, botK: 0.8 },
    power:     { topK: 0.3, botK: 0.9 },
    car:       { topK: 0.4, botK: 0.9 },
    bus:       { topK: 0.5, botK: 0.8 },
    trees:     { topK: 0.6, botK: 1 },
    sea:       { topK: 0.5, botK: 1 },
    carFactory:{ topK: 0.3, botK: 1 },
  },

  large: {
    sun:       { topK: 0.0, botK: 0.2 },
    clouds:    { topK: 0.1, botK: 0.3 },
    snow:      { topK: 0.3, botK: 0.4 },
    house:     { topK: 0.2, botK: 0.7 },
    villa:     { topK: 0.2, botK: 0.8 },
    power:     { topK: 0.3, botK: 0.9 },
    car:       { topK: 0.4, botK: 0.7 },
    bus:       { topK: 0.5, botK: 0.8 },
    trees:     { topK: 0.1, botK: 1 },
    sea:       { topK: 0.5, botK: 0.9 },
    carFactory:{ topK: 0.3, botK: 0.9 },
  },
};

/* ───────────────────────── internals ───────────────────────── */

type PickOpts = { questionnaire?: boolean; overlay?: boolean };

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

  // overlay wins first (explicit look), then questionnaire, then base
  if (opts?.overlay) {
    const o = SHAPE_BANDS_OVERLAY[band]?.[s];
    if (o) return o;
  }
  if (opts?.questionnaire) {
    const q = SHAPE_BANDS_Q[band]?.[s];
    if (q) return q;
  }
  return (
    base[s] ??
    (s === "clouds" || s === "snow" || s === "sun" ? base["clouds"] : base["house"])
  );
}

/* ──────────────────────────── API ──────────────────────────── */

export const RowRules = {
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
