import { useEffect, useState } from 'react';
import { generatePositions } from '../utils/positions';
import { sampleStops, rgbString } from '../../../utils/hooks.ts';

const defaultColorForAverage = (avg) => rgbString(sampleStops(avg));

export default function useDotPoints(arg1, arg2 = {}) {
  const isArrayCall = Array.isArray(arg1);
  const data = isArrayCall ? arg1 : Array.isArray(arg1?.data) ? arg1.data : [];
  const opts = isArrayCall ? (arg2 || {}) : (arg1 || {});

  const {
    colorForAverage = defaultColorForAverage,
    personalizedEntryId,
    showPersonalized = false,

    // positioning knobs (safe defaults)
    minDistance = 2.5,      // your spheres are r=1.4 → diameter ≈2.8
    baseRadius = 10,
    densityK = 6.0,
    maxRadiusCap = 180,
    yaw = 0, pitch = 0, roll = 0,
    jitterAmp = 0.25,
    relaxPasses,            // leave undefined to auto: 1 for N<=3000, else 0
    relaxStrength = 0.7,
    seed = 1337,

    spreadOverride,         // set to force a max radius instead of adaptive
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
      const weights = Object.values(response?.weights || {});
      const avg = weights.length ? weights.reduce((s, w) => s + w, 0) / weights.length : 0.5;
      const pos = base[i];
      return {
        position: pos,
        originalPosition: pos,
        color: colorForAverage(avg), 
        averageWeight: avg,
        _id: response?._id,
      };
    });

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
