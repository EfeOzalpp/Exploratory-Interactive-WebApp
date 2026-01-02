// src/canvas/layout/scene-composition/scoringGround.ts
import { hash32String } from '../../shared/hash32.ts';
import type { ShapeName } from '../../condition-utils/types.ts';

export function rowOrderFromBand(top: number, bot: number) {
  if (top > bot) return [];

  const pref = Math.floor(top + (bot - top) * 0.3);
  const out: number[] = [pref];

  for (let d = 1; ; d++) {
    const up1 = pref - d;
    const up2 = pref - (d + 1);
    const dn = pref + d;

    let pushed = false;
    if (up1 >= top) {
      out.push(up1);
      pushed = true;
    }
    if (up2 >= top) {
      out.push(up2);
      pushed = true;
    }
    if (dn <= bot) {
      out.push(dn);
      pushed = true;
    }
    if (!pushed) break;
  }

  return out;
}

export function pickLane(key: 'house' | 'villa', id: number, salt: number) {
  return hash32String(`${key}|${id}|${salt}`) % 3;
}

export function scoreGroundCandidate(
  cols: number,
  usedRows: number,
  r0: number,
  c0: number,
  wCell: number,
  hCell: number,
  lane: number | null,
  segCenterC: number,
  bandTop: number,
  bandBot: number,
  shape?: ShapeName,
  opts?: { centerBias?: boolean; segPull?: boolean }
) {
  if (r0 < bandTop || r0 + hCell - 1 > bandBot) return -1e9;

  const colCenter = c0 + wCell / 2;
  const rowCenter = r0 + hCell / 2;

  const gridColCenter = (cols - 1) / 2;
  const usedRowCenter = (usedRows - 1) / 2;

  const dCol2 = (colCenter - gridColCenter) ** 2;
  const dRow2 = (rowCenter - usedRowCenter) ** 2;

  const centerBias = opts?.centerBias ?? true;
  const segPullOn = opts?.segPull ?? true;

  const wCol = centerBias ? 1.0 : 0;
  const wRow = centerBias ? 0.6 : 0;

  const edgeLeft = Math.max(0, 2 - c0);
  const edgeRight = Math.max(0, c0 + wCell - (cols - 2));
  const edgePenalty = (edgeLeft + edgeRight) * 6;

  const lanePenalty = lane != null && c0 % 3 !== lane ? 2 : 0;
  const segPull = segPullOn ? -0.9 * (colCenter - segCenterC) ** 2 : 0;

  const jitter =
    ((hash32String(`g|${r0},${c0},${wCell},${hCell}`) & 0xff) / 255) * 0.2;

  let carBias = 0;
  if (shape === 'car') {
    const bandBotCenter = bandBot + 0.5;
    const dist = rowCenter - bandBotCenter;
    carBias = -0.25 * dist * dist;
  }

  return (
    -(wCol * dCol2 + wRow * dRow2) -
    lanePenalty -
    edgePenalty +
    segPull +
    jitter +
    carBias
  );
}
