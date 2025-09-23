// src/components/dotGraph/graph.jsx
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, Preload } from '@react-three/drei';
import DotGraph from './dotGraph';
import { useGraph } from '../../context/graphContext.tsx';
import { useRealMobileViewport } from '../real-mobile.ts';
import '../../styles/graph.css';

const Graph = ({ isDragging }) => {
  // ---- Hooks: always called, in the same order ----
  const { data: surveyData, loading, section } = useGraph();
  const isRealMobile = useRealMobileViewport();

  // Safe data array
  const safeData = Array.isArray(surveyData) ? surveyData : [];

  // Heuristics for “low” vs “high” fidelity
  const isNarrow =
    typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  // Keep the original “low” idea for heavier features,
  // but don’t punish text/circles on mobile.
  const lowFidelity = isNarrow && !isRealMobile;

  // Renderer DPR (memoized)
  const dpr = useMemo(() => {
    const device = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    // On touch devices, bump sharpness but cap for perf.
    //  - min ~1.4 so UI/circles aren’t blurry
    //  - max ~2 on mobile to avoid melting GPUs
    if (isRealMobile) {
      const min = Math.min(1.5, Math.max(1, device));
      const max = Math.min(2, device);
      return [min, max];
    }

    // Desktop: allow a bit higher cap, but still clamp
    const maxCap = Math.min(2.5, device);
    return lowFidelity ? [1, Math.min(2, maxCap)] : [1, maxCap];
  }, [isRealMobile, lowFidelity]);

  // Antialiasing:
  //  - Enable on mobile to clean up circle edges.
  //  - On desktop keep it on unless you truly need the perf.
  const wantAA = true;

  return (
    <div className="graph-container" style={{ height: '100svh', width: '100%' }}>
      {!section ? (
        <p className="graph-loading">Pick a section to begin.</p>
      ) : loading ? (
        <div className="graph-loading" aria-busy="true" />
      ) : (
        <Canvas
          camera={{ position: [0, 0, 25], fov: 20 }}
          dpr={dpr}
          shadows={!lowFidelity}
          gl={{
            antialias: wantAA,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            alpha: true,
            preserveDrawingBuffer: false,
          }}
          frameloop="always"
        >
          {/* Lights */}
          <ambientLight intensity={lowFidelity ? 0.9 : 1.2} />
          <directionalLight
            position={[13, 13, 13]}
            intensity={lowFidelity ? 0.8 : 1.1}
            castShadow={!lowFidelity}
            shadow-mapSize-width={lowFidelity ? 1024 : 2048}
            shadow-mapSize-height={lowFidelity ? 1024 : 2048}
            shadow-bias={-0.0005}
          />
          <spotLight
            position={[0, 0, 0]}
            intensity={lowFidelity ? 1.2 : 2.1}
            angle={Math.PI / 1}
            distance={10000}
            decay={0.2}
            castShadow={false}
          />

          {/* Graph */}
          <DotGraph data={safeData} isDragging={isDragging} />

          {/* Perf helpers */}
          {/* Important: avoid pixelated scaling on mobile to prevent blocky circles */}
          {isRealMobile ? <AdaptiveDpr /> : <AdaptiveDpr /* pixelated */ />}
          <AdaptiveEvents />
          <Preload all />
        </Canvas>
      )}
    </div>
  );
};

export default Graph;
