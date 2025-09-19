// src/utils/useAbsoluteScore.ts
import { useMemo } from 'react';

// Minimal shape your data already has
type WithWeights = { _id?: string; weights?: Record<string, number>; avgWeight?: number };

export type AbsoluteOpts = {
  accessor?: (x: WithWeights) => number; // default avgWeightOf
  idOf?: (x: WithWeights) => string | undefined; // default x._id
  decimals?: number; // round to N decimals when returning 0..100 scores
};

/** prefer server avgWeight; otherwise mean(weights); fallback 0.5 */
const avgWeightOf = (item: WithWeights): number => {
  if (Number.isFinite(item?.avgWeight)) return item!.avgWeight!;
  const vals = Object.values(item?.weights || {});
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
};

const toScore100 = (v: number, decimals = 0) => {
  const clamped = Math.max(0, Math.min(1, v));
  const raw = clamped * 100;
  const pow = Math.pow(10, decimals);
  return Math.round(raw * pow) / pow;
};

/**
 * Absolute score hook (no pool comparison).
 * Returns 0..100 for a value, id, or item.
 */
export function useAbsoluteScore<T extends { _id?: string }>(
  items: T[],
  opts?: AbsoluteOpts
) {
  const accessor = (opts?.accessor as ((x: T) => number)) ?? (avgWeightOf as (x: any) => number);
  const idOf = (opts?.idOf as ((x: T) => string | undefined)) ?? ((x: T) => x._id);
  const decimals = opts?.decimals ?? 0;

  const idToValue = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => {
      const id = idOf(it);
      if (id) map.set(id, accessor(it));
    });
    return map;
  }, [items, accessor, idOf]);

  const getForValue = (value: number) => toScore100(value, decimals);

  const getForId = (id?: string) => {
    if (!id || !idToValue.has(id)) return 0;
    return getForValue(idToValue.get(id)!);
  };

  const getForItem = (item: T) => {
    const id = idOf(item);
    const v = accessor(item);
    return getForValue(v);
    // (We don't exclude self because this is absolute, not relative.)
  };

  return { getForId, getForItem, getForValue };
}
