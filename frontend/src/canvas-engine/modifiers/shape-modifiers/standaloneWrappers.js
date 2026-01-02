// utils/standaloneWrappers.js

// Make a fake grid "footprint" from a pixel rect so House/Villa can render standalone.
export function footprintFromRect(x, y, w, h) {
  // choose any "cell" pixel size;  the math inside house/villa uses `cell` for radii/gaps.
  // pick a stable unit so rounded corners & window sizes look consistent at different scales.
  const cell = Math.max(8, Math.round(Math.min(w, h) / 10)); // ≈10 cells across the small side
  return {
    cell,
    footprint: {
      c0: Math.round(x / cell),
      r0: Math.round(y / cell),
      w:  Math.max(1, Math.round(w / cell)),
      h:  Math.max(1, Math.round(h / cell)),
    }
  };
}

// Optional: generic “fit to rect” helpers for assets with intrinsic width
export function fitScaleToRectWidth(contentW, rectW, pad = 0, { allowUpscale = false } = {}) {
  const usable = Math.max(1, rectW - pad * 2);
  const s = usable / Math.max(1, contentW);
  return allowUpscale ? s : Math.min(1, s);
}
export function beginFitScale(p, { cx, anchorY, scale }) {
  p.push(); p.translate(cx, anchorY); p.scale(scale, scale); p.translate(-cx, -anchorY);
}
export function endFitScale(p) { p.pop(); }
