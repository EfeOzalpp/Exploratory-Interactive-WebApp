import type { Vec3, GeneratePositionsOptions } from './positions.ts';
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
    const rawAvg =
      typeof response?.avgWeight === 'number' && Number.isFinite(response.avgWeight)
        ? response.avgWeight
        : computeLocalAvg(response);

    // Guarantee a real number no matter what:
    const avg: number =
      typeof rawAvg === 'number' && Number.isFinite(rawAvg) ? rawAvg : 0.5;

    // Guarantee a Vec3 (TS can't prove base[i] exists)
    const pos: Vec3 = base[i] ?? [0, 0, 0];

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
