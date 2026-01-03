import type { Vec3, GeneratePositionsOptions } from './positions';
import { generatePositions } from './positions.ts';
import { sampleStops, rgbString } from '../../../utils-hooks/hooks.ts';

export type SurveyResponseLike = {
  _id?: string;
  avgWeight?: number;
  weights?: Record<string, unknown>;
};

export type DotPoint = {
  position: Vec3;
  originalPosition: Vec3;
  color: string;
  averageWeight: number;
  _id?: string;
};

export type DotPointsOptions = GeneratePositionsOptions & {
  colorForAverage?: (avg: number) => string;
  personalizedEntryId?: string | null;
  showPersonalized?: boolean;

  minDistance?: number;
  spreadOverride?: number;
};

const defaultColorForAverage = (avg: number) => rgbString(sampleStops(avg));

const computeLocalAvg = (response: SurveyResponseLike): number | undefined => {
  const w = response?.weights;
  if (!w || typeof w !== 'object') return undefined;
  const vals = Object.values(w).filter((x): x is number => Number.isFinite(x));
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

export function computeDotPoints(
  data: SurveyResponseLike[],
  opts: DotPointsOptions = {}
): DotPoint[] {
  const safe = Array.isArray(data) ? data : [];
  const n = safe.length;
  if (n === 0) return [];

  const {
    colorForAverage = defaultColorForAverage,
    personalizedEntryId,
    showPersonalized = false,

    minDistance = 2.5,
    spreadOverride,

    // pass-through to generatePositions
    baseRadius,
    densityK,
    maxRadiusCap,
    yaw,
    pitch,
    roll,
    jitterAmp,
    relaxPasses,
    relaxStrength,
    seed,

    tightRefN,
    baseRadiusTight,
    tightMaxAlpha,
    tightCurve,
  } = opts;

  const base = generatePositions(
    n,
    minDistance,
    spreadOverride,
    {
      baseRadius,
      densityK,
      maxRadiusCap,
      yaw,
      pitch,
      roll,
      jitterAmp,
      relaxPasses,
      relaxStrength,
      seed,
      tightRefN,
      baseRadiusTight,
      tightMaxAlpha,
      tightCurve,
    }
  );

  const pts: DotPoint[] = safe.map((response, i) => {
    let avg: number | undefined = Number.isFinite(response?.avgWeight)
      ? Number(response!.avgWeight)
      : undefined;

    if (!Number.isFinite(avg)) {
      const local = computeLocalAvg(response);
      avg = Number.isFinite(local) ? local : 0.5;
    }

    const pos = base[i];
    return {
      position: pos,
      originalPosition: pos,
      color: colorForAverage(avg),
      averageWeight: avg,
      _id: response?._id,
    };
  });

  if (showPersonalized && personalizedEntryId) {
    const mine = pts.find((p) => p._id === personalizedEntryId);
    if (mine) {
      mine.position = [0, 0, 0];
      mine.originalPosition = [0, 0, 0];
    }
  }

  return pts;
}
