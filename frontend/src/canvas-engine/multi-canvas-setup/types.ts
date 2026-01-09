// src/canvas-engine/multi-canvas-setup/types.ts
import type { SceneMode, SceneProfile } from "./sceneProfile.ts";

export type SceneRuleSet = {
  id: string;
  getProfile: (mode: SceneMode) => SceneProfile;
};
