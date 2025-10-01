// src/canvas/hooks/useQ5Engine.ts
import { useEffect, useRef } from 'react';
import { startQ5 } from '../q5';

type EngineOpts = {
  visible?: boolean;
  dprMode?: 'fixed1' | 'cap2';
};

export function useQ5Engine(opts: EngineOpts = {}) {
  const { visible = true, dprMode = 'fixed1' } = opts;
  const controlsRef = useRef<ReturnType<typeof startQ5> | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    controlsRef.current = startQ5({
      mount: '#canvas-root',
      dprMode,
      onReady: () => {
        readyRef.current = true;
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
  };
}
