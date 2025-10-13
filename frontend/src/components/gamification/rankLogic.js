// src/components/dotGraph/utils/rankLogic.js

import { avgWeightOf } from '../../utils/useRelativePercentiles.ts';

/**
 * ---- WHY THIS CHANGE? -----------------------------------------------
 * Your UI rounds to an integer display percent (e.g., 53),
 * but old tie logic compared raw averages (e.g., 0.532 vs 0.534).
 * Now we compute a *display key* per entry (the same integer the UI shows)
 * and do *all* tie comparisons on that key.
 * ---------------------------------------------------------------------
 */

/**
 * A safe default display function if the caller forgets to pass one.
 * NOTE: This is only a fallback. In RELATIVE mode you *must* pass a
 * mode-aware function that returns the exact integer you render.
 */
function defaultDisplayPercentOf(item) {
  const avg = avgWeightOf(item);          // 0..1
  const pct = Math.round((Number(avg) || 0) * 100); // 0..100
  return Math.max(0, Math.min(100, pct));
}

/**
 * Build a stable integer key for bucketing and comparisons.
 * Uses the provided displayPercentOf; falls back to default if missing.
 */
function keyOf(item, displayPercentOf) {
  const fn = displayPercentOf || defaultDisplayPercentOf;
  const k = Math.round(Number(fn(item)) || 0);
  return Math.max(0, Math.min(100, k)); // clamp to [0,100]
}

/**
 * Compute tie-aware stats based on the *display bucket* (integer percent).
 * Excludes the target id from counting so "equal" is "others with my displayed score".
 *
 * @param {Object} params
 * @param {Array<Object>} params.data         - array of entries
 * @param {string=} params.targetId           - id of target entry
 * @param {number=} params.targetDisplay      - optional explicit display key (0..100)
 * @param {(item: any) => number=} params.displayPercentOf - function returning the exact integer shown in the UI
 *
 * @returns {{ below: number, equal: number, above: number, totalOthers: number, refKey: number }}
 */
export function getTieStats({ data, targetId, targetDisplay, displayPercentOf } = {}) {
  if (!Array.isArray(data) || (!targetId && !Number.isFinite(targetDisplay))) {
    return { below: 0, equal: 0, above: 0, totalOthers: 0, refKey: 0 };
  }

  let me = null;
  if (targetId) me = data.find(d => d && d._id === targetId) || null;

  // The reference key is exactly what the UI shows for the target (0..100)
  const refKey = Number.isFinite(targetDisplay)
    ? Math.max(0, Math.min(100, Math.round(targetDisplay)))
    : (me ? keyOf(me, displayPercentOf) : 0);

  let below = 0, equal = 0, above = 0;

  for (const d of data) {
    if (!d || (me && d._id === me._id)) continue;
    const k = keyOf(d, displayPercentOf);
    if (k < refKey) below++;
    else if (k > refKey) above++;
    else equal++;
  }

  return { below, equal, above, totalOthers: below + equal + above, refKey };
}

/**
 * Position classification using counts computed on the *display bucket*.
 * Keeps your previous semantics, but now ties reflect what users see.
 *
 * @param {{ below: number, equal: number, above: number }} stats
 * @returns {{ position: 'solo'|'top'|'bottom'|'middle'|'middle-above'|'middle-below', tieContext: 'none'|'top'|'bottom'|'middle' }}
 */
export function classifyPosition({ below, equal, above }) {
  const totalOthers = below + equal + above;
  if (totalOthers === 0) return { position: 'solo', tieContext: 'none' };

  if (above === 0 && equal === 0) return { position: 'top', tieContext: 'none' };
  if (below === 0 && equal === 0) return { position: 'bottom', tieContext: 'none' };

  // Ties:
  if (above === 0 && equal > 0)  return { position: 'top', tieContext: 'top' };
  if (below === 0 && equal > 0)  return { position: 'bottom', tieContext: 'bottom' };

  // Middle bands (some above, some below)
  if (equal > 0) return { position: 'middle', tieContext: 'middle' };

  // No tie, in the middle: which half?
  if (below > above) return { position: 'middle-above', tieContext: 'none' }; // upper half
  if (above > below) return { position: 'middle-below', tieContext: 'none' }; // lower half
  return { position: 'middle', tieContext: 'none' }; // perfectly balanced
}

/**
 * Convenience: build tie buckets by the *display key*.
 * Returns Map<integerPercent, string[] of ids> for groups with size > 1.
 */
export function buildTieBuckets(data, displayPercentOf) {
  const map = new Map();
  if (!Array.isArray(data) || data.length === 0) return map;

  for (const d of data) {
    if (!d) continue;
    const k = keyOf(d, displayPercentOf);
    const arr = map.get(k) || [];
    arr.push(d._id);
    map.set(k, arr);
  }

  // Keep only actual ties
  for (const [k, arr] of map) {
    if (!arr || arr.length <= 1) map.delete(k);
  }
  return map;
}
