import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGraph } from '../../context/graphContext.tsx';

const ROOT_ID = 'gp-edge-cue-root';

export default function EdgeCue() {
  const { darkMode } = useGraph(); // ← canonical source
  const [mount, setMount] = useState(null);

  // Ensure portal root
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    setMount(root);
  }, []);

  // In this refactor, we simply mirror context:
  // darkMode === true  -> show overlay
  // darkMode === false -> hide overlay
  if (!mount || !darkMode) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 0,
          backgroundColor: 'rgba(13, 14, 15, 0.91)', // dark overlay for dark mode
          opacity: 1,
          transform: 'scale(1)',
          transition: 'opacity 140ms linear, transform 140ms ease-out',
          mixBlendMode: 'difference',
          willChange: 'opacity, transform',
        }}
      />
    </div>,
    mount
  );
}
