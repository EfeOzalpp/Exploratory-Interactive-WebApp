// components/nav/CityOverlay.jsx
import React from 'react';
import { useQ5Engine } from '../../canvas/hooks/useQ5Engine.ts';
import { useViewportKey } from '../../canvas/hooks/useViewportKey.ts';
import { useGridDotField } from '../../canvas/hooks/useGridDotField.ts';
import { useColor } from '../../canvas/hooks/useColor.ts';
import { stopQ5 } from '../../canvas/q5-lite';

export default function CityOverlay({ open, liveAvg = 0.5, allocAvg }) {
  // When overlay opens, stop the intro canvas so they never overlap
  React.useEffect(() => {
    if (open) {
      try { stopQ5('#canvas-root'); } catch {}
    }
  }, [open]);

  // Mount the engine *inside* the overlay host
  const engine = useQ5Engine({
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
