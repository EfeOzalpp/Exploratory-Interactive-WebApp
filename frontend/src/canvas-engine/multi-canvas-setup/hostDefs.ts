// multi-canvas-setup/hostDefs.ts
import { SCENE_RULESETS } from "../adjustable-rules/sceneRuleSets.ts";
import type { SceneRuleSet } from "./types.ts";

export type DprMode = "auto" | "cap2" | "cap1_5" | "fixed1";
export type BaseSceneMode = "start" | "overlay";

// Base shape must NOT reference HostId (no circular types)
type HostDefBase = {
  mount: string;
  zIndex: number;
  dprMode: DprMode;
  stopOnOpen?: readonly string[]; 
  scene?: {
    baseMode?: BaseSceneMode;
    ruleset: SceneRuleSet;
  };
};

const defineHosts = <T extends Record<string, HostDefBase>>(t: T) => t;

export const HOST_DEFS = defineHosts({
  intro: {
    mount: "#canvas-root",
    zIndex: 2,
    dprMode: "auto",
    scene: { baseMode: "start", ruleset: SCENE_RULESETS.intro },
  },

  city: {
    mount: "#city-canvas-root",
    zIndex: 60,
    dprMode: "auto",
    stopOnOpen: ["intro"],
    scene: { baseMode: "overlay", ruleset: SCENE_RULESETS.city },
  },
} as const);

// Now it's safe to derive HostId
export type HostId = keyof typeof HOST_DEFS;

// Public type: tighten stopOnOpen for consumers
export type HostDef = Omit<HostDefBase, "stopOnOpen"> & {
  stopOnOpen?: readonly HostId[];
};
