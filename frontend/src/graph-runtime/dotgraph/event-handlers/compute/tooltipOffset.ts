// src/graph-runtime/dotgraph/event-handlers/tooltipOffset.ts
export function computeTooltipOffsetPx(params: {
  width: number;
  height: number;
  radius: number;
  minRadius: number;
  maxRadius: number;
  dynamicOffset: number;
}) {
  const { width, height, radius, minRadius, maxRadius, dynamicOffset } = params;

  const isPortrait = height > width;
  const offsetBase = isPortrait ? 160 : 120;

  const denom = Math.max(1e-6, maxRadius - minRadius);
  const zf = Math.max(0, Math.min(1, (radius - minRadius) / denom));

  const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
  const nonlinearLerp = (a: number, b: number, t: number) => {
    const x = clamp01(t);
    return a + (b - a) * (1 - Math.pow(1 - x, 5));
  };

  const target = Number.isFinite(dynamicOffset) ? dynamicOffset : 120;

  return nonlinearLerp(offsetBase, target, zf);
}
