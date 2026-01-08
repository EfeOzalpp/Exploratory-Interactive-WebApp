// src/canvas-engine/shared/scene-schema/resolveSceneKey.ts
import type { HostId } from "../../multi-canvas-setup/ids.ts";
import type { SceneMode } from "./sceneProfile.ts";

export type SceneKey = `${HostId}:${SceneMode}`;

export function resolveSceneKey(
  hostId: HostId,
  signals: { questionnaireOpen: boolean },
  opts?: { baseMode?: "start" | "overlay" }
): SceneKey {
  const base: SceneMode = opts?.baseMode ?? "start";
  const mode: SceneMode = signals.questionnaireOpen ? "questionnaire" : base;
  return `${hostId}:${mode}` as SceneKey;
}
