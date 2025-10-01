// src/components/dotGraph/graph.jsx
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents, Preload } from '@react-three/drei';
import * as THREE from 'three';
import DotGraph from './dotGraph';
import { useGraph } from '../../context/graphContext.tsx';
import { useRealMobileViewport } from '../real-mobile.ts';
import Effects from './effects.jsx'; // <-- correct casing & path
import '../../styles/graph.css';

const Graph = ({ isDragging }) => {
  // ---- Hooks: always called, in the same order ----
  const { data: surveyData, loading, section } = useGraph();
  const isRealMobile = useRealMobileViewport();

  // Safe data array
  const safeData = Array.isArray(surveyData) ? surveyData : [];

  // Heuristics for “low” vs “high” fidelity
  const isNarrow = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  // Keep the original “low” idea for heavier features,
  // but don’t punish text/circles on mobile.
  const lowFidelity = isNarrow && !isRealMobile;

  // Renderer DPR (memoized)
  const dpr = useMemo(() => {
    const device = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    // Mobile: keep crispness but reduce the cap slightly to avoid GPU-bound
    // min ~1.3 so UI/circles aren’t blurry; max ~1.7 for perf
    if (isRealMobile) {
      const min = Math.min(1.3, Math.max(1, device));
      const max = Math.min(1.7, device);
      return [min, max];
    }

    // Desktop: reasonable cap, still a bit conservative
    const maxCap = Math.min(2.2, device);
    return lowFidelity ? [1, Math.min(1.9, maxCap)] : [1, maxCap];
  }, [isRealMobile, lowFidelity]);

  const wantAA = true;
  const enableShadows = false;

  // Lighting: keep close to your originals but a touch brighter
  const ambientIntensity = lowFidelity ? 1.0 : 1.15;
  const dirIntensity = lowFidelity ? 0.9 : 1.1;

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
          shadows={enableShadows}
          gl={{
            antialias: wantAA,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            alpha: true, // transparent background
            preserveDrawingBuffer: false,
          }}
          onCreated={({ gl }) => {
            // Preserve native CSS rgb look
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.NoToneMapping;
          }}
          frameloop="always"
        >
          {/* Lights */}
          <ambientLight intensity={ambientIntensity} />
          <directionalLight
            position={[13, 13, 13]}
            intensity={dirIntensity}
            castShadow={false}
          />
          <spotLight
            position={[0, 0, 0]}
            intensity={lowFidelity ? 1.2 : 2.0}
            angle={Math.PI / 1}
            distance={10000}
            decay={0.2}
            castShadow={false}
          />

          {/* Graph */}
          <DotGraph data={safeData} isDragging={isDragging} />

          {/* Post FX — tune here */}
          <Effects
            saturation={0.6}     // subtle color pop
            contrast={800.25}       // slight separation
            brightness={0.2}      // keep neutral
            bloom={true}          // highlight glow
            bloomStrength={0.26}  // very light glow
            bloomRadius={0.12}    // softness of glow
            bloomThreshold={0.88} // only brightest parts glow
          />

          {/* Perf helpers */}
          {isRealMobile ? <AdaptiveDpr /> : <AdaptiveDpr /* pixelated */ />}
          <AdaptiveEvents />
          <Preload all />
        </Canvas>
      )}
    </div>
  );
};

export default Graph;
