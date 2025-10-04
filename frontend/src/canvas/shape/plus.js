export function drawPlus(p, cx, cy, r, opts = {}) {
  const color = opts.gradientRGB || { r: 160, g: 160, b: 160 };
  const alpha = opts.alpha ?? 235;

  p.noStroke();
  p.fill(color.r, color.g, color.b, alpha);

  const t = Math.max(2, r * 0.45);
  const s = r * 2;
  p.rect(cx - t / 2, cy - s / 2, t, s, Math.min(3, t / 2)); // vertical
  p.rect(cx - s / 2, cy - t / 2, s, t, Math.min(3, t / 2)); // horizontal
}
