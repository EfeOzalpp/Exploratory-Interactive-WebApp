// src/utils/useGamificationPools.ts
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { cdnClient, liveClient } from './sanityClient';
import { storageKeyFor, safeSession, bucketForPercent } from './hooks.ts';

type Doc = {
  _id: string;
  _updatedAt: string;
  range?: { minPct: number; maxPct: number };
  titles?: string[];
  secondary?: string[];
  enabled?: boolean;
};

type PoolState = {
  docs: Doc[];
  rev: string;      // increments when docs change (use _updatedAt max)
  loaded: boolean;  // true after first live fetch completes
};

const buildQuery = (schemaName: string) => `
*[
  !(_id in path('drafts.**')) &&
  _type == "${schemaName}" &&
  enabled == true
]{
  _id, _updatedAt, range, titles, secondary
}
`;

/** Simple store util */
function createStore(initial: PoolState) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (next: Partial<PoolState>) => {
      state = { ...state, ...next };
      subs.forEach((fn) => fn());
    },
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** One singleton per schema */
function createPool(schemaName: 'gamificationGeneralCopy' | 'gamificationPersonalizedCopy') {
  const store = createStore({ docs: [], rev: 'v0', loaded: false });
  let started = false;
  let unsubListen: { unsubscribe?: () => void } | null = null;
  let refreshTimer: any = null;

  const start = () => {
    if (started) return;
    started = true;

    const QUERY = buildQuery(schemaName);
    const pump = (rows: Doc[]) => {
      const docs = rows || [];
      const latest = docs.reduce((m, r) => (r._updatedAt > m ? r._updatedAt : m), '');
      store.set({ docs, rev: latest || 'v1', loaded: true });
    };

    // initial live fetch
    liveClient.fetch<Doc[]>(QUERY, {}).then(pump).catch(console.error);

    // listen via cdn, then refresh live
    unsubListen = cdnClient
      .listen(QUERY, {}, { visibility: 'query' })
      .subscribe({
        next: () => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            liveClient.fetch<Doc[]>(QUERY, {}).then(pump).catch(console.error);
          }, 100);
        },
        error: console.error,
      });
  };

  const stop = () => {
    if (unsubListen) {
      unsubListen.unsubscribe?.();
      unsubListen = null;
    }
    clearTimeout(refreshTimer);
  };

  const usePool = () => {
    // Subscribe to external store (React 18 safe)
    const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
    const { docs, rev, loaded } = snapshot;

    // Build the picker from current snapshot
    const pick = useMemo(() => {
      const sorted = docs
        .filter(
          (d) =>
            d.range &&
            Array.isArray(d.titles) &&
            d.titles?.length &&
            Array.isArray(d.secondary) &&
            d.secondary?.length
        )
        .sort((a, b) => a.range!.minPct - b.range!.minPct);

      // Small Fisher–Yates
      const shuffle = <T,>(arr: T[]) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      return (
        pct: number,
        cachePrefix: string,
        id: string,
        fallback?: Record<string, { titles: string[]; secondary: string[] }>
      ) => {
        const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
        const found = sorted.find((d) => p >= d.range!.minPct && p <= d.range!.maxPct);

        // include schema + rev so cache invalidates on CMS changes
        const stableKey = storageKeyFor(`${cachePrefix}:${schemaName}:${rev}`, id, p, 'v1');

        // If this id+pct already has an assignment, return it (stability per dot)
        const cached = safeSession.get<{ title: string; secondary: string } | null>(stableKey, null);
        if (cached?.title && cached?.secondary) return cached;

        // Resolve source arrays (from CMS or fallback)
        const fbKey = fallback ? bucketForPercent(p) : null;
        const titles =
          found?.titles?.length ? found.titles : fallback ? fallback[fbKey!]?.titles : null;
        const secondary =
          found?.secondary?.length
            ? found.secondary
            : fallback
            ? fallback[fbKey!]?.secondary
            : null;

        if (!titles?.length || !secondary?.length) return null;

        // We pair titles[i] with secondary[i]; if lengths differ, clamp to min.
        const N = Math.min(titles.length, secondary.length);
        if (N <= 0) return null;

        // === NO-REPEAT BUCKET QUEUE (session-scoped, per range, per schema+rev) ===
        // Build a bucket identifier that is stable for the pct range we matched.
        const bucketId =
          found?.range
            ? `${found.range.minPct}-${found.range.maxPct}`
            : // Fallback bucket uses the coarse fb key (e.g., '41-60')
              fbKey!;

        // A pool that survives re-renders within the same session and resets on CMS rev change.
        const poolKey = storageKeyFor(
          `${schemaName}:${rev}:pool`,
          bucketId,
          0,
          'v1'
        );

        type PoolState = { queue: number[]; cursor: number };
        let pool = safeSession.get<PoolState | null>(poolKey, null);

        const resetPool = () => {
          pool = { queue: shuffle(Array.from({ length: N }, (_, i) => i)), cursor: 0 };
          safeSession.set(poolKey, pool);
        };

        if (!pool || !Array.isArray(pool.queue) || typeof pool.cursor !== 'number' || pool.queue.length !== N) {
          resetPool();
        }

        // Draw next index without replacement; reshuffle after exhausting.
        let idx = pool!.queue[pool!.cursor];
        pool!.cursor += 1;
        if (pool!.cursor >= pool!.queue.length) {
          // exhausted → reshuffle for next cycle
          resetPool();
        } else {
          safeSession.set(poolKey, pool!);
        }

        // Pair title+secondary at the same index (clamped)
        const chosen = { title: titles[idx] ?? titles[0], secondary: secondary[idx] ?? secondary[0] };

        // Cache per id+pct so a given dot stays consistent across renders
        safeSession.set(stableKey, chosen);
        return chosen;
      };
    }, [docs, rev]);

    return { pick, loaded, hasCMS: docs.length > 0, rev };
  };

  return { start, stop, usePool };
}

/** Two singletons */
const generalPool = createPool('gamificationGeneralCopy');
const personalizedPool = createPool('gamificationPersonalizedCopy');

/** Public: start both early (call once in a preloader) */
export function startGamificationCopyPreload() {
  generalPool.start();
  personalizedPool.start();
}

/** Hooks for components: they only subscribe; they WON’T start fetch if not started yet */
export function useGeneralPools() {
  // Soft guarantee: if nothing started them yet, start once here as a safety net.
  generalPool.start();
  return generalPool.usePool();
}

export function usePersonalizedPools() {
  personalizedPool.start();
  return personalizedPool.usePool();
}
