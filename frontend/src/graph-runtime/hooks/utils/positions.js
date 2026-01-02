// src/components/dotGraph/utils/positions.js
// Product-ready 3D point layout (1 .. 5000+):
// - Even angular coverage via Spherical Fibonacci
// - Uniform-in-ball radial ramp, with extra inward bias for small N
// - Fast local relaxation using a spatial grid (O(n))
// - Deterministic (seed), no console logs

const TAU = Math.PI * 2;

// ----------------- helpers -----------------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

const rotateVec = (v, rot) => {
  const [x0, y0, z0] = v;
  const { yaw = 0, pitch = 0, roll = 0 } = rot || {};
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll),  sr = Math.sin(roll);

  // ZYX (yaw, pitch, roll)
  // roll (X)
  const y1 =  y0 * cr - z0 * sr;
  const z1 =  y0 * sr + z0 * cr;
  const x1 =  x0;
  // pitch (Y)
  const x2 =  x1 * cp + z1 * sp;
  const y2 =  y1;
  const z2 = -x1 * sp + z1 * cp;
  // yaw (Z)
  const x3 =  x2 * cy - y2 * sy;
  const y3 =  x2 * sy + y2 * cy;
  const z3 =  z2;

  return [x3, y3, z3];
};

const makePermutation = (n, rand) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const sphericalFibonacci = (n, rot) => {
  if (n <= 0) return [];
  const dirs = new Array(n);
  const golden = (1 + Math.sqrt(5)) / 2;
  const ga = TAU / (golden * golden);

  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;   // 0..1
    const y = 1 - 2 * t;       // -1..1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = ga * i;

    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);

    dirs[i] = rot ? rotateVec([x, y, z], rot) : [x, y, z];
  }
  return dirs;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const tangentBasis = (n) => {
  const [nx, ny, nz] = n;
  const up = Math.abs(nz) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  // u = normalize(up × n)
  let ux = up[1]*nz - up[2]*ny;
  let uy = up[2]*nx - up[0]*nz;
  let uz = up[0]*ny - up[1]*nx;
  let len = Math.hypot(ux, uy, uz) || 1;
  ux/=len; uy/=len; uz/=len;
  // v = n × u
  const vx = ny*uz - nz*uy;
  const vy = nz*ux - nx*uz;
  const vz = nx*uy - ny*ux;
  return [[ux,uy,uz],[vx,vy,vz]];
};

const gridKey = (i,j,k) => `${i},${j},${k}`;
const cellIndex = (p, cs) => [
  Math.floor(p[0] / cs),
  Math.floor(p[1] / cs),
  Math.floor(p[2] / cs),
];

// ----------------- main API -----------------
/**
 * Generate near-uniform 3D positions centered at the origin.
 *
 * @param {number} numPoints
 * @param {number} minDistance  minimal spacing to enforce (world units)
 * @param {number|undefined} spreadOverride optional max radius; if omitted, adapts with N
 * @param {object} opts
 *  - baseRadius?: number    baseline radius for larger N (default 10)
 *  - densityK?: number      growth factor with N (default 6.0)
 *  - maxRadiusCap?: number  hard cap for max radius (default 180)
 *  - yaw/pitch/roll?: number orientation in radians
 *  - jitterAmp?: number     0..1 of minDistance for tiny tangent jitter (default 0.25)
 *  - relaxPasses?: number   neighbor-nudge passes (default 1; auto-disable at huge N)
 *  - relaxStrength?: number 0..1 per-pass strength (default 0.7)
 *  - seed?: number          RNG seed for jitter/permutation
 *  - tightRefN?: number     counts <= this stay tighter near center (default 24)
 *  - baseRadiusTight?: number base radius when tight (default ~0.5 * minDistance)
 *  - tightMaxAlpha?: number radial exponent when tight (default 0.85; >1/3 pulls inward)
 *  - tightCurve?: number    1=linear fade of tightness; >1 keeps tightness longer (default 1.25)
 */
