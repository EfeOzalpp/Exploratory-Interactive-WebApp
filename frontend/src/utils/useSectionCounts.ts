import { useEffect, useState } from "react";
import { subscribeSectionCounts } from "./sanityAPI";

/**
 * Hook to get live per-section submission counts.
 * Internally uses subscribeSectionCounts (SSE + polling fallback).
 */
export type SectionCounts = Record<string, number>;

export default function useSectionCounts() {
  const [counts, setCounts] = useState<SectionCounts>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const unsub = subscribeSectionCounts({
      onData: (c: SectionCounts) => {
        if (!mounted) return;
        setCounts(c || {});
        setLoading(false);
      },
    });

    return () => {
      mounted = false;
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  return { counts, loading };
}
