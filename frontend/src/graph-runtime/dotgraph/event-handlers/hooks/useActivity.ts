// src/graph-runtime/dotgraph/event-handlers/useActivity.ts
import { useRef, useCallback } from 'react';
import type { RefObject } from 'react';

export type UseActivityParams = {
  startOnLoad?: boolean;
  delayMs?: number;
};

export type IsIdleArgs = {
  userInteracting: boolean;
  hasInteractedRef?: RefObject<boolean>;
  lastActivityRef?: RefObject<number>;
};

export type UseActivityReturn = {
  hasInteractedRef: RefObject<boolean>;
  lastActivityRef: RefObject<number>;
  markActivity: () => void;
  isIdle: (args: IsIdleArgs) => boolean;
};

export default function useActivity(
  { startOnLoad = true, delayMs = 10000 }: UseActivityParams = {}
): UseActivityReturn {
  const hasInteractedRef = useRef(false);
  const lastActivityRef = useRef(performance.now());

  const markActivity = useCallback(() => {
    hasInteractedRef.current = true;
    lastActivityRef.current = performance.now();
  }, []);

  const isIdle = useCallback(
    ({ userInteracting, hasInteractedRef: hRef, lastActivityRef: lRef }: IsIdleArgs) => {
      const now = performance.now();
      const timeSince = now - (lRef?.current ?? lastActivityRef.current);
      const interacted = (hRef?.current ?? hasInteractedRef.current) ?? false;

      return (
        (!interacted && startOnLoad && !userInteracting) ||
        (interacted && !userInteracting && timeSince >= delayMs)
      );
    },
    [startOnLoad, delayMs]
  );

  return { hasInteractedRef, lastActivityRef, markActivity, isIdle };
}
