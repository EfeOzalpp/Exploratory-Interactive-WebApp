// src/canvas/index.jsx
import React from 'react';
import { useQ5Engine } from './hooks/useQ5Engine.ts';
import { useColor } from './hooks/useColor.ts';
import { useShapeFromAvg } from './hooks/useShape.ts';
import { useGridDotField } from './hooks/useGridDotField.ts';

export default function CanvasEntry({ visible = true, liveAvg = 0.5 }) {
  const engine = useQ5Engine({ visible, dprMode: 'fixed1' });

  // positions (no style here — styles come from the hooks below)
  useGridDotField(engine, liveAvg, { cap: 20, manageStyle: false });

  // global + per-shape style
  useColor(engine, liveAvg);
  useShapeFromAvg(engine, liveAvg, {
    min: 8,
    max: 28,
    // optional: make triangles/octagons feel same visual weight as circles
    perShapeScale: { circle: 1.00, triangle: 1.12, square: 0.98, octagon: 1.05 },
  });

  return null;
}
