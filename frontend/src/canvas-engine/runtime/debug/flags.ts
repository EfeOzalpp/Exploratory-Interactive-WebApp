export type DebugFlags = {
  grid: boolean;
  gridAlpha: number;
  forbiddenAlpha: number;
};

export const DEBUG_DEFAULT: DebugFlags = {
  grid: true, // toggle grid visibility
  gridAlpha: 0.35,
  forbiddenAlpha: 0.25,
};
