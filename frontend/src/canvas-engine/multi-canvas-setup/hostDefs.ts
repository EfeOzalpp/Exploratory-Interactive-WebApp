// multi-canvas-setup/hostDefs.ts
import { SCENE_RULESETS } from "../adjustable-rules/sceneRuleSets.ts";
import type { SceneRuleSet } from "./types.ts";
import type { SceneMode } from "../adjustable-rules/sceneRuleSets.ts"

export type DprMode = "auto" | "cap2" | "cap1_5" | "fixed1";

// questionnaire exists as a state change withn start canvas, 
// therefore it is excluded from Scene Mode (start, overlay).
// If you have state changes within one canvas instance add them here.
export type BaseSceneMode = Exclude<SceneMode, "questionnaire">; 

// give the canvas the size you want
export type CanvasBounds =
  | { kind: "viewport" }                         // current behavior
  | { kind: "parent" }                           // allow canvas to fit parents dimensions
  | { kind: "fixed"; w: number; h: number }      // exact pixels

// Base shape 
type HostDefBase = {
  mount: string;
  zIndex: number;
  dprMode: DprMode;
  canvasDimensions?: CanvasBounds; 
  stopOnOpen?: readonly string[]; 
  scene?: {
    baseMode?: BaseSceneMode;
    ruleset: SceneRuleSet;
  };
};

const defineHosts = <T extends Record<string, HostDefBase>>(t: T) => t;

export const HOST_DEFS = defineHosts({
  start: {
    mount: "#canvas-root",
    zIndex: 2,
    dprMode: "cap2",
    canvasDimensions: { kind: "viewport" },
    scene: { baseMode: "start", ruleset: SCENE_RULESETS.intro },
  },

  city: {
    mount: "#city-canvas-root",
    zIndex: 60,
    dprMode: "auto",
    stopOnOpen: ["start"],
    canvasDimensions: { kind: "viewport" },
    scene: { baseMode: "overlay", ruleset: SCENE_RULESETS.city },
  },
} as const);

// Now it's safe to derive HostId
export type HostId = keyof typeof HOST_DEFS;

// Public type: tighten stopOnOpen for consumers
export type HostDef = Omit<HostDefBase, "stopOnOpen"> & {
  stopOnOpen?: readonly HostId[];
};
