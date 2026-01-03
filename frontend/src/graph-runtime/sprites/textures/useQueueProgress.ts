// graph-runtime/sprites/textures/useQueueProgress.ts
import { useEffect, useState } from 'react';
import { getQueueCounts } from './queue.ts';

type Counts = {
  pending: number;
  inflight: number;
  paused?: boolean;
};

export default function useTextureQueueProgress() {
  const readCounts = (): Counts => {
    try {
      const { pending = 0, inflight = 0, paused = false } = getQueueCounts?.() ?? {};
      return { pending, inflight, paused };
    } catch {
      return { pending: 0, inflight: 0, paused: false };
    }
  };

  const [counts, setCounts] = useState<Counts>(() => readCounts());

  useEffect(() => {
    let rafId: number | null = null;

    const tick = () => {
      setCounts(readCounts());
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const { pending, inflight, paused } = counts;
  return {
    pending,
    inflight,
    paused: !!paused,
    isBusy: (pending + inflight) > 0,
  };
}
