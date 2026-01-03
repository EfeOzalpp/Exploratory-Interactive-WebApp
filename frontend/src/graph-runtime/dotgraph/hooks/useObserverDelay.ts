import { useEffect, useRef, useState } from 'react';

export default function useObserverDelay(observerMode: boolean, delayMs: number = 2000): boolean {
  const [showCompleteUI, setShowCompleteUI] = useState<boolean>(!observerMode);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) {
      clearTimeout(t.current);
      t.current = null;
    }

    if (observerMode) {
      setShowCompleteUI(false);
    } else {
      t.current = setTimeout(() => {
        setShowCompleteUI(true);
        t.current = null;
      }, delayMs);
    }

    return () => {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    };
  }, [observerMode, delayMs]);

  return showCompleteUI;
}
