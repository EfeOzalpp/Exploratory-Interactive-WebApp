import { useMemo } from 'react';

// minimal shape your data already has
type WithWeights = { _id?: string; weights?: Record<string, number>; avgWeight?: number };

export type TiePolicy = 'strict' | 'lte';

/** prefer server avgWeight; otherwise mean(weights); fallback 0.5 */
export const avgWeightOf = (item: WithWeights): number => {
  if (Number.isFinite(item?.avgWeight)) return item!.avgWeight!;
  const vals = Object.values(item?.weights || {});
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
};

export function useRelativePercentiles<T extends { _id?: string }>(
  items: T[],
  opts?: {
    accessor?: (x: T) => number;            // default avgWeightOf
    tie?: TiePolicy;                         // default 'strict'
    idOf?: (x: T) => string | undefined;     // default x._id
  }
) {
  const accessor = (opts?.accessor as ((x: T) => number)) ?? (avgWeightOf as (x: any) => number);
  const tie = opts?.tie ?? 'strict';
  const idOf = (opts?.idOf as ((x: T) => string | undefined)) ?? ((x: T) => x._id);

  // Precompute once per data change
  const { sorted, idToValue } = useMemo(() => {
    const values = items.map(accessor);
    const sorted = values.slice().sort((a, b) => a - b);
    const idToValue = new Map<string, number>();
    items.forEach((it) => {
      const id = idOf(it);
      if (id) idToValue.set(id, accessor(it));
    });
    return { sorted, idToValue };
  }, [items, accessor, idOf]);

  // binary searches
  const lowerBound = (v: number) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo; // first index >= v
  };
  const upperBound = (v: number) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo; // first index > v
  };

  const belowCount = (v: number) => (tie === 'strict' ? lowerBound(v) : upperBound(v));

  /** % of pool below value; optionally exclude one id (e.g., self) */
  const getForValue = (value: number, excludeId?: string) => {
    if (!sorted.length || !Number.isFinite(value)) return 0;

    let pool = sorted.length;
    let cnt = belowCount(value);

    if (excludeId && idToValue.has(excludeId)) {
      const ex = idToValue.get(excludeId)!;
      pool -= 1;
      if (tie === 'strict') {
        if (ex < value) cnt -= 1;
      } else {
        if (ex <= value) cnt -= 1;
      }
    }
    if (pool <= 0) return 0;
    return Math.round((cnt / pool) * 100);
  };

  /** raw count below; optionally exclude one id (e.g., self) */
  const getCountForValue = (value: number, excludeId?: string) => {
    if (!sorted.length || !Number.isFinite(value)) return 0;

    let cnt = belowCount(value);

    if (excludeId && idToValue.has(excludeId)) {
      const ex = idToValue.get(excludeId)!;
      if (tie === 'strict') {
        if (ex < value) cnt -= 1;
      } else {
        if (ex <= value) cnt -= 1;
      }
    }
    return Math.max(0, cnt);
  };

  /** effective pool size used when excluding self (for messaging) */
  const getPoolSize = (excludeId?: string) =>
    Math.max(0, sorted.length - (excludeId && idToValue.has(excludeId) ? 1 : 0));

  /** % below for a given entry id (self excluded automatically). returns 0 if not found */
  const getForId = (id?: string) => {
    if (!id || !idToValue.has(id)) return 0;
    return getForValue(idToValue.get(id)!, id);
  };

  /** count below for a given entry id (self excluded automatically). returns 0 if not found */
  const getCountForId = (id?: string) => {
    if (!id || !idToValue.has(id)) return 0;
    return getCountForValue(idToValue.get(id)!, id);
  };

  /** % below for a data object (self excluded if it has an id) */
  const getForItem = (item: T) => {
    const id = idOf(item);
    const v = accessor(item);
    return getForValue(v, id);
  };

  /** count below for a data object (self excluded if it has an id) */
  const getCountForItem = (item: T) => {
    const id = idOf(item);
    const v = accessor(item);
    return getCountForValue(v, id);
  };

  return {
    // existing percentile API
    getForId,
    getForItem,
    getForValue,
    // new counts API
    getCountForId,
    getCountForItem,
    getCountForValue,
    getPoolSize,
  };
}
