// src/canvas-engine/runtime/layout/resize.ts

// D: Declaration code and E: execution code
import type { PLike } from "../p/makeP.ts";          // (D) type-only import (erased at runtime)
import type { DprMode } from "./viewport.ts";       // (D) type-only import (erased at runtime)
import { resolvePixelDensity } from "./viewport.ts"; // (D+E*) import binding declared; module loader may execute that module once
import { applyCanvasStyle } from "./mount.ts";       // (D+E*) same note as above

export type ResizeCleanup = () => void; // (D) type alias only

export function installResizeHandlers(opts: {
  parentEl: HTMLElement;
  canvasEl: HTMLCanvasElement;
  p: PLike;
  dprMode: DprMode;
  resizeTo: () => { w: number; h: number };
  onAfterResize?: () => void;
}): ResizeCleanup {
  const { parentEl, canvasEl, p, dprMode, resizeTo, onAfterResize } = opts;

  let resizeRaf: number | null = null;

  function resizeNow() {
    const { w, h } = resizeTo();

    p.pixelDensity(resolvePixelDensity(dprMode));
    p.resizeCanvas(w, h);

    canvasEl.style.width = w + "px";
    canvasEl.style.height = h + "px";

    applyCanvasStyle(canvasEl);

    onAfterResize?.();
  }

  function resizeThrottled() {
    if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resizeNow);
  }

  // Observe parent size changes
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => resizeThrottled());
    ro.observe(parentEl);
  }

  // Window resize
  window.addEventListener("resize", resizeThrottled);

  // Visibility
  const visHandler = () => {
    if (document.visibilityState === "visible") resizeThrottled();
  };
  document.addEventListener("visibilitychange", visHandler);

  // initial
  resizeNow();

  return () => {
    try {
      if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
    } catch {}
    try {
      ro?.disconnect();
    } catch {}
    ro = null;

    try {
      window.removeEventListener("resize", resizeThrottled);
    } catch {}
    try {
      document.removeEventListener("visibilitychange", visHandler);
    } catch {}
  };
}
