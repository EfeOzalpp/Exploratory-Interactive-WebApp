export function quantizeAvg(avg: number, bins = 24): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(avg) ? avg : 0.5));
  const step = 1 / (bins - 1);
  return Math.round(t / step) * step;
}
