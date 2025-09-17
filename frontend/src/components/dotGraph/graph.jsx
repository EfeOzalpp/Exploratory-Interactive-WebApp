// components/dotGraph/graph.jsx
import React from 'react';
import { Canvas } from '@react-three/fiber';
import DotGraph from './dotGraph';
import { useGraph } from '../../context/graphContext.tsx';
import '../../styles/graph.css';

const Graph = ({ isDragging }) => {
  const { data: surveyData, loading, section } = useGraph();

  if (!section) return <p className="graph-loading">Pick a section to begin.</p>;
  if (loading) return null;

  // always pass an array
  const safeData = Array.isArray(surveyData) ? surveyData : [];

  return (
    <div className="graph-container" style={{ height: '100svh', width: '100%' }}>
      <Canvas camera={{ position: [0, 0, 25], fov: 20 }}>
        <ambientLight intensity={1.2} penumbra={1.5} />
        <directionalLight
          position={[13, 13, 13]}
          intensity={1.1}
          penumbra={2.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0005}
        />
        <spotLight
          position={[0, 0, 0]}
          intensity={2.1}
          angle={Math.PI / 1}
          penumbra={7.5}
          distance={10000}
          decay={0.2}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          castShadow
        />

        <meshStandardMaterial metalness={0.8} roughness={0} />

        {/* pass safe array */}
        <DotGraph data={safeData} isDragging={isDragging} />
      </Canvas>
    </div>
  );
};

export default Graph;
