// src/canvas-engine/condition/types.ts
// Condition-module-specific types live here

// condition/types.ts
import type { ConditionKind, ShapeName, Size } from "./domain.ts";

export type PoolItem = { id: number; cond: ConditionKind };
export type PlanEntry = { shape: ShapeName; size: Size };
export type PlanMap = Map<number, PlanEntry>;
