// RingHalo.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { NormalBlending, Color } from 'three';

export default function RingHalo({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,
  thickness = 0.2,     // ring thickness (relative 0..1)
  feather   = 0.12,     // soft fade outside the ring
  opacityIdle = 0.06,
  opacityActive = 0.1,
  pulseIdle = 0.0075,
  pulseActive = 0.015,
  scale = 2.0,
  bloomLayer,           // optional: keep halo out of selective bloom
}) {
  const matRef = useRef(null);
  const meshRef = useRef(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const base = active ? opacityActive : opacityIdle;
    const amp  = active ? pulseActive   : pulseIdle;
    const pulse = base + Math.sin(t * 1.6) * amp;
    if (matRef.current) matRef.current.uniforms.uOpacity.value = pulse;
  });

  const fragment = /* glsl */`
    uniform vec3  uColor;
    uniform float uOpacity;
    uniform float uOuter;
    uniform float uThickness;
    uniform float uFeather;
    varying vec2 vUv;

    void main() {
      // normalized radius from center
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);

      // ring = band between (uOuter - uThickness) .. uOuter,
      // with a feathered falloff after uOuter
      float innerEdge = smoothstep(uOuter - uThickness, uOuter, r);
      float outerFade = 1.0 - smoothstep(uOuter, uOuter + uFeather, r);
      float ring = innerEdge * outerFade;

      // Only the rim — no inner "soft" body at all
      float alpha = ring * uOpacity;

      // Hard reject pixels well outside or inside to prevent any fill
      if (r < (uOuter - uThickness*1.01)) discard;
      if (r > (uOuter + uFeather*0.99))  discard;

      // Cull very faint fragments to avoid post FX ghosts
      if (alpha < 0.03) discard;

      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  const vertex = /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const uniforms = useMemo(() => ({
    uColor:     { value: new Color(color) },
    uOpacity:   { value: opacityIdle },
    uOuter:     { value: 0.9},       // how far from center the ring lives
    uThickness: { value: thickness },
    uFeather:   { value: feather },
  }), [color, opacityIdle, thickness, feather]);

  useEffect(() => {
    if (meshRef.current && typeof bloomLayer === 'number') {
      // Keep the ring OFF your selective-bloom layer
      meshRef.current.layers.disable(bloomLayer);
    }
  }, [bloomLayer]);

  return (
    <Billboard frustumCulled={false}>
      <mesh
        ref={meshRef}
        scale={baseRadius * scale}
        renderOrder={10}
        raycast={null}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 96]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          depthTest={true}
          blending={NormalBlending}
          toneMapped={false}
          premultipliedAlpha
        />
      </mesh>
    </Billboard>
  );
}