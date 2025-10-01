import { useEffect, useRef } from 'react';
import { bandFromWidth, GRID_MAP } from '../grid/config.ts';
import { makeCenteredSquareGrid } from '../grid/layoutCentered.ts';

type Engine = { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> };

const clamp01 = (v: number | undefined) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

/** V-shape count: 20 at 0/1, 10 at 0.5 (range 10..20, integer) */
function dotCountFromAvg(avg: number | undefined, cap = 20) {
  const t = clamp01(avg);
  const v = 10 + 20 * Math.abs(t - 0.5); // 10..20
  return Math.max(1, Math.min(cap, Math.round(v)));
}

/** Evenly sample K items from a list in row-major order (stable, no RNG). */
function takeEvenly<T>(arr: T[], k: number): T[] {
  if (k <= 0 || arr.length === 0) return [];
  if (k >= arr.length) return arr.slice();
  const step = arr.length / k;
  const out: T[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.min(arr.length - 1, Math.floor(i * step + step / 2));
    out.push(arr[idx]);
  }
  return out;
}

function useDebouncedViewport(cb: () => void, delay = 120) {
  const tRef = useRef<number | null>(null);
  useEffect(() => {
    const on = () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(cb, delay) as any;
    };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    (window as any).visualViewport?.addEventListener?.('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      (window as any).visualViewport?.removeEventListener?.('resize', on);
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [cb, delay]);
}

/**
 * Computes K dots from the centered grid (K derived from liveAvg),
 * and sends them to q5 via controls.setDecorPoints(...).
 */
export function useGridDotField(
  engine: Engine,
  liveAvg: number | undefined,
  opts: { cap?: number; radius?: number; color?: string } = {}
) {
  const { cap = 20, radius = 6, color = 'rgba(20,42,80,0.35)' } = opts;
  const avgRef = useRef(clamp01(liveAvg));
  avgRef.current = clamp01(liveAvg);

  const recompute = () => {
    if (!engine?.ready?.current) return;

    const canvas = engine.controls.current?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    const w = Math.round(rect?.width ?? window.innerWidth);
    const h = Math.round(rect?.height ?? window.innerHeight);

    const spec = GRID_MAP[bandFromWidth(w)];
    const { points } = makeCenteredSquareGrid({
      w, h,
      rows: spec.rows,
      useTopRatio: spec.useTopRatio ?? 1,
    });
    if (!points.length) {
      engine.controls.current?.setDecorPoints?.([]);
      return;
    }

    const k = dotCountFromAvg(avgRef.current, cap);
    const picked = takeEvenly(points, k);

    engine.controls.current?.setDecorStyle?.({ r: radius, color });
    engine.controls.current?.setDecorVisible?.(true);
    engine.controls.current?.setDecorPoints?.(picked);
  };

  useEffect(() => { recompute(); /* eslint-disable-next-line */ }, [engine, liveAvg, cap, radius, color]);
  useDebouncedViewport(recompute, 120);
}
