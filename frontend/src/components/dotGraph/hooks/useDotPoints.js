// components/dotGraph/hooks/useDotPoints.js
import { useEffect, useState } from 'react';
import { generatePositions } from '../utils/positions';
import { sampleStops, rgbString } from '../../../utils/hooks.ts';

const defaultColorForAverage = (avg) => rgbString(sampleStops(avg));

// (optional, harmless) fallback if a row ever lacks avgWeight
const computeLocalAvg = (response) => {
  const w = response?.weights;
  if (!w || typeof w !== 'object') return undefined;
  const vals = Object.values(w).filter((x) => Number.isFinite(x));
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

export default function useDotPoints(arg1, arg2 = {}) {
  const isArrayCall = Array.isArray(arg1);
  const data = isArrayCall ? arg1 : Array.isArray(arg1?.data) ? arg1.data : [];
  const opts = isArrayCall ? (arg2 || {}) : (arg1 || {});

  const {
    colorForAverage = defaultColorForAverage,
    personalizedEntryId,
    showPersonalized = false,

    // positioning knobs (safe defaults)
    minDistance = 2.5,      // spheres are r≈1.4 → diameter ≈2.8
    baseRadius = 10,
    densityK = 6.0,
    maxRadiusCap = 180,
    yaw = 0, pitch = 0, roll = 0,
    jitterAmp = 0.25,
    relaxPasses,            // undefined → auto: 1 for N<=3000, else 0
    relaxStrength = 0.7,
    seed = 1337,

    spreadOverride,         // force a max radius instead of adaptive
  } = opts;

  const [points, setPoints] = useState([]);

  useEffect(() => {
    const safe = Array.isArray(data) ? data : [];
    const n = safe.length;

    const base = generatePositions(
      n,
      minDistance,
      spreadOverride,
      {
        baseRadius,
        densityK,
        maxRadiusCap,
        yaw, pitch, roll,
        jitterAmp,
        relaxPasses,
        relaxStrength,
        seed,
      }
    );

    const pts = safe.map((response, i) => {
      // ✅ PRIMARY: use backend-saved avgWeight
      let avg = Number.isFinite(response?.avgWeight)
        ? Number(response.avgWeight)
        : undefined;

      // optional fallback if needed
      if (!Number.isFinite(avg)) {
        const local = computeLocalAvg(response);
        avg = Number.isFinite(local) ? local : 0.5;
      }

      const pos = base[i];
      return {
        position: pos,
        originalPosition: pos,
        color: colorForAverage(avg),
        averageWeight: avg,         // <-- carry for sprites & tooltips
        _id: response?._id,
      };
    });

    // center the personalized point (optional behavior kept)
    if (showPersonalized && personalizedEntryId) {
      const mine = pts.find((p) => p._id === personalizedEntryId);
      if (mine) {
        mine.position = [0, 0, 0];
        mine.originalPosition = [0, 0, 0];
      }
    }

    setPoints(pts);
  }, [
    data,
    colorForAverage,
    personalizedEntryId,
    showPersonalized,
    minDistance,
    spreadOverride,
    baseRadius, densityK, maxRadiusCap,
    yaw, pitch, roll,
    jitterAmp, relaxPasses, relaxStrength, seed,
  ]);

  return points;
}
