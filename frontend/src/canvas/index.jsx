import React from 'react';
import { useCanvasEngine } from './hooks/useCanvasEngine.ts';
import { useColor } from './hooks/useColor.ts';
import { useGridDotField } from './hooks/useGridDotField.ts';
import { useViewportKey } from './hooks/useViewportKey.ts';

/**
 * CanvasEntry
 * - allocAvg: drives allocation/placement (only update on commit)
 * - liveAvg:  drives per-shape visuals (update continuously while dragging)
 */
export default function CanvasEntry({
  visible = true,
  liveAvg = 0.5,
  allocAvg = 0.5,
}) {
  const engine = useCanvasEngine({ visible, dprMode: 'auto' });

  // Debounced key that bumps on viewport resize/orientation
  const viewportKey = useViewportKey(120);

  // Placement (houses/clouds/etc.) — trigger on allocAvg and viewport changes
  useGridDotField(engine, allocAvg, viewportKey);

  // Global palette + per-shape lerps (read continuously during drag)
  useColor(engine, liveAvg);

  return null;
}
