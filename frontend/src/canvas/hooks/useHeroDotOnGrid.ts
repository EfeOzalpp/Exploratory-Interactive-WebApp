// src/canvas/hooks/useHeroDotOnGrid.ts
import { useEffect, useRef } from 'react';
import { bandFromWidth, GRID_MAP } from '../grid/config.ts';
import { makeCenteredSquareGrid } from '../grid/layoutCentered.ts';

type Engine = { ready: React.MutableRefObject<boolean>; controls: React.MutableRefObject<any> };

const clamp01 = (v: number | undefined) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

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
 * Places the hero dot on a centered square grid:
 * - Chooses the middle row of the "used" rows (useTopRatio)
 * - Maps liveAvg (0..1) to column 0..cols-1
 * - Sets dot position to the center of that cell
 */
export function useHeroDotOnGrid(engine: Engine, liveAvg: number | undefined) {
  const tRef = useRef(clamp01(liveAvg));
  tRef.current = clamp01(liveAvg);

  const place = () => {
    if (!engine?.ready?.current) return;

    const canvas = engine.controls.current?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    const w = Math.round(rect?.width ?? window.innerWidth);
    const h = Math.round(rect?.height ?? window.innerHeight);

    const spec = GRID_MAP[bandFromWidth(w)];
    const useTop = spec.useTopRatio ?? 1;

    const { cell, rows, cols } = makeCenteredSquareGrid({
      w, h,
      rows: spec.rows,
      useTopRatio: useTop,
    });

    if (!rows || !cols || !cell) return;

    // choose the middle row within the used portion
    const usedRows = Math.max(1, Math.round(rows * useTop));
    const midRowIdxWithinUsed = Math.floor((usedRows - 1) / 2);
    const row = midRowIdxWithinUsed; // 0-based inside used region (top portion)

    // map avg → column
    const col = Math.round(tRef.current * (cols - 1));

    // convert row inside "used" portion to absolute row index
    const rowAbs = row; // because used area starts at row 0 (top)

    const x = col * cell + cell / 2;
    const y = rowAbs * cell + cell / 2;

    engine.controls.current?.setDot?.({ x, y, visible: true });
  };

  useEffect(() => { place(); /* eslint-disable-next-line */ }, [engine, liveAvg]);
  useDebouncedViewport(place, 120);
}
