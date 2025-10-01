import { useEffect, useRef } from 'react';
import { useAvgColor } from './useAvgColor.ts';                     // ⬅ explicit .ts
import { BRAND_STOPS_VIVID, type Stop } from '../color/colorStops.ts'; // ⬅ explicit .ts

type LiveAvgDotOpts = { liveAvg?: number; radius?: number; stops?: Stop[]; enableConsole?: boolean };

export function useLiveAvgDot(
{ engine, opts = {} }: { engine: { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any>; }; opts?: LiveAvgDotOpts; }) {
  const { liveAvg = 0.5, radius = 11, stops = BRAND_STOPS_VIVID, enableConsole = true } = opts;
  const { css } = useAvgColor(liveAvg, stops);

  const lastCssRef = useRef<string | null>(null);
  const lastRRef = useRef<number | null>(null);

  useEffect(() => {
    if (!engine.ready.current) return;
    const changed = css !== lastCssRef.current || radius !== lastRRef.current;
    if (!changed) return;
    engine.controls.current?.setDot?.({ color: css, r: radius, visible: true });
    lastCssRef.current = css;
    lastRRef.current = radius;
    if (enableConsole) console.log('[Canvas] liveAvg:', liveAvg, '→', css, 'r=', radius);
  }, [engine, css, radius, liveAvg, enableConsole]);
}
