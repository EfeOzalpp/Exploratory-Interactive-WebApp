// src/canvas-engine/multi-canvas-setup/resolveHost.ts
import type { HostId } from "./ids.ts";
import { HOST_DEFS } from "./hostDefs.ts";

export type ResolvedHost = {
  id: HostId;
  mount: string;
  zIndex: number;
  dprMode: "auto" | "cap2" | "cap1_5" | "fixed1";
  stopOnOpenMounts: string[];
  sceneBaseMode: "start" | "overlay";
};

export function resolveHost(id: HostId): ResolvedHost {
  const def = HOST_DEFS[id];
  if (!def) throw new Error(`Unknown HostId: ${id}`);

  const stopOnOpenMounts =
    def.stopOnOpen?.map((hid) => HOST_DEFS[hid]?.mount).filter(Boolean) ?? [];

  return {
    id,
    mount: def.mount,
    zIndex: def.zIndex,
    dprMode: def.dprMode,
    stopOnOpenMounts,
    sceneBaseMode: def.scene?.baseMode ?? "start",
  };
}
