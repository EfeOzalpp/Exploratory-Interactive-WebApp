// src/canvas-engine/adjustable-rules/defineRuleSet.ts
import type { SceneProfile } from "./sceneProfile.ts";
import type { SceneRuleSet } from "./types.ts";
import type { SceneMode } from "../adjustable-rules/sceneRuleSets.ts";
import { validateSceneProfile } from "../validation/validateSceneProfile.ts";

export function defineRuleSet(
  id: string,
  getProfile: (mode: SceneMode) => SceneProfile
): SceneRuleSet {
  return {
    id,
    getProfile: (mode) => {
      const profile = getProfile(mode);
      validateSceneProfile(id, mode, profile);
      return profile;
    },
  };
}
