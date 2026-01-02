// src/canvas/hooks/useViewportKey.ts
import { useEffect, useRef, useState } from 'react';

export function useViewportKey(delay = 120) {
  const [key, setKey] = useState(0);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setKey((k) => k + 1);
    const on = () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(tick, delay) as any;
    };

    window.addEventListener('resize', on, { passive: true });
    window.addEventListener('orientationchange', on, { passive: true });
    (window as any).visualViewport?.addEventListener?.('resize', on, { passive: true });

    // fire once on mount so we have an initial key
    tick();

    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      (window as any).visualViewport?.removeEventListener?.('resize', on);
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [delay]);

  return key;
}
