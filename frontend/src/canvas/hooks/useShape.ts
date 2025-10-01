import { useEffect, useRef } from 'react';

type Curve = 'linear' | 'smoothstep' | 'easeOutCubic' | ((t: number) => number);

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function applyCurve(t: number, curve: Curve) {
  if (typeof curve === 'function') return clamp01(curve(clamp01(t)));
  switch (curve) {
    case 'smoothstep': { const x = clamp01(t); return x * x * (3 - 2 * x); }
    case 'easeOutCubic': { const x = 1 - clamp01(t); return 1 - x * x * x; }
    default: return clamp01(t);
  }
}

/** Maps liveAvg → radius and writes via field API (with optional per-shape scale). */
export function useShapeFromAvg(
  engine: { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> },
  liveAvg: number | undefined,
  opts: { min?: number; max?: number; curve?: Curve; enableConsole?: boolean; perShapeScale?: Partial<Record<'circle'|'triangle'|'square'|'octagon', number>> } = {}
) {
  const { min = 8, max = 28, curve = 'smoothstep', enableConsole = false, perShapeScale } = opts;
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engine?.ready?.current) return;

    const t = clamp01(liveAvg ?? 0.5);
    const k = applyCurve(t, curve);
    const rPx = Math.round(min + (max - min) * k);

    // create a stable change key so we don't spam updates
    const key = JSON.stringify({ rPx, perShapeScale });
    if (key === lastKeyRef.current) return;

    engine.controls.current?.setFieldStyle?.(
      perShapeScale ? { r: rPx, perShapeScale } : { r: rPx }
    );
    engine.controls.current?.setFieldVisible?.(true);

    lastKeyRef.current = key;
    if (enableConsole) console.log('[Canvas] radiusFromAvg:', { liveAvg, t, r: rPx, perShapeScale });
  }, [engine, liveAvg, min, max, curve, perShapeScale, enableConsole]);
}
