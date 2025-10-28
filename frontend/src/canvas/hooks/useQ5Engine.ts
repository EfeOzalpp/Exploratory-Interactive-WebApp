// components/canvas/hooks/useQ5Engine.ts
import { useEffect, useRef, useState } from 'react';
import { startQ5, type Q5Controls } from '../q5-lite.js';

// Optional: call global disposer the factory exposes
function disposeTexturesIfAny() {
  try { (window as any).__GP_DISPOSE_TEX?.(); } catch {}
  // also: cancel/bump any pending canvas/sprite jobs if available
  try { (window as any).__GP_BUMP_GEN?.(); } catch {}
  try { (window as any).__GP_RESET_QUEUE?.(); } catch {}
}

type EngineOpts = {
  visible?: boolean;
  // add new modes here:
  dprMode?: 'fixed1' | 'cap2' | 'cap1_5' | 'auto';
};

export function useQ5Engine(opts: EngineOpts = {}) {
  const { visible = true, dprMode = 'cap2' } = opts;

  const controlsRef = useRef<Q5Controls | null>(null);
  const readyRef = useRef(false);
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    // init the Q5 engine
    controlsRef.current = startQ5({
      mount: '#canvas-root',
      dprMode, // ← passes straight through to startQ5()
      onReady: () => {
        readyRef.current = true;
        setReadyTick((t) => t + 1); // signal “ready” to React
      },
    });

    // cleanup
    return () => {
      readyRef.current = false;
      try { controlsRef.current?.setVisible?.(false); } catch {}
      try { controlsRef.current?.stop?.(); } catch {}
      controlsRef.current = null;
      // Ensure textures/queues are purged between visits
      disposeTexturesIfAny();
    };
  }, [dprMode]);

  // toggle visibility dynamically (kept for parity; we now also hard unmount at parent)
  useEffect(() => {
    controlsRef.current?.setVisible?.(Boolean(visible));
  }, [visible]);

  return {
    ready: readyRef,
    controls: controlsRef,
    readyTick,
  };
}
