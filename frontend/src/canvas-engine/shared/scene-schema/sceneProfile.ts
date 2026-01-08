// src/canvas-engine/shared/scene-schema/sceneProfile.ts
export type SceneMode = "start" | "questionnaire" | "overlay";

export type ShapeMeta = {
  layer: "sky" | "ground";
  group: "sky" | "building" | "vehicle" | "nature";
  separation?: number; // in cells
};

// tighten these as your schema firms up:
export type CanvasPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type BandsByDevice = Record<string, Record<string, unknown>>;

export type SceneProfile = {
  padding: CanvasPadding;
  bands: BandsByDevice;
  shapeMeta: Record<string, ShapeMeta>;
};
