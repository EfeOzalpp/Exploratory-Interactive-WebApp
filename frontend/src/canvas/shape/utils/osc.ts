import { phaseFromIndex } from './hash.ts';

// Generic displacement oscillator: small (dx, dy, scale) wobble
export function displacementOsc(
  tSec: number,
  idx: number,
  opts: {
    ampX?: number;         // px
    ampY?: number;         // px
    ampScale?: number;     // ±fraction
    freqX?: number;        // Hz
    freqY?: number;        // Hz
    freqScale?: number;    // Hz
    seed?: number;
  } = {}
) {
  const {
    ampX = 8,
    ampY = 6,
    ampScale = 0.12,
    freqX = 0.22,
    freqY = 0.22 * 0.85,
    freqScale = 0.22 * 0.6,
    seed = 0,
  } = opts;

  const p0 = phaseFromIndex(idx, seed);
  const p1 = phaseFromIndex(idx * 997 + 13, seed);
  const p2 = phaseFromIndex(idx * 577 + 29, seed);

  const wX = 2 * Math.PI * freqX;
  const wY = 2 * Math.PI * freqY;
  const wS = 2 * Math.PI * freqScale;

  const dx = Math.sin(wX * tSec + p0) * ampX;
  const dy = Math.sin(wY * tSec + p1) * ampY;
  const sc = 1 + Math.sin(wS * tSec + p2) * ampScale;

  return { dx, dy, sc };
}
