// sceneRuleSets.ts
import type { SceneMode, SceneProfile } from "../multi-canvas-setup/sceneProfile.ts";

import { CANVAS_PADDING } from "./canvasPadding.ts";
import { SHAPE_BANDS, SHAPE_BANDS_Q, SHAPE_BANDS_OVERLAY } from "./placementRules.ts";
import { SHAPE_META } from "./shapeMeta.ts";

import { POOL_SIZES } from "./poolSizes.ts";
import { QUOTA_CURVES_DEFAULT, QUOTA_CURVES_OVERLAY } from "./quotaSpecification.ts";

import { defineRuleSet } from "../validation/index.ts";

/** ---------- INTRO ---------- */

const introStart = (): SceneProfile => ({
  padding: CANVAS_PADDING.start,
  bands: SHAPE_BANDS,
  shapeMeta: SHAPE_META,

  poolSizes: POOL_SIZES,
  quotaCurves: QUOTA_CURVES_DEFAULT,
});

const introQuestionnaire = (): SceneProfile => ({
  padding: CANVAS_PADDING.questionnaire,
  bands: SHAPE_BANDS_Q,
  shapeMeta: SHAPE_META,

  poolSizes: POOL_SIZES,
  quotaCurves: QUOTA_CURVES_DEFAULT,
});

/** ---------- CITY ---------- */

const cityOverlay = (): SceneProfile => ({
  padding: CANVAS_PADDING.overlay,
  bands: SHAPE_BANDS_OVERLAY,
  shapeMeta: SHAPE_META,

  poolSizes: POOL_SIZES,
  quotaCurves: QUOTA_CURVES_OVERLAY,
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
