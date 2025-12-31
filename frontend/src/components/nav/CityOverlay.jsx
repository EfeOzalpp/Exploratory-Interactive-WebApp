// components/nav/CityOverlay.jsx
import React from 'react';
import { useCanvasEngine } from '../../canvas/hooks/useCanvasEngine.ts';
import { useViewportKey } from '../../canvas/hooks/useViewportKey.ts';
import { useGridDotField } from '../../canvas/hooks/useGridDotField.ts';
import { useColor } from '../../canvas/hooks/useColor.ts';
import { stopCanvasEngine } from '../../canvas/canvas-engine';

export default function CityOverlay({ open, liveAvg = 0.5, allocAvg }) {
  // When overlay opens, stop the intro canvas so they never overlap
  React.useEffect(() => {
    if (open) {
      try { stopCanvasEngine('#canvas-root'); } catch {}
    }
  }, [open]);

  // Mount the engine *inside* the overlay host
  const engine = useCanvasEngine({
    visible: open,
    dprMode: 'auto',
    mount: '#city-canvas-root', // ← important: mount inside overlay
    zIndex: 60,                 // ← sits above intro
  });

  const viewportKey = useViewportKey(120);

  // Use overlay placement bands + overlay pool sizes
  useGridDotField(engine, allocAvg ?? liveAvg, viewportKey, { overlay: true });
  useColor(engine, liveAvg);

  return (
    <div
      id="city-overlay-root"
      className={`city-overlay ${open ? 'open' : ''}`}
      aria-hidden={!open}
    >
      {/* Engine mounts here */}
      <div id="city-canvas-root" className="city-canvas-host" />
    </div>
  );
}
