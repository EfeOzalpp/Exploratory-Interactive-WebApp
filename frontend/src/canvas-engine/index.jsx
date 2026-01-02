// canvas-engine/index.jsx
import { useCanvasEngine } from './hooks/useCanvasEngine.ts';
import { useSceneField } from './hooks/useSceneField.ts';
import { useViewportKey } from './hooks/useViewportKey.ts';
import { useColor } from './modifiers/color-modifiers/color/useColor.ts';

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
  useSceneField(engine, allocAvg, viewportKey);

  // Global palette + per-shape lerps (read continuously during drag)
  useColor(engine, liveAvg);

  return null;
}
