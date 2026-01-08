// canvas-engine/engine/mount.ts

export type EngineLayoutMode = "fixed" | "inherit" | "auto";

export function ensureMount(mount: string, zIndex?: number, layout: EngineLayoutMode = "fixed") {
  let el = document.querySelector(mount) as HTMLElement | null;
  const existed = !!el;

  if (!el) {
    el = document.createElement("div");
    el.id = mount.startsWith("#") ? mount.slice(1) : mount;
    document.body.appendChild(el);
  }

  // Layout semantics:
  // - fixed: engine owns a fullscreen fixed layer (default)
  // - inherit: engine renders inside an existing container; do not force fullscreen
  // - auto: fixed if we had to create the mount, otherwise inherit
  const mode: EngineLayoutMode = layout === "auto" ? (existed ? "inherit" : "fixed") : layout;

  if (mode === "fixed") {
    el.style.zIndex = String(Number.isFinite(zIndex as number) ? zIndex : 2);
  } else {
    // inherit: don't stomp geometry; just ensure we can absolutely position the canvas
    const pos = getComputedStyle(el).position;
    if (pos === "static" || !pos) el.style.position = "relative";
    // zIndex only matters if the container participates in stacking; set only if asked
    if (Number.isFinite(zIndex as number)) el.style.zIndex = String(zIndex);
  }

  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  (el.style as any).webkitTapHighlightColor = "transparent";
  el.classList.add("be-canvas-layer");

  return el;
}

export function applyCanvasStyle(el: HTMLCanvasElement) {
  if (!el?.style) return;
  el.style.position = "absolute";
  el.style.inset = "0";
  el.style.zIndex = "0";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.transform = "translateZ(0)";
  el.style.imageRendering = "auto";
  el.setAttribute("tabindex", "-1");
}