export const generatePositions = (
  numPoints,
  minDistance = 2.5,
  spreadOverride,
  opts = {}
) => {
  const n = Math.max(0, numPoints | 0);
  if (n === 0) return [];

  const baseRadius    = opts.baseRadius    ?? 10;
  const densityK      = opts.densityK      ?? 6.0;
  const maxRadiusCap  = opts.maxRadiusCap  ?? 180;
  const yaw           = opts.yaw           ?? 0;
  const pitch         = opts.pitch         ?? 0;
  const roll          = opts.roll          ?? 0;
  const jitterAmp     = opts.jitterAmp     ?? 0.25;
  const relaxPasses   = (opts.relaxPasses ?? (n > 3000 ? 0 : 1));
  const relaxStrength = opts.relaxStrength ?? 0.7;
  const seed          = opts.seed          ?? 1337;

  // Small-N tightness knobs
  const tightRefN        = opts.tightRefN        ?? 24;
  const baseRadiusTight  = opts.baseRadiusTight  ?? Math.max(0.5 * minDistance, 0.5);
  const tightMaxAlpha    = opts.tightMaxAlpha    ?? 0.85;
  const tightCurve       = opts.tightCurve       ?? 1.25;

  // Tightness factor: 1 at very small N → 0 by tightRefN
  const tightT = Math.pow(clamp01(1 - n / tightRefN), tightCurve);

  // Effective base radius shrinks when N is small
  const baseR_eff = lerp(baseRadius, baseRadiusTight, tightT);

  // Adaptive max radius (~ cbrt(n)) + cap; allow explicit override to win
  const adaptiveMaxR = baseR_eff + densityK * minDistance * Math.cbrt(n);
  const maxR = Math.min(maxRadiusCap, spreadOverride ?? adaptiveMaxR);

  // 1) Even directions
  const dirs = sphericalFibonacci(n, { yaw, pitch, roll });

  // 2) Radii: uniform-in-ball when N is large; extra inward bias when N is small
  const baseAlpha = 1 / 3;                      // uniform in ball exponent
  const alpha     = lerp(baseAlpha, tightMaxAlpha, tightT);

  const rand = mulberry32(seed);
  const perm = makePermutation(n, rand);

  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = (perm[i] + 0.5) / n;              // stratified & shuffled
    const r = maxR * Math.pow(u, alpha);
    const d = dirs[i];

    // small tangent jitter so rings don't look too perfect
    const [t1, t2] = tangentBasis(d);
    const j1 = (rand() - 0.5) * 2;
    const j2 = (rand() - 0.5) * 2;
    const jScale = jitterAmp * minDistance;

    const jx = t1[0]*j1*jScale + t2[0]*j2*jScale;
    const jy = t1[1]*j1*jScale + t2[1]*j2*jScale;
    const jz = t1[2]*j1*jScale + t2[2]*j2*jScale;

    pts[i] = [d[0]*r + jx, d[1]*r + jy, d[2]*r + jz];
  }

  if (relaxPasses <= 0 || minDistance <= 0) return pts;

  // 3) Fast local relaxation with a spatial grid
  const cellSize = Math.max(1e-6, minDistance);
  const nbr = [-1, 0, 1];

  for (let pass = 0; pass < relaxPasses; pass++) {
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      const c = cellIndex(pts[i], cellSize);
      const k = gridKey(c[0], c[1], c[2]);
      let arr = grid.get(k);
      if (!arr) { arr = []; grid.set(k, arr); }
      arr.push(i);
    }

    for (let i = 0; i < n; i++) {
      const pi = pts[i];
      const ci = cellIndex(pi, cellSize);
      let px = 0, py = 0, pz = 0, cnt = 0;

      for (let dx of nbr) for (let dy of nbr) for (let dz of nbr) {
        const k = gridKey(ci[0]+dx, ci[1]+dy, ci[2]+dz);
        const bucket = grid.get(k);
        if (!bucket) continue;
        for (let j of bucket) {
          if (j === i) continue;
          const pj = pts[j];
          const rx = pi[0] - pj[0], ry = pi[1] - pj[1], rz = pi[2] - pj[2];
          const d2 = rx*rx + ry*ry + rz*rz;
          if (d2 > 1e-12 && d2 < minDistance*minDistance) {
            const d = Math.sqrt(d2);
            const overlap = (minDistance - d);
            if (overlap > 0) {
              const ux = rx / d, uy = ry / d, uz = rz / d;
              px += ux * overlap * 0.5;
              py += uy * overlap * 0.5;
              pz += uz * overlap * 0.5;
              cnt++;
            }
          }
        }
      }

      if (cnt > 0) {
        pi[0] += (px / cnt) * relaxStrength;
        pi[1] += (py / cnt) * relaxStrength;
        pi[2] += (pz / cnt) * relaxStrength;

        // clamp inside sphere
        const rNow = Math.hypot(pi[0], pi[1], pi[2]);
        if (rNow > maxR) {
          const k = maxR / rNow;
          pi[0] *= k; pi[1] *= k; pi[2] *= k;
        }
      }
    }
  }

  return pts;
};
