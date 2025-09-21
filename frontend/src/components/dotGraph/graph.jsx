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
  const lowFidelity = isRealMobile || isNarrow;

  // Renderer DPR (memoized)
  const dpr = useMemo(() => {
    const max = typeof window !== 'undefined' ? window.devicePixelRatio || 1.5 : 1.5;
    return lowFidelity ? [1, 1.25] : [1, Math.min(2, max)];
  }, [lowFidelity]);

  // ---- Single return; conditionals handled inside JSX ----
  return (
    <div className="graph-container" style={{ height: '100svh', width: '100%' }}>
      {!section ? (
        <p className="graph-loading">Pick a section to begin.</p>
      ) : loading ? (
        // Keep layout stable while loading
        <div className="graph-loading" aria-busy="true" />
      ) : (
        <Canvas
          camera={{ position: [0, 0, 25], fov: 20 }}
          dpr={dpr}
          shadows={!lowFidelity}
          gl={{
            antialias: !lowFidelity,
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
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <Preload all />
        </Canvas>
      )}
    </div>
  );
};

export default Graph;
