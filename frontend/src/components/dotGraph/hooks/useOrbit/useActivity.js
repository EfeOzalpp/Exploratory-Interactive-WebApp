import { useRef, useCallback } from 'react';

export default function useActivity({ startOnLoad = true, delayMs = 10000 } = {}) {
  const hasInteractedRef = useRef(false);
  const lastActivityRef  = useRef(performance.now());

  const markActivity = useCallback(() => {
    hasInteractedRef.current = true;
    lastActivityRef.current = performance.now();
  }, []);

  const isIdle = useCallback(({ userInteracting, hasInteractedRef: hRef, lastActivityRef: lRef }) => {
    const now = performance.now();
    const timeSince = now - (lRef?.current ?? lastActivityRef.current);
    return (
      (!((hRef?.current) ?? hasInteractedRef.current) && startOnLoad && !userInteracting) ||
      (((hRef?.current) ?? hasInteractedRef.current) && !userInteracting && timeSince >= delayMs)
    );
  }, [startOnLoad, delayMs]);

  return { hasInteractedRef, lastActivityRef, markActivity, isIdle };
}