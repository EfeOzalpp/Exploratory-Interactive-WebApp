// src/canvas-engine/multi-canvas-setup/types.ts
import type { SceneProfile } from "./sceneProfile.ts";
import type { SceneMode } from "../adjustable-rules/sceneRuleSets.ts";

export type SceneRuleSet = {
  id: string;
  getProfile: (mode: SceneMode) => SceneProfile;
};
