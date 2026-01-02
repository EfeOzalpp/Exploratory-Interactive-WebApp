// utils/liveAverage.ts
// Live client-side average weight based on survey answers computation for canvas 
export function computeRealtimeAverage(
  weights: Record<string, number | undefined>
): number | undefined {
  const vals = Object.values(weights).filter((x): x is number => Number.isFinite(x));
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
