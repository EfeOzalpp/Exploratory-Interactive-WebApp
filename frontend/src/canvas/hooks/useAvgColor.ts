import { useMemo } from 'react';
import { gradientColor } from '../color/colorUtils.ts';     
import type { Stop } from '../color/colorStops.ts';       
import { BRAND_STOPS_VIVID } from '../color/colorStops.ts'; 

export function useAvgColor(avg: number | undefined, stops: Stop[] = BRAND_STOPS_VIVID) {
  return useMemo(() => gradientColor(stops, avg ?? 0.5), [avg, stops]);
}
