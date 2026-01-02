// navigation/CityOverlay.jsx
import React from 'react';

import { useCanvasEngine } from '../canvas-engine/hooks/useCanvasEngine.ts';
import { useViewportKey } from '../canvas-engine/hooks/useViewportKey.ts';
import { useSceneField } from '../canvas-engine/hooks/useSceneField.ts';
import { useColor } from '../canvas-engine/modifiers/color-modifiers/color/useColor.ts';
import { stopCanvasEngine } from '../canvas-engine/canvasEngine.js';

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
  useSceneField(engine, allocAvg ?? liveAvg, viewportKey, { overlay: true });
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
