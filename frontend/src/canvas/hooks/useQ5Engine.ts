// src/canvas/hooks/useQ5Engine.ts
import { useEffect, useRef, useState } from 'react';
import { startQ5, type Q5Controls } from '../q5.js';

type EngineOpts = {
  visible?: boolean;
  dprMode?: 'fixed1' | 'cap2';
};

export function useQ5Engine(opts: EngineOpts = {}) {
  const { visible = true, dprMode = 'fixed1' } = opts;

  // Use the declared controls type from q5.js.d.ts
  const controlsRef = useRef<Q5Controls | null>(null);
  const readyRef = useRef(false);
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    controlsRef.current = startQ5({
      mount: '#canvas-root',
      dprMode,
      onReady: () => {
        readyRef.current = true;
        setReadyTick((t) => t + 1); // signal “ready” to React
      },
    });

    return () => {
      readyRef.current = false;
      controlsRef.current?.stop?.();
      controlsRef.current = null;
    };
  }, [dprMode]);

  useEffect(() => {
    controlsRef.current?.setVisible?.(Boolean(visible));
  }, [visible]);

  return {
    ready: readyRef,
    controls: controlsRef,
    readyTick,
  };
}
