// src/canvas/layout/scene-composition/plan.ts
import type { ConditionKind, CurveSet, ShapeName, Size } from '../../condition-utils/types.ts';

import {
  interpolateConditionMix20,
  scaleMixToCount,
  adjustConditionsStable,
} from '../../condition-utils/conditionMix.ts';

import { planForBucket, type PoolItem as PlannerPoolItem } from '../../condition-utils/conditionPlanner.ts';

export type PlannedPoolItem = PlannerPoolItem & {
  shape?: ShapeName;
  size?: Size;
};

export function retargetKindsStable(
  pool: PlannedPoolItem[],
  u: number,
  desiredSize: number
) {
  const float20 = interpolateConditionMix20(u);
  const targetCounts = scaleMixToCount(float20, desiredSize);

  const currentKinds = pool.map((p) => p.cond);
  const newKinds = adjustConditionsStable(currentKinds, targetCounts);

  for (let i = 0; i < pool.length; i++) {
    pool[i].cond = (newKinds[i] ?? pool[i].cond) as ConditionKind;
  }
}

export function assignShapesByPlanner(
  pool: PlannedPoolItem[],
  u: number,
  salt: number,
  curveSet: CurveSet
) {
  const byKind: Record<ConditionKind, PlannedPoolItem[]> = { A: [], B: [], C: [], D: [] };
  for (const it of pool) byKind[it.cond].push(it);

  (['A', 'B', 'C', 'D'] as ConditionKind[]).forEach((kind) => {
    const items = byKind[kind];
    if (!items.length) return;

    const map = planForBucket(kind, items, u, salt, curveSet);
    for (const p of pool) {
      if (p.cond !== kind) continue;
      const asn = map.get(p.id);
      if (asn) {
        p.shape = asn.shape;
        p.size = asn.size;
      }
    }
  });
}
