// components/survey/DoneOverlayR3F.jsx
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export default function DoneOverlayR3F({ onComplete }) {
  return (
    <Canvas style={{ position: 'fixed', inset: 0, zIndex: 22, pointerEvents: 'none' }}>
      <Html zIndexRange={[22, 22]}>
        <div
          className="z-index-respective"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100vh',
            pointerEvents: 'none',
          }}
        >
          <div className="survey-section-wrapper2" style={{ pointerEvents: 'auto' }}>
            <div className="survey-section">
              <div className="surveyStart">
                <button className="begin-button4" onClick={onComplete}>
                  <h4>Done</h4>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Html>
    </Canvas>
  );
}
