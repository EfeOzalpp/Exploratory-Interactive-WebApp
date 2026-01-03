import { useMemo } from 'react';
import type { DotPoint, DotPointsOptions, SurveyResponseLike } from '../utils/dotPoints.ts';
import { computeDotPoints } from '../utils/dotPoints.ts';

type ArrayCall = [SurveyResponseLike[], DotPointsOptions?];
type ObjectCall = [{ data?: SurveyResponseLike[] } & DotPointsOptions];

export default function useDotPoints(...args: ArrayCall | ObjectCall): DotPoint[] {
  const isArrayCall = Array.isArray(args[0]);
  const data = isArrayCall ? (args[0] as SurveyResponseLike[]) : (args[0]?.data ?? []);
  const opts = isArrayCall ? (args[1] ?? {}) : (args[0] ?? {});

  // useMemo is enough: this is pure + deterministic.
  return useMemo(() => computeDotPoints(data, opts), [
    data,
    opts,
  ]);
}
