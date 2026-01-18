import type { PLike } from "../p/makeP.ts";
import type { EngineFieldItem } from "../types.ts";
import type { ShapeRegistry } from "./registry.ts";

export function drawItemFromRegistry(registry: ShapeRegistry, p: PLike, it: EngineFieldItem, rEff: number, opts: any) {
  const fn = registry.get(it.shape);
  if (!fn) {
    if (process.env.NODE_ENV !== "production") console.warn("Unknown shape:", it.shape, it);
    return;
  }
  fn(p, it, rEff, opts);
}
