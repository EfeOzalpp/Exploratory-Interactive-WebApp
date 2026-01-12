// src/canvas-engine/shared/responsiveness.ts

export type DeviceType = "mobile" | "tablet" | "laptop";

export function deviceType(w: number): DeviceType {
  if (w <= 767) return "mobile";
  if (w <= 1024) return "tablet";
  return "laptop";
}

export function getViewportSize(): { w: number; h: number } {
  // Avoid crashing in SSR / tests
  if (typeof window === "undefined") return { w: 1024, h: 768 };
  return { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) };
}
