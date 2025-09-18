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

  // Keep ONE uniforms object; mutate its values in effects.
  const uniforms = useMemo(() => ({
    uColor:     { value: new Color('#ffffff') },
    uOpacity:   { value: opacityIdle },
    uOuter:     { value: 0.9 },      // how far from center the ring lives
    uThickness: { value: thickness },
    uFeather:   { value: feather },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []); // stable object, we update fields below

  // Update color on prop change (handles hex, named, and css rgb()/hsl())
  useEffect(() => {
    if (!matRef.current) return;
    const c = matRef.current.uniforms.uColor.value;
    if (typeof color === 'string') {
      // setStyle parses css color strings (rgb(), hsl(), hex, named)
      c.setStyle ? c.setStyle(color) : c.set(color);
    } else if (color && typeof color === 'object') {
      // support { r,g,b } in 0..255 or 0..1
      const r = 'r' in color ? color.r : 1;
      const g = 'g' in color ? color.g : 1;
      const b = 'b' in color ? color.b : 1;
      const norm = (v) => (v > 1 ? v / 255 : v);
      c.setRGB(norm(r), norm(g), norm(b));
    }
  }, [color]);

  // Update scalar uniforms when props change
  useEffect(() => {
    if (matRef.current) matRef.current.uniforms.uThickness.value = thickness;
  }, [thickness]);

  useEffect(() => {
    if (matRef.current) matRef.current.uniforms.uFeather.value = feather;
  }, [feather]);

  useEffect(() => {
    if (meshRef.current && typeof bloomLayer === 'number') {
      meshRef.current.layers.disable(bloomLayer); // keep halo off bloom layer if desired
    }
  }, [bloomLayer]);

  const fragment = /* glsl */`
    uniform vec3  uColor;
    uniform float uOpacity;
    uniform float uOuter;
    uniform float uThickness;
    uniform float uFeather;
    varying vec2 vUv;

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);

      float innerEdge = smoothstep(uOuter - uThickness, uOuter, r);
      float outerFade = 1.0 - smoothstep(uOuter, uOuter + uFeather, r);
      float ring = innerEdge * outerFade;

      float alpha = ring * uOpacity;

      if (r < (uOuter - uThickness*1.01)) discard;
      if (r > (uOuter + uFeather*0.99))  discard;
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
          depthTest
          blending={NormalBlending}
          toneMapped={false}
          premultipliedAlpha
        />
      </mesh>
    </Billboard>
  );
}
