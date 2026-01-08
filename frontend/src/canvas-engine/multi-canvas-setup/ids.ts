// src/canvas-engine/multi-canvas-setup/ids.ts
export const HOST_IDS = {
  intro: "intro",
  city: "city",
} as const;

export type HostId = typeof HOST_IDS[keyof typeof HOST_IDS];
