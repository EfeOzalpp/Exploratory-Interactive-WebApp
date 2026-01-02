// canvas-engine/hooks/color/useAvgColor.ts
import { useMemo } from 'react';

import { gradientColor } from '../colorUtils.ts';
import type { Stop } from './colorStops.ts';
import { BRAND_STOPS_VIVID } from './colorStops.ts';

export function useAvgColor(avg: number | undefined, stops: Stop[] = BRAND_STOPS_VIVID) {
  return useMemo(() => gradientColor(stops, avg ?? 0.5), [avg, stops]);
}
