// src/canvas/hooks/useQ5Engine.ts
import { useEffect, useRef, useState } from 'react';
import { startQ5, type Q5Controls } from '../q5-lite.js';

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
      controlsRef.current?.stop?.();
      controlsRef.current = null;
    };
  }, [dprMode]);

  // toggle visibility dynamically
  useEffect(() => {
    controlsRef.current?.setVisible?.(Boolean(visible));
  }, [visible]);

  return {
    ready: readyRef,
    controls: controlsRef,
    readyTick,
  };
}
