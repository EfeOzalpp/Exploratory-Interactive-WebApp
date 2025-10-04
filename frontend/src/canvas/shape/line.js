export function drawLine(p, cx, cy, r, opts = {}) {
  const color = opts.gradientRGB || { r: 120, g: 120, b: 120 };
  const alpha = opts.alpha ?? 235;

  p.noStroke();
  p.fill(color.r, color.g, color.b, alpha);

  const len = r * 2.2;
  const t = Math.max(2, r * 0.30);
  p.rect(cx - len / 2, cy - t / 2, len, t, Math.min(t, 3));
}
