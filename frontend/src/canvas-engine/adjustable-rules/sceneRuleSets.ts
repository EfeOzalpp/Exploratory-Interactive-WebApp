// sceneRuleSets.ts
import type { SceneMode, SceneProfile } from "../multi-canvas-setup/sceneProfile.ts";

import { CANVAS_PADDING } from "./canvasPadding.ts";
import { SHAPE_BANDS } from "./placementRules.ts";
import { SHAPE_META } from "./shapeMeta.ts";

import { POOL_SIZES } from "./poolSizes.ts";
import { QUOTA_CURVES } from "./quotaSpecification.ts";

import { defineRuleSet } from "../validation/index.ts";

/** ---------- INTRO ---------- */

const introStart = (): SceneProfile => ({
  padding: CANVAS_PADDING.start,
  bands: SHAPE_BANDS.start,
  shapeMeta: SHAPE_META,
  poolSizes: POOL_SIZES,
  quotaCurves: QUOTA_CURVES.default,
});

const introQuestionnaire = (): SceneProfile => ({
  padding: CANVAS_PADDING.questionnaire,
  bands: SHAPE_BANDS.questionnaire,
  shapeMeta: SHAPE_META,
  poolSizes: POOL_SIZES,
  quotaCurves: QUOTA_CURVES.default,
});

/** ---------- CITY ---------- */

const cityOverlay = (): SceneProfile => ({
  padding: CANVAS_PADDING.overlay,
  bands: SHAPE_BANDS.overlay,
  shapeMeta: SHAPE_META,
  poolSizes: POOL_SIZES,
  quotaCurves: QUOTA_CURVES.overlay,
});

/** ---------- EXPORT ---------- */

export const SCENE_RULESETS = {
  intro: defineRuleSet("intro", (mode: SceneMode) => {
    if (mode === "start") return introStart();
    if (mode === "questionnaire") return introQuestionnaire();
    throw new Error(`[intro] unsupported mode "${mode}".`);
  }),

  city: defineRuleSet("city", (_mode: SceneMode) => cityOverlay()),
} as const;
