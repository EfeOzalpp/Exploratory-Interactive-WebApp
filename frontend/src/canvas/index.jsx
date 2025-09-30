import React, { useEffect, useRef } from 'react';
import { startQ5 } from './q5';

export default function CanvasEntry({ visible = true, answers }) {
  const controlsRef = useRef(null);

  useEffect(() => {
    controlsRef.current = startQ5({
      mount: '#canvas-root',
      onReady: ({ trigger }) => {
        if (answers && Object.keys(answers).length) {
          trigger('answers/init', { count: Object.keys(answers).length });
        }
      }
    });
    return () => { controlsRef.current?.stop?.(); controlsRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controlsRef.current?.setVisible?.(Boolean(visible));
  }, [visible]);

  return null; // canvas is body-level
}
