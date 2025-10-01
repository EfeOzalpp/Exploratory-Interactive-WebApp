import { useEffect, useRef } from 'react';
import { useAvgColor } from './useAvgColor.ts';
import type { Stop } from '../color/colorStops.ts';
import { BRAND_STOPS_VIVID } from '../color/colorStops.ts';

export function useColor(
  engine: { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> },
  liveAvg: number | undefined,
  stops: Stop[] = BRAND_STOPS_VIVID,
  enableConsole = false,
  // OPTIONAL: per-shape fill overrides (leave undefined to use global color)
  perShapeFill?: Partial<Record<'circle'|'triangle'|'square'|'octagon', string>>
) {
  const { css } = useAvgColor(liveAvg ?? 0.5, stops);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engine.ready.current) return;

    const key = JSON.stringify({ css, perShapeFill });
    if (key === lastKeyRef.current) return;

    engine.controls.current?.setFieldStyle?.(
      perShapeFill ? { color: css, perShapeFill } : { color: css }
    );
    engine.controls.current?.setFieldVisible?.(true);

    lastKeyRef.current = key;
    if (enableConsole) console.log('[Canvas] color:', liveAvg, '→', css, perShapeFill ? '(per-shape fills)' : '');
  }, [engine, css, liveAvg, enableConsole, perShapeFill]);
}
