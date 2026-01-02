// src/canvas-engine/hooks/useViewportKey.ts
import { useEffect, useRef, useState } from 'react';

export function useViewportKey(delay = 120) {
  const [key, setKey] = useState(0);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tick = () => setKey((k) => k + 1);

    const on = () => {
      if (tRef.current != null) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(tick, delay) as unknown as number;
    };

    const vv: VisualViewport | undefined = (window as any).visualViewport;

    // capture=false for all; passive is fine but not required for resize events
    window.addEventListener('resize', on, { passive: true });
    window.addEventListener('orientationchange', on, { passive: true });
    vv?.addEventListener?.('resize', on, { passive: true });

    tick();

    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      vv?.removeEventListener?.('resize', on);
      if (tRef.current != null) window.clearTimeout(tRef.current);
    };
  }, [delay]);

  return key;
}
