// src/canvas-engine/adjustable-rules/placementRules.ts
import type { DeviceType } from '../shared/responsiveness.ts';
import type { ShapeName } from './shapeCatalog.ts';

export type Band = { topK: number; botK: number };
export type PickOpts = { questionnaire?: boolean; overlay?: boolean };

// the position of the shapes for the initial canvas
export const SHAPE_BANDS: Record<DeviceType, Record<ShapeName, Band>> = {
  small: {
    sun: { topK: 0.02, botK: 0.1 },
    clouds: { topK: 0.1, botK: 0.3 },
    snow: { topK: 0.1, botK: 0.42 },
    house: { topK: 0.24, botK: 0.58 },
    villa: { topK: 0.24, botK: 0.58 },
    power: { topK: 0.2, botK: 0.4 },
    carFactory: { topK: 0.3, botK: 0.6 },
    car: { topK: 0.3, botK: 0.78 },
    bus: { topK: 0.3, botK: 0.82 },
    sea: { topK: 0.3, botK: 0.9 },
    trees: { topK: 0.3, botK: 0.9 },
  },
  medium: {
    sun: { topK: 0.3, botK: 0.45 },
    clouds: { topK: 0.3, botK: 0.4 },
    snow: { topK: 0.3, botK: 0.5 },
    house: { topK: 0.5, botK: 0.8 },
    villa: { topK: 0.45, botK: 0.8 },
    power: { topK: 0.4, botK: 0.8 },
    carFactory: { topK: 0.5, botK: 0.9 },
    car: { topK: 0.5, botK: 0.7 },
    bus: { topK: 0.5, botK: 0.82 },
    sea: { topK: 0.4, botK: 1 },
    trees: { topK: 0.7, botK: 1 },
  },
  large: {
    sun: { topK: 0.08, botK: 0.15 },
    clouds: { topK: 0.04, botK: 0.2 },
    snow: { topK: 0.1, botK: 0.4 },
    house: { topK: 0.3, botK: 0.54 },
    villa: { topK: 0.2, botK: 0.54 },
    power: { topK: 0.2, botK: 0.5 },
    carFactory: { topK: 0.5, botK: 0.7 },
    car: { topK: 0.5, botK: 0.7 },
    bus: { topK: 0.4, botK: 0.82 },
    sea: { topK: 0.6, botK: 0.9 },
    trees: { topK: 0.6, botK: 0.9 },
  },
};

// the position of the shapes for the initial canvases questionnaire: true; state
export const SHAPE_BANDS_Q: Partial<Record<DeviceType, Partial<Record<ShapeName, Band>>>> = {
  small: {
    sun: { topK: 0, botK: 0.8 },
    clouds: { topK: 0, botK: 0.8 },
    snow: { topK: 0, botK: 0.8 },
    house: { topK: 0, botK: 1 },
    villa: { topK: 0, botK: 1 },
    power: { topK: 0.7, botK: 1 },
    carFactory: { topK: 0.8, botK: 1 },
    car: { topK: 0, botK: 1 },
    bus: { topK: 0, botK: 1 },
    sea: { topK: 0.8, botK: 1 },
    trees: { topK: 0, botK: 1 },
  },
  medium: {
    sun: { topK: 0, botK: 0.8 },
    clouds: { topK: 0, botK: 0.65 },
    snow: { topK: 0, botK: 0.8 },
    house: { topK: 0, botK: 1 },
    villa: { topK: 0, botK: 1 },
    power: { topK: 0.7, botK: 1 },
    carFactory: { topK: 0.8, botK: 1 },
    car: { topK: 0, botK: 1 },
    bus: { topK: 0, botK: 1 },
    sea: { topK: 0.8, botK: 1 },
    trees: { topK: 0, botK: 1 },
  },
  large: {
    sun: { topK: 0, botK: 0.2 },
    clouds: { topK: 0.2, botK: 1 },
    snow: { topK: 0.3, botK: 0.6 },
    house: { topK: 0.4, botK: 1 },
    villa: { topK: 0.2, botK: 1 },
    power: { topK: 0.3, botK: 1 },
    carFactory: { topK: 0.4, botK: 1 },
    car: { topK: 0.4, botK: 1 },
    bus: { topK: 0.4, botK: 1 },
    sea: { topK: 0.4, botK: 1 },
    trees: { topK: 0.45, botK: 1 },
  },
};

// the position of the shapes for the overlay canvas
export const SHAPE_BANDS_OVERLAY: Partial<Record<DeviceType, Partial<Record<ShapeName, Band>>>> = {
  small: {
    sun: { topK: 0.0, botK: 0.2 },
    clouds: { topK: 0.1, botK: 0.5 },
    snow: { topK: 0.3, botK: 0.6 },
    house: { topK: 0.2, botK: 1 },
    villa: { topK: 0.2, botK: 1 },
    power: { topK: 0.3, botK: 1 },
    car: { topK: 0.3, botK: 0.8 },
    bus: { topK: 0.3, botK: 0.8 },
    trees: { topK: 0.3, botK: 1 },
    sea: { topK: 0.2, botK: 1 },
    carFactory: { topK: 0.3, botK: 1 },
  },
  medium: {
    sun: { topK: 0.0, botK: 0.2 },
    clouds: { topK: 0.1, botK: 0.3 },
    snow: { topK: 0.3, botK: 0.4 },
    house: { topK: 0.2, botK: 0.7 },
    villa: { topK: 0.2, botK: 0.8 },
    power: { topK: 0.3, botK: 0.9 },
    car: { topK: 0.4, botK: 0.9 },
    bus: { topK: 0.5, botK: 0.8 },
    trees: { topK: 0.6, botK: 1 },
    sea: { topK: 0.5, botK: 1 },
    carFactory: { topK: 0.3, botK: 1 },
  },
  large: {
    sun: { topK: 0.0, botK: 0.2 },
    clouds: { topK: 0.1, botK: 0.3 },
    snow: { topK: 0.3, botK: 0.4 },
    house: { topK: 0.2, botK: 0.7 },
    villa: { topK: 0.2, botK: 0.8 },
    power: { topK: 0.3, botK: 0.9 },
    car: { topK: 0.4, botK: 0.7 },
    bus: { topK: 0.5, botK: 0.8 },
    trees: { topK: 0.1, botK: 1 },
    sea: { topK: 0.5, botK: 0.9 },
    carFactory: { topK: 0.3, botK: 0.9 },
  },
};
