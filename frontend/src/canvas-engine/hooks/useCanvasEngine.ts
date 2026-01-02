// components/canvas/hooks/useCanvasEngine.ts
import { useEffect, useRef, useState } from 'react';

import { startCanvasEngine, stopCanvasEngine, type CanvasEngineControls } from '../canvasEngine.js';

function disposeTexturesIfAny() {
  try { (window as any).__GP_DISPOSE_TEX?.(); } catch {}
  try { (window as any).__GP_BUMP_GEN?.(); } catch {}
  try { (window as any).__GP_RESET_QUEUE?.(); } catch {}
}

type EngineOpts = {
  visible?: boolean;
  dprMode?: 'fixed1' | 'cap2' | 'cap1_5' | 'auto';
  mount?: string;          // where to mount
  layout?: 'fixed' | 'inherit' | 'auto'; // see ensureMount semantics
  zIndex?: number;         // override z-index safely
};

export function useCanvasEngine(opts: EngineOpts = {}) {
  const {
    visible = true,
    dprMode = 'cap2',
    mount = '#canvas-root',
    layout = 'fixed',
    zIndex = 2,
  } = opts;

  const controlsRef = useRef<CanvasEngineControls | null>(null);
  const readyRef = useRef(false);
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    // init
    controlsRef.current = startCanvasEngine({
      mount,
      dprMode,       
      zIndex,       
      onReady: () => {
        readyRef.current = true;
        setReadyTick((t) => t + 1);
      },
    });

    return () => {
      readyRef.current = false;
      try { controlsRef.current?.setVisible?.(false); } catch {}
      try { controlsRef.current?.stop?.(); } catch {}
      controlsRef.current = null;
      disposeTexturesIfAny();
      // Make sure the specific mount is fully torn down
      try { stopCanvasEngine(mount); } catch {}
    };
  }, [dprMode, mount, layout, zIndex]);

  useEffect(() => {
    controlsRef.current?.setVisible?.(Boolean(visible));
  }, [visible]);

  return {
    ready: readyRef,
    controls: controlsRef,
    readyTick,
  };
}
