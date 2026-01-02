// src/components/survey/questions/SelectionHooks/usePointerDrag.ts
import { useRef } from 'react';

export function usePointerDrag() {
  const activePointerIdRef = useRef<number | null>(null);

  const start = (
    svgEl: SVGSVGElement,
    e: React.PointerEvent<SVGGElement> | React.PointerEvent<SVGSVGElement>,
    onMove: (ev: PointerEvent) => void,
    onEnd: (ev: PointerEvent) => void
  ) => {
    activePointerIdRef.current = e.pointerId;

    try { svgEl.setPointerCapture(e.pointerId); } catch {}

    const move = (ev: PointerEvent) => {
      if (activePointerIdRef.current == null || ev.pointerId !== activePointerIdRef.current) return;
      onMove(ev);
      if ((ev as any).cancelable) ev.preventDefault();
    };

    const end = (ev: PointerEvent) => {
      if (activePointerIdRef.current == null || ev.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      onEnd(ev);
    };

    // Initial frame
    onMove(e.nativeEvent as unknown as PointerEvent);

    // Global listeners (capture phase)
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);

    return { move, end };
  };

  return { start };
}
