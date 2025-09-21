// src/components/dotGraph/ringHalo.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  NormalBlending,
  AdditiveBlending,
  Color,
} from 'three';

function HaloBase({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,
  thickness = 0.2,
  feather   = 0.12,
  opacityIdle = 0.06,
  opacityActive = 0.1,
  pulseIdle = 0.0075,
  pulseActive = 0.015,
  scale = 2.0,
  bloomLayer,

  // NEW:
  blendMode = 'additive', // 'additive' | 'normal'
  intensity = 1.0,        // multiplies alpha (helps on light bgs)
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

  const uniforms = useMemo(() => ({
    uColor:     { value: new Color('#ffffff') },
    uOpacity:   { value: opacityIdle },
    uOuter:     { value: 0.9 },
    uThickness: { value: thickness },
    uFeather:   { value: feather },
    uIntensity: { value: Math.max(0.1, intensity) }, // clamp a bit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    if (!matRef.current) return;
    const c = matRef.current.uniforms.uColor.value;
    if (typeof color === 'string') {
      c.setStyle ? c.setStyle(color) : c.set(color);
    } else if (color && typeof color === 'object') {
      const norm = (v) => (v > 1 ? v / 255 : v);
      c.setRGB(norm(color.r ?? 1), norm(color.g ?? 1), norm(color.b ?? 1));
    }
  }, [color]);

  useEffect(() => { if (matRef.current) matRef.current.uniforms.uThickness.value = thickness; }, [thickness]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uFeather.value   = feather;   }, [feather]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uIntensity.value = Math.max(0.1, intensity); }, [intensity]);

  useEffect(() => {
    if (meshRef.current && typeof bloomLayer === 'number') {
      meshRef.current.layers.disable(bloomLayer);
    }
  }, [bloomLayer]);

  const fragment = /* glsl */`
    uniform vec3  uColor;
    uniform float uOpacity;
    uniform float uOuter;
    uniform float uThickness;
    uniform float uFeather;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);

      // soft ring mask
      float innerEdge = smoothstep(uOuter - uThickness, uOuter, r);
      float outerFade = 1.0 - smoothstep(uOuter, uOuter + uFeather, r);
      float ring = innerEdge * outerFade;

      // boost alpha for visibility on light backgrounds
      float alpha = ring * uOpacity * uIntensity;

      // trim ultra-faint fragments to avoid overdraw
      if (r < (uOuter - uThickness*1.01)) discard;
      if (r > (uOuter + uFeather*0.99))  discard;
      if (alpha < 0.02) discard;

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

  // pick blending
  const blending = blendMode === 'additive' ? AdditiveBlending : NormalBlending;

  return (
    <Billboard frustumCulled={false}>
      <mesh
        ref={meshRef}
        scale={baseRadius * scale}
        renderOrder={10}
        frustumCulled={false}
        // NOTE: do not set raycast=null; that breaks drei’s event system
      >
        <circleGeometry args={[1, 96]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          depthTest
          blending={blending}
          toneMapped={false}
          premultipliedAlpha
        />
      </mesh>
    </Billboard>
  );
}

export default function RingHalo(props) {
  return <HaloBase {...props} />;
}

// Smaller, brighter mini halo (good for chains/ties)
export function RingHaloMini({
  thickness = 0.16,
  feather = 0.10,
  opacityIdle = 0.06,
  opacityActive = 0.12,
  pulseIdle = 0.006,
  pulseActive = 0.012,
  scale = 1.7,
  blendMode = 'additive', // punchy by default
  intensity = 1.35,       // extra pop
  ...rest
}) {
  return (
    <HaloBase
      thickness={thickness}
      feather={feather}
      opacityIdle={opacityIdle}
      opacityActive={opacityActive}
      pulseIdle={pulseIdle}
      pulseActive={pulseActive}
      scale={scale}
      blendMode={blendMode}
      intensity={intensity}
      {...rest}
    />
  );
}
