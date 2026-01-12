// src/canvas-engine/condition/pickConditionVariants.ts

import { hash32 } from "../shared/hash32.ts";

import type { ConditionKind, Variant } from "./domain.ts";
import { CONDITIONS } from "./domain.ts";

export function pickVariant(kind: ConditionKind, id: number, salt = 0): Variant {
  const spec = CONDITIONS[kind];
  const n = spec.variants.length;
  if (n === 0) throw new Error(`No variants for kind ${kind}`);

  const h = hash32(kind, id, salt);

  if (n === 2) return (h & 1) === 0 ? spec.variants[0] : spec.variants[1];
  return spec.variants[h % n];
}
