import { useEffect, useRef } from 'react';
import { useAvgColor } from '../modifiers/color-modifiers/color/useAvgColor.ts';
import { BRAND_STOPS_VIVID, type Stop } from '../modifiers/color-modifiers/color/colorStops.ts';

type Engine = {
  ready: React.MutableRefObject<boolean>;
  controls: React.MutableRefObject<any>;
};

type LiveAvgDotOpts = {
  liveAvg?: number;
  radius?: number;
  stops?: Stop[];
  enableConsole?: boolean;
};

/**
 * Drives the engine "dot" overlay from a live average value.
 * Uses the avg→color mapping from useAvgColor and updates only when inputs change.
 */
export function useLiveAvgDot(
  engine: Engine,
  opts: LiveAvgDotOpts = {}
) {
  const {
    liveAvg = 0.5,
    radius = 11,
    stops = BRAND_STOPS_VIVID,
    enableConsole = true,
  } = opts;

  const { css } = useAvgColor(liveAvg, stops);

  const lastRef = useRef<{ css: string; radius: number } | null>(null);

  useEffect(() => {
    if (!engine.ready.current) return;

    const last = lastRef.current;
    const changed = !last || last.css !== css || last.radius !== radius;
    if (!changed) return;

    engine.controls.current?.setDot?.({ color: css, r: radius, visible: true });
    lastRef.current = { css, radius };

    if (enableConsole) {
      console.log('[Canvas] liveAvg:', liveAvg, '→', css, 'r=', radius);
    }
  }, [engine.ready, engine.controls, css, radius, liveAvg, enableConsole]);
}
