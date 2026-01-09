// src/canvas-engine/multi-canvas-setup/hostDefs.ts

import type { SceneRuleSet } from "../multi-canvas-setup/types.ts";
import { SCENE_RULESETS } from "../adjustable-rules/sceneRuleSets.ts";

export type DprMode = "auto" | "cap2" | "cap1_5" | "fixed1";
export type BaseSceneMode = "start" | "overlay";

export type HostDef = {
  mount: string;
  zIndex: number;
  dprMode: DprMode;
  stopOnOpen?: string[];
  scene?: {
    baseMode?: BaseSceneMode;
    ruleset: SceneRuleSet; // <— single value
  };
};
// 1: add the string value of the scene rule sets export as an object, 
// 2: pass the props needed to mount a canvas instance
// 3: use canvas-engine/EngineHost API to create canvas instances anywhere  
export const HOST_DEFS = {
  intro: {
    mount: "#canvas-root",
    zIndex: 2,
    dprMode: "auto",
    scene: {
      baseMode: "start",
      ruleset: SCENE_RULESETS.intro,
    },
  },

  city: {
    mount: "#city-canvas-root",
    zIndex: 60,
    dprMode: "auto",
    stopOnOpen: ["intro"],
    scene: {
      baseMode: "overlay",
      ruleset: SCENE_RULESETS.city,
    },
  },
} as const satisfies Record<string, HostDef>;
