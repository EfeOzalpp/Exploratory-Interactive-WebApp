// components/canvas/hooks/useQ5Engine.ts
import { useEffect, useRef, useState } from 'react';
import { startQ5, type Q5Controls, stopQ5 } from '../q5-lite.js';

function disposeTexturesIfAny() {
  try { (window as any).__GP_DISPOSE_TEX?.(); } catch {}
  try { (window as any).__GP_BUMP_GEN?.(); } catch {}
  try { (window as any).__GP_RESET_QUEUE?.(); } catch {}
}

type EngineOpts = {
  visible?: boolean;
  dprMode?: 'fixed1' | 'cap2' | 'cap1_5' | 'auto';
  mount?: string;          // NEW: where to mount
  layout?: 'fixed' | 'inherit' | 'auto'; // NEW: see ensureMount semantics
  zIndex?: number;         // NEW: override z-index safely
};

export function useQ5Engine(opts: EngineOpts = {}) {
  const {
    visible = true,
    dprMode = 'cap2',
    mount = '#canvas-root',
    layout = 'fixed',
    zIndex = 2,
  } = opts;

  const controlsRef = useRef<Q5Controls | null>(null);
  const readyRef = useRef(false);
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    // init
    controlsRef.current = startQ5({
      mount,
      dprMode,
      layout,       // ← pass through
      zIndex,       // ← pass through
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
      try { stopQ5(mount); } catch {}
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
