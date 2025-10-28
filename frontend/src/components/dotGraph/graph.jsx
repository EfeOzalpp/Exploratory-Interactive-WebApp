// src/components/dotGraph/graph.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, Preload } from '@react-three/drei';
import * as THREE from 'three';

import DotGraph from './dotGraph';
import { useGraph } from '../../context/graphContext.tsx';
import { useRealMobileViewport } from '../real-mobile.ts';
import { bumpGeneration, resetQueue } from './canvas/textureQueue.ts';
import { disposeAllSpriteTextures } from './canvas/ShapeSpriteFactory.tsx';

import '../../styles/graph.css';

// --- iOS detector (incl. iPadOS 13+ on MacIntel) ---
const isIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const ipadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || ipadOS13Plus;
})();

// Debounce timings
const REOPEN_FUSE_MS = isIOS ? 420 : 240;     // min delay between close → open
const DESTROY_SETTLE_MS = isIOS ? 260 : 120;  // let iOS free VRAM

/* ------------------------------ WebGL Canvas ------------------------------ */
function WebGLCanvas({ data, isDragging, lowFidelity, dpr }) {
  const rendererRef = useRef(null);

  // New generation cancels any stale queued texture jobs
  useEffect(() => {
    bumpGeneration();
    return () => {
      try { bumpGeneration(); } catch {}
    };
  }, []);

  // Unmount cleanup: stop jobs, dispose textures, lose the context
  useEffect(() => {
    return () => {
      try { resetQueue(); } catch {}
      try { disposeAllSpriteTextures(); } catch {}

      const renderer = rendererRef.current;
      if (!renderer) return;

      try {
        const el = renderer.domElement;
        if (el) {
          if (el.__gp_onLost) { el.removeEventListener('webglcontextlost', el.__gp_onLost, false); el.__gp_onLost = null; }
          if (el.__gp_onRestored) { el.removeEventListener('webglcontextrestored', el.__gp_onRestored, false); el.__gp_onRestored = null; }
        }
        renderer.dispose?.();

        // Force-lose the underlying WebGL context (iPad VRAM actually frees)
        const realCtx = typeof renderer.getContext === 'function' ? renderer.getContext() : null;
        const loseExt = realCtx?.getExtension?.('WEBGL_lose_context');
        loseExt?.loseContext?.();

        try { (window).__GP_CTX_LOST = true; } catch {}
      } catch {}
    };
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 25], fov: 20 }}
      dpr={dpr}
      shadows={!lowFidelity && !isIOS}
      gl={{
        antialias: !lowFidelity && !isIOS,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        alpha: true,
        preserveDrawingBuffer: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        // If iPad still flakes, try forcing WebGL1 on iOS only:
        // context: (canvas) => canvas.getContext('webgl', { alpha: true, antialias: !lowFidelity }),
      }}
      frameloop="always"
      onCreated={({ gl }) => {
        rendererRef.current = gl;

        // Context loss visibility (hooks into your Debug HUD if present)
        const el = gl.domElement;
        const onLost = (e) => {
          try { e.preventDefault?.(); } catch {}
          try {
            (window).__GP_CTX_LOST = true;
            window.dispatchEvent(new CustomEvent('gp:webgl-lost'));
          } catch {}
          // eslint-disable-next-line no-console
          console.warn('WebGL context lost');
        };
        const onRestored = () => {
          try { (window).__GP_CTX_LOST = false; } catch {}
          // eslint-disable-next-line no-console
          console.warn('WebGL context restored');
        };
        el.__gp_onLost = onLost;
        el.__gp_onRestored = onRestored;
        el.addEventListener('webglcontextlost', onLost, false);
        el.addEventListener('webglcontextrestored', onRestored, false);
      }}
    >
      {/* Lights */}
      <ambientLight intensity={lowFidelity || isIOS ? 1.4 : 1.6} />
      <directionalLight
        position={[13, 13, 13]}
        intensity={lowFidelity || isIOS ? 0.9 : 1.1}
        castShadow={!lowFidelity && !isIOS}
        shadow-mapSize-width={lowFidelity || isIOS ? 1024 : 2048}
        shadow-mapSize-height={lowFidelity || isIOS ? 1024 : 2048}
        shadow-bias={-0.0005}
      />
      <spotLight
        position={[6, 4, 8]}
        intensity={lowFidelity || isIOS ? 3.5 : 4}
        angle={Math.PI / 1}
        distance={100}
        decay={0.4}
        castShadow={!isIOS}
      />

      {/* Graph */}
      <DotGraph data={data} isDragging={isDragging} />

      {/* Perf helpers */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      <Preload all />
    </Canvas>
  );
}

/* --------------------------------- Wrapper -------------------------------- */
const Graph = ({ isDragging }) => {
  const { data: surveyData, loading, section, vizVisible } = useGraph();
  const isRealMobile = useRealMobileViewport();

  const safeData = Array.isArray(surveyData) ? surveyData : [];

  const isNarrow = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const lowFidelity = isRealMobile || isNarrow;

  // DPR clamp (tighter on iOS)
  const dpr = useMemo(() => {
    const max = typeof window !== 'undefined' ? window.devicePixelRatio || 1.5 : 1.5;
    const hi = isIOS ? Math.min(1.5, max) : Math.min(2, max);
    return lowFidelity ? [1, 1.25] : [1, hi];
  }, [lowFidelity]);

  // Fresh Canvas per open (new WebGL context every time)
  const [mountVersion, setMountVersion] = useState(0);

  // Debounced open gate
  const [canMount, setCanMount] = useState(false);
  const lastCloseAtRef = useRef(0);
  const openTimerRef = useRef(null);

  useEffect(() => {
    // clear any pending gate timers
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (!vizVisible) {
      // closing: note the time and hide immediately
      lastCloseAtRef.current = performance.now();
      setCanMount(false);
      return;
    }

    // opening: honor reopen fuse since last close
    const elapsed = performance.now() - lastCloseAtRef.current;
    const wait = Math.max(0, REOPEN_FUSE_MS - Math.max(0, elapsed));
    openTimerRef.current = setTimeout(() => {
      setMountVersion((v) => v + 1);
      setCanMount(true);
    }, wait);

    return () => {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, [vizVisible]);

  return (
    <div className="graph-container" style={{ height: '100svh', width: '100%' }}>
      {!section ? (
        <p className="graph-loading">Pick a section to begin.</p>
      ) : loading ? (
        <div className="graph-loading" aria-busy="true" />
      ) : vizVisible && canMount ? (
        <WebGLCanvas
          key={mountVersion}
          data={safeData}
          isDragging={isDragging}
          lowFidelity={lowFidelity}
          dpr={dpr}
        />
      ) : null}
    </div>
  );
};

export default Graph;
