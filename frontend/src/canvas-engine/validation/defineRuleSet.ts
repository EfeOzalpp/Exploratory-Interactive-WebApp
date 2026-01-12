// src/canvas-engine/validation/defineRuleSet.ts

import type { SceneMode, SceneProfile } from "../multi-canvas-setup/sceneProfile.ts";
import { validateSceneProfile } from "./validateSceneProfile.ts";
import type { SceneRuleSet } from "../multi-canvas-setup/types.ts";

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