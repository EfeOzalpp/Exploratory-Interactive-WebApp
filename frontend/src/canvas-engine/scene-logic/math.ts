// src/canvas/scene-logic/math.ts

export const clamp01 = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

export function usedRowsFromSpec(rows: number, useTopRatio?: number) {
  const useTop = Math.max(0.01, Math.min(1, useTopRatio ?? 1));
  return Math.max(1, Math.round(rows * useTop));
}
