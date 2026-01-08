// src/canvas-engine/condition/conditions.ts

import { hash32 } from "../shared/utils/hash32.ts";
import type { ConditionKind, Variant } from "./types.ts";
import { CONDITIONS } from "./specification.ts";

export { CONDITIONS };

/**
 * Deterministic variant picker by (kind, id, salt).
 * If a kind has exactly two variants, a single hash bit is used for stable 50/50 behavior.
 */
export function pickVariant(kind: ConditionKind, id: number, salt = 0): Variant {
  const spec = CONDITIONS[kind];
  const n = spec.variants.length;
  if (n === 0) throw new Error(`No variants for kind ${kind}`);

  const h = hash32(kind, id, salt);

  if (n === 2) return (h & 1) === 0 ? spec.variants[0] : spec.variants[1];
  return spec.variants[h % n];
}
