// Opacity + scale blending with a soft midpoint plateau and hysteresis
const PLATEAU_LOW = 0.47;
const PLATEAU_HIGH = 0.53;
const EPS = 1e-3;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// perceptual shaping curve — keeps blends more visible
const curve = (x: number, exp = 0.6) => Math.pow(x, exp);

export function getAnswerOpacities(
  t: number | undefined,
  snappedIndex?: number | null
): number[] {
  const op = [0, 0, 0, 0];
  if (t == null) return op;

  if (Number.isInteger(snappedIndex)) {
    op[snappedIndex as number] = 1;
    return op;
  }

  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);
  const f = clamped - i;

  if (i >= 3) { op[3] = 1; return op; }

  const left = i, right = i + 1;

  if (f <= PLATEAU_LOW - EPS) {
    const t1 = smoothstep(0, PLATEAU_LOW, f);
    const c = curve(t1, 0.6);
    op[left]  = 1;
    op[right] = c;
  } else if (f >= PLATEAU_HIGH + EPS) {
    const t2 = smoothstep(PLATEAU_HIGH, 1, f);
    const c = curve(t2, 0.6);
    op[left]  = 1 - c;
    op[right] = 1;
  } else {
    op[left] = 1; op[right] = 1;
  }
  return op;
}

export function getScaleActivations(
  t: number | undefined,
  snappedIndex?: number | null
): number[] {
  const act = [0, 0, 0, 0];
  if (t == null) return act;

  if (Number.isInteger(snappedIndex)) {
    act[snappedIndex as number] = 1;
    return act;
  }

  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);
  const f = clamped - i;

  if (i >= 3) { act[3] = 1; return act; }

  const left = i, right = i + 1;

  if (f <= PLATEAU_LOW - EPS) {
    const t1 = smoothstep(0, PLATEAU_LOW, f);
    const c = curve(t1, 0.6);
    act[left]  = 1;
    act[right] = c;
  } else if (f >= PLATEAU_HIGH + EPS) {
    const t2 = smoothstep(PLATEAU_HIGH, 1, f);
    const c = curve(t2, 0.6);
    act[left]  = 1 - c;
    act[right] = 1;
  } else {
    act[left] = 1; act[right] = 1;
  }
  return act;
}
