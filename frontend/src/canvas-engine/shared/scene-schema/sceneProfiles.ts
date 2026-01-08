// src/canvas-engine/shared/scene-schema/sceneProfiles.ts
import type { HostId } from "../../multi-canvas-setup/ids.ts";
import type { SceneMode, SceneProfile } from "./sceneProfile.ts";
import type { SceneKey } from "./resolveSceneKey.ts";

import { CANVAS_PADDING } from "./canvasPadding.ts";
import { SHAPE_BANDS, SHAPE_BANDS_Q, SHAPE_BANDS_OVERLAY } from "./placementRules.ts";
import { SHAPE_META } from "./shapeMeta.ts";

const baseMeta = SHAPE_META;

function mergeBands(base: any, patch: any) {
  // merge only at 2-level depth: device -> shape
  const out: any = {};
  for (const device of Object.keys(base ?? {})) {
    out[device] = { ...(base?.[device] ?? {}) };
  }
  for (const device of Object.keys(patch ?? {})) {
    out[device] = out[device] ?? {};
    for (const shape of Object.keys(patch?.[device] ?? {})) {
      out[device][shape] = patch[device][shape];
    }
  }
  return out;
}

function overlayProfile(): SceneProfile {
  return {
    padding: CANVAS_PADDING.overlay,
    bands: mergeBands(SHAPE_BANDS, SHAPE_BANDS_OVERLAY),
    shapeMeta: baseMeta,
  };
}

function introStart(): SceneProfile {
  return { padding: CANVAS_PADDING.start, bands: SHAPE_BANDS, shapeMeta: baseMeta };
}

function introQuestionnaire(): SceneProfile {
  return {
    padding: CANVAS_PADDING.questionnaire,
    bands: mergeBands(SHAPE_BANDS, SHAPE_BANDS_Q),
    shapeMeta: baseMeta,
  };
}

const HOSTS: HostId[] = ["intro", "city"];
const MODES: SceneMode[] = ["start", "questionnaire", "overlay"];

export const SCENE_PROFILES: Record<SceneKey, SceneProfile> = Object.fromEntries(
  HOSTS.flatMap((h) =>
    MODES.map((m) => {
      const key = `${h}:${m}` as SceneKey;

      // Host-specific mapping rules:
      if (h === "intro") {
        if (m === "start") return [key, introStart()];
        if (m === "questionnaire") return [key, introQuestionnaire()];
        return [key, overlayProfile()];
      }

      // city: treat all modes as overlay until you define real variants
      return [key, overlayProfile()];
    })
  )
) as Record<SceneKey, SceneProfile>;
