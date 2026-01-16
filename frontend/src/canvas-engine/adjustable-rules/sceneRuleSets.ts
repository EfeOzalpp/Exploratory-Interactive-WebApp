// sceneRuleSets.ts
import type { SceneProfile } from "../multi-canvas-setup/sceneProfile.ts";

import { CANVAS_PADDING } from "./canvasPadding.ts";
import { SHAPE_BANDS } from "./placementRules.ts";
import { SHAPE_META } from "./shapeMeta.ts";

import { POOL_SIZES } from "./poolSizes.ts";
import { QUOTA_CURVES } from "./quotaSpecification.ts";

import { defineRuleSet } from "../validation/index.ts";

// Register number of adjustable-rule instances
export const SCENE_MODES = ["start", "questionnaire", "overlay"] as const;
export type SceneMode = (typeof SCENE_MODES)[number];


/** ---------- INTRO ---------- */

const Start = (): SceneProfile => ({
  padding: CANVAS_PADDING.start,
  bands: SHAPE_BANDS.start,
  shapeMeta: SHAPE_META,
  poolSizes: POOL_SIZES.start,
  quotaCurves: QUOTA_CURVES.default,
});

const Questionnaire = (): SceneProfile => ({
  padding: CANVAS_PADDING.questionnaire,
  bands: SHAPE_BANDS.questionnaire,
  shapeMeta: SHAPE_META,
  poolSizes: POOL_SIZES.questionnaire,
  quotaCurves: QUOTA_CURVES.default,
});

/** ---------- CITY ---------- */

const City = (): SceneProfile => ({
  padding: CANVAS_PADDING.overlay,
  bands: SHAPE_BANDS.overlay,
  shapeMeta: SHAPE_META,
  poolSizes: POOL_SIZES.overlay,
  quotaCurves: QUOTA_CURVES.overlay,
});

/** ---------- EXPORT ---------- */

export const SCENE_RULESETS = {
  intro: defineRuleSet("intro", (mode: SceneMode) => {
    if (mode === "start") return Start();
    // Questionnaire added as a state change for the intro canvas rather than a new canvas
    // It still is using 0-1 signal (liveAvg) too
    if (mode === "questionnaire") return Questionnaire(); 
    throw new Error(`[intro] unsupported mode "${mode}".`);
  }),

  city: defineRuleSet("city", (_mode: SceneMode) => City(
    // City doesn't have any extra state changes aside from 0-1 signal (liveAvg)
  )),
} as const;
