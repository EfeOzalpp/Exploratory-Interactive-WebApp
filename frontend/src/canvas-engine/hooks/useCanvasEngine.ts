// src/canvas-engine/hooks/useCanvasEngine.ts
import { useEffect, useRef, useState } from 'react';
import {
  startCanvasEngine,
  stopCanvasEngine,
  type CanvasEngineControls,
} from '../runtime/index.ts';

type EngineOpts = {
  visible?: boolean;
  dprMode?: 'fixed1' | 'cap2' | 'cap1_5' | 'auto';
  mount?: string;
  zIndex?: number;
};

function safeCall(fn: unknown) {
  try {
    if (typeof fn === 'function') fn();
  } catch {}
}

function disposeGlobalEngineResources() {
  safeCall((window as any).__GP_DISPOSE_TEX);
  safeCall((window as any).__GP_BUMP_GEN);
  safeCall((window as any).__GP_RESET_QUEUE);
}

function shutdownControls(controls: CanvasEngineControls | null, mount: string) {
  if (!controls) {
    // Still ensure the mount is torn down, in case a partial init happened.
    safeCall(() => stopCanvasEngine(mount));
    return;
  }

  // First hide, then stop. Hiding first reduces visible flash during teardown.
  safeCall(() => controls.setVisible?.(false));
  safeCall(() => controls.stop?.());

  // Ensure the mount node and any engine-owned listeners are detached.
  safeCall(() => stopCanvasEngine(mount));
}

export function useCanvasEngine(opts: EngineOpts = {}) {
  const {
    visible = true,
    dprMode = 'cap2',
    mount = '#canvas-root',
    zIndex = 2,
  } = opts;

  const controlsRef = useRef<CanvasEngineControls | null>(null);
  const readyRef = useRef(false);
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    readyRef.current = false;

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

      const controls = controlsRef.current;
      controlsRef.current = null;

      shutdownControls(controls, mount);
      disposeGlobalEngineResources();
    };
  }, [dprMode, mount, zIndex]);

  useEffect(() => {
    safeCall(() => controlsRef.current?.setVisible?.(Boolean(visible)));
  }, [visible]);

  return {
    ready: readyRef,
    controls: controlsRef,
    readyTick,
  };
}
