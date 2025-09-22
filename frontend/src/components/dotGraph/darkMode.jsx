// src/components/dotGraph/darkMode.jsx  (EdgeCue)
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ROOT_ID = 'gp-edge-cue-root';

export default function EdgeCue() {
  const [mount, setMount] = useState(null);

  // Canonical “latched” means LIGHT mode (no overlay).
  // Default to true (light) if global isn’t set yet.
  const getInitial = () => {
    if (typeof window === 'undefined') return true;
    return window.__gpEdgeLatched == null ? true : !!window.__gpEdgeLatched;
  };
  const [latchedOn, setLatchedOn] = useState(getInitial);

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

  // Subscribe to canonical state updates (mobile + desktop)
  useEffect(() => {
    const onState = (e) => {
      const { latched } = (e && e.detail) || {};
      if (typeof latched === 'boolean') setLatchedOn(!!latched);
    };
    window.addEventListener('gp:edge-cue-state', onState);
    return () => window.removeEventListener('gp:edge-cue-state', onState);
  }, []);

  // IMPORTANT: invert visibility
  // latchedOn === true  -> LIGHT (no overlay)
  // latchedOn === false -> DARK (show overlay)
  if (!mount || latchedOn) return null;

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
          inset: 0,
          borderRadius: 0,
          backgroundColor: 'rgba(3, 3, 3, 0.82)', // dark overlay for dark mode
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25), 0 0 20px rgba(0,0,0,0.12)',
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
