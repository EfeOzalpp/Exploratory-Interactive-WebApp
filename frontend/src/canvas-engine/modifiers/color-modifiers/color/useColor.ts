// canvas-engine/hooks/color/useColor.ts
import { useEffect, useRef } from 'react';

import { useAvgColor } from './useAvgColor.ts';
import type { Stop } from './colorStops.ts';
import { BRAND_STOPS_VIVID } from './colorStops.ts';

type Engine = {
  ready: React.MutableRefObject<boolean>;
  controls: React.MutableRefObject<{
    setFieldStyle?: (s: {
      gradientRGB?: { r:number; g:number; b:number } | null;
      blend?: number;
      liveAvg?: number;
      exposure?: number;   
      contrast?: number;  
      perShapeScale?: Record<string, number>; 
    }) => void;
    setFieldVisible?: (v: boolean) => void;
  } | null>;
};

type UseColorOpts = {
  /** 0..1 — 0 = pure base palette, 1 = pure gradient (default 0.5) */
  blend?: number;
};

/**
 * Push only the blended gradient RGB + liveAvg into the engine.
 * Shapes read these and apply their own palette/blend rules locally.
 */
export function useColor(
  engine: Engine,
  liveAvg: number | undefined,
  stops: Stop[] = BRAND_STOPS_VIVID,
  enableConsole = false,
  opts: UseColorOpts = {}
) {
  const clampedAvg = typeof liveAvg === 'number'
    ? Math.max(0, Math.min(1, liveAvg))
    : 0.5;

  // Gradient at current average (both css + numeric rgb returned)
  const { css, rgb } = useAvgColor(clampedAvg, stops);

  const blend = Math.max(0, Math.min(1, opts.blend ?? 0.5));
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engine?.ready?.current) return;

    const key = JSON.stringify({ rgb, clampedAvg, blend });
    if (key === lastKeyRef.current) return;

    engine.controls.current?.setFieldStyle?.({
      gradientRGB: rgb,   // shared gradient only
      blend,              // global blend knob; shapes decide how/if to use
      liveAvg: clampedAvg // pass through for shape-specific lerps
    });

    engine.controls.current?.setFieldVisible?.(true);
    lastKeyRef.current = key;

    if (enableConsole) {
      // eslint-disable-next-line no-console
      console.log('[Canvas] color mix', { liveAvg: clampedAvg, gradientCss: css, blend });
    }
  }, [engine, rgb, clampedAvg, blend, enableConsole]);
}
