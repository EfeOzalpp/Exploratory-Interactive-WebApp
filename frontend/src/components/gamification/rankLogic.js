// src/components/dotGraph/utils/rankLogic.js

import { avgWeightOf } from '../../utils/useRelativePercentiles.ts';

// A little tolerance so floats that "should" tie… do.
const EPS = 1e-4;

/**
 * Compute tie-aware stats for a target entry id OR a raw average value.
 * Excludes the target id from counting (so equal counts are "others").
 */
export function getTieStats({ data, targetId, targetAvg }) {
  if (!Array.isArray(data) || (!targetId && !Number.isFinite(targetAvg))) {
    return { below: 0, equal: 0, above: 0, totalOthers: 0 };
  }
  const refAvg = Number.isFinite(targetAvg)
    ? targetAvg
    : avgWeightOf(data.find(d => d?._id === targetId) ?? {});

  let below = 0, equal = 0, above = 0;
  for (const d of data) {
    if (!d || d._id === targetId) continue;
    const v = avgWeightOf(d);
    if (v < refAvg - EPS) below++;
    else if (v > refAvg + EPS) above++;
    else equal++;
  }
  return { below, equal, above, totalOthers: below + equal + above, refAvg };
}

/**
 * Position classification using the tie-aware counts.
 */
export function classifyPosition({ below, equal, above }) {
  const totalOthers = below + equal + above;
  if (totalOthers === 0) return { position: 'solo', tieContext: 'none' };

  if (above === 0 && equal === 0) return { position: 'top', tieContext: 'none' };
  if (below === 0 && equal === 0) return { position: 'bottom', tieContext: 'none' };

  // Ties:
  if (above === 0 && equal > 0) return { position: 'top', tieContext: 'top' };
  if (below === 0 && equal > 0) return { position: 'bottom', tieContext: 'bottom' };

  // Middle bands (some above, some below)
  if (equal > 0)  return { position: 'middle', tieContext: 'middle' };

  // No tie, in the middle: which half?
  if (below > above)  return { position: 'middle-above', tieContext: 'none' }; // upper half
  if (above > below)  return { position: 'middle-below', tieContext: 'none' }; // lower half
  return { position: 'middle', tieContext: 'none' }; // perfectly balanced
}
