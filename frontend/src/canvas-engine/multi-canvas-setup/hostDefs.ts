// src/canvas-engine/multi-canvas-setup/hostDefs.ts
import type { HostId } from "./ids.ts";

export type DprMode = "auto" | "cap2" | "cap1_5" | "fixed1";
export type BaseSceneMode = "start" | "overlay";

export type HostDef = {
  mount: string;
  zIndex: number;
  dprMode: DprMode;
  stopOnOpen?: HostId[];
  scene?: { baseMode?: BaseSceneMode };
};

export const HOST_DEFS: Record<HostId, HostDef> = {
  intro: {
    mount: "#canvas-root",
    zIndex: 2,
    dprMode: "auto",
  },
  city: {
    mount: "#city-canvas-root",
    zIndex: 60,
    dprMode: "auto",
    stopOnOpen: ["intro"], // other canvases to stop on its mount. 
    scene: { baseMode: "overlay" },
  },
};
