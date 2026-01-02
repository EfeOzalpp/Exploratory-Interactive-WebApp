// src/components/dotGraph/hooks/useObserverDelay.js
import { useEffect, useRef, useState } from 'react';

export default function useObserverDelay(observerMode, delayMs = 2000) {
  const [showCompleteUI, setShowCompleteUI] = useState(!observerMode);
  const t = useRef(null);

  useEffect(() => {
    if (t.current) { clearTimeout(t.current); t.current = null; }
    if (observerMode) {
      setShowCompleteUI(false);
    } else {
      t.current = setTimeout(() => { setShowCompleteUI(true); t.current = null; }, delayMs);
    }
    return () => t.current && clearTimeout(t.current);
  }, [observerMode, delayMs]);

  return showCompleteUI;
}
