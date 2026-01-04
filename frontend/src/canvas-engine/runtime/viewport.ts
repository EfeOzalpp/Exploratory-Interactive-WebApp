// canvas-engine/engine/viewport.ts

export type DprMode = "fixed1" | "cap1_5" | "cap2" | "auto";

export function resolvePixelDensity(mode: DprMode) {
  const dpr = window.devicePixelRatio || 1;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  switch (mode) {
    case "fixed1":
      return 1;
    case "cap1_5":
      return Math.min(1.5, dpr);
    case "cap2":
      return Math.min(2, dpr);
    case "auto":
      return isMobile ? Math.min(2, dpr) : Math.min(3, dpr);
    default:
      return Math.min(3, dpr);
  }
}

export function getViewportSize() {
  const vv = typeof window !== "undefined" ? (window as any).visualViewport : null;
  if (vv && vv.width && vv.height) return { w: Math.round(vv.width), h: Math.round(vv.height) };

  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  return { w, h };
}
