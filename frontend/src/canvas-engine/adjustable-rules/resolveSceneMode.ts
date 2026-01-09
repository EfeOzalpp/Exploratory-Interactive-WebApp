// src/canvas-engine/adjustable-rules/resolveSceneMode.ts
import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";

export function resolveSceneMode(
  signals: { questionnaireOpen: boolean },
  opts?: { baseMode?: "start" | "overlay" }
): SceneMode {
  const base: SceneMode = opts?.baseMode ?? "start";
  return signals.questionnaireOpen ? "questionnaire" : base;
}
