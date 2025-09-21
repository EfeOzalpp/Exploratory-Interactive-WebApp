// src/components/dotGraph/ringHalo.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { NormalBlending, AdditiveBlending, Color } from 'three';

/* ------------------------ Foreground: rimmed ring ------------------------ */
function RimHaloPass({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,

  // soft ring band
  thickness = 0.18,
  feather   = 0.10,

  // crisp inner rim accent (helps color read on light BG)
  rimWidth    = 0.035,
  rimFeather  = 0.010,
  rimStrength = 0.85,

  // opacity / pulse
  opacityIdle   = 0.08,
  opacityActive = 0.16,
  pulseIdle     = 0.004,
  pulseActive   = 0.008,

  // footprint
  scale = 1.65,

  // center radius
  outer = 0.9,

  // blending & intensity
  intensity = 1.0,
  blendMode = 'normal', // keep color true

  bloomLayer,
}) {
  const matRef  = useRef(null);
  const meshRef = useRef(null);

  // keep animated uniforms in sync with props
  const activeRef        = useRef(active);
  const opacityIdleRef   = useRef(opacityIdle);
  const opacityActiveRef = useRef(opacityActive);
  const pulseIdleRef     = useRef(pulseIdle);
  const pulseActiveRef   = useRef(pulseActive);

  useEffect(() => { activeRef.current        = active;        }, [active]);
  useEffect(() => { opacityIdleRef.current   = opacityIdle;   }, [opacityIdle]);
  useEffect(() => { opacityActiveRef.current = opacityActive; }, [opacityActive]);
  useEffect(() => { pulseIdleRef.current     = pulseIdle;     }, [pulseIdle]);
  useEffect(() => { pulseActiveRef.current   = pulseActive;   }, [pulseActive]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const base = activeRef.current ? opacityActiveRef.current : opacityIdleRef.current;
    const amp  = activeRef.current ? pulseActiveRef.current   : pulseIdleRef.current;
    const a    = base + Math.sin(t * 1.6) * amp;
    if (matRef.current) matRef.current.uniforms.uOpacity.value = a;
  });

  const uniforms = useMemo(() => ({
    uColor:       { value: new Color('#ffffff') },
    uOpacity:     { value: opacityIdle },
    uOuter:       { value: outer },
    uThickness:   { value: thickness },
    uFeather:     { value: feather },
    uRimWidth:    { value: rimWidth },
    uRimFeather:  { value: rimFeather },
    uRimStrength: { value: rimStrength },
    uIntensity:   { value: Math.max(0.1, intensity) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // color → uniform
  useEffect(() => {
    if (!matRef.current) return;
    const c = matRef.current.uniforms.uColor.value;
    if (typeof color === 'string') (c.setStyle ? c.setStyle(color) : c.set(color));
    else if (color && typeof color === 'object') {
      const norm = (v) => (v > 1 ? v / 255 : v);
      c.setRGB(norm(color.r ?? 1), norm(color.g ?? 1), norm(color.b ?? 1));
    }
  }, [color]);

  // numeric uniforms
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uOuter.value       = outer;       }, [outer]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uThickness.value   = thickness;   }, [thickness]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uFeather.value     = feather;     }, [feather]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uRimWidth.value    = rimWidth;    }, [rimWidth]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uRimFeather.value  = rimFeather;  }, [rimFeather]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uRimStrength.value = rimStrength; }, [rimStrength]);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uIntensity.value   = Math.max(0.1, intensity); }, [intensity]);

  // keep out of bloom to avoid washout
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
    uniform float uRimWidth;
    uniform float uRimFeather;
    uniform float uRimStrength;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);

      // soft band
      float innerHalo = smoothstep(uOuter - uThickness, uOuter, r);
      float outerHalo = 1.0 - smoothstep(uOuter, uOuter + uFeather, r);
      float halo      = innerHalo * outerHalo;

      // thin crisp rim
      float rimInner  = smoothstep(uOuter - uRimWidth, uOuter, r);
      float rimOuter  = 1.0 - smoothstep(uOuter, uOuter + uRimFeather, r);
      float rim       = rimInner * rimOuter;

      float alpha = (halo * uOpacity + rim * uRimStrength * uOpacity) * uIntensity;
      alpha = clamp(alpha, 0.0, 0.95);

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

  const blending = blendMode === 'additive' ? AdditiveBlending : NormalBlending;

  return (
    <mesh ref={meshRef} scale={baseRadius * scale} renderOrder={12} frustumCulled={false}>
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
        premultipliedAlpha={false}
      />
    </mesh>
  );
}

/* ------------------------- Background: soft glow ------------------------- */
function SoftGlowPass({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,

  thickness = 0.26,
  feather   = 0.30,

  // with normal blending, we can run a bit higher opacity without warming the hue
  opacityIdle   = 0.055, // was 0.035 (additive)
  opacityActive = 0.110, // was 0.070
  pulseIdle     = 0.003,
  pulseActive   = 0.006,

  scale = 1.78,
  outer = 0.9,
  intensity = 1.0,       // no extra boost needed with normal blending
  blendMode = 'normal',  // <<< key change to avoid orangy cast on light BG
  bloomLayer,
}) {
  const matRef  = useRef(null);
  const meshRef = useRef(null);

  const activeRef        = useRef(active);
  const opacityIdleRef   = useRef(opacityIdle);
  const opacityActiveRef = useRef(opacityActive);
  const pulseIdleRef     = useRef(pulseIdle);
  const pulseActiveRef   = useRef(pulseActive);

  useEffect(() => { activeRef.current        = active;        }, [active]);
  useEffect(() => { opacityIdleRef.current   = opacityIdle;   }, [opacityIdle]);
  useEffect(() => { opacityActiveRef.current = opacityActive; }, [opacityActive]);
  useEffect(() => { pulseIdleRef.current     = pulseIdle;     }, [pulseIdle]);
  useEffect(() => { pulseActiveRef.current   = pulseActive;   }, [pulseActive]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const base = activeRef.current ? opacityActiveRef.current : opacityIdleRef.current;
    const amp  = activeRef.current ? pulseActiveRef.current   : pulseIdleRef.current;
    const a    = base + Math.sin(t * 1.3) * amp;
    if (matRef.current) matRef.current.uniforms.uOpacity.value = a;
  });

  const uniforms = useMemo(() => ({
    uColor:     { value: new Color('#ffffff') },
    uOpacity:   { value: opacityIdle },
    uOuter:     { value: outer },
    uThickness: { value: thickness },
    uFeather:   { value: feather },
    uIntensity: { value: Math.max(0.1, intensity) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    if (!matRef.current) return;
    const c = matRef.current.uniforms.uColor.value;
    if (typeof color === 'string') (c.setStyle ? c.setStyle(color) : c.set(color));
    else if (color && typeof color === 'object') {
      const norm = (v) => (v > 1 ? v / 255 : v);
      c.setRGB(norm(color.r ?? 1), norm(color.g ?? 1), norm(color.b ?? 1));
    }
  }, [color]);

  useEffect(() => { if (matRef.current) matRef.current.uniforms.uOuter.value     = outer;     }, [outer]);
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

      float inner = smoothstep(uOuter - uThickness, uOuter, r);
      float outer = 1.0 - smoothstep(uOuter, uOuter + uFeather, r);
      float mask  = inner * outer;

      float alpha = mask * uOpacity * uIntensity;
      if (alpha < 0.01) discard;

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

  const blending = blendMode === 'additive' ? AdditiveBlending : NormalBlending;

  return (
    <mesh ref={meshRef} scale={baseRadius * scale} renderOrder={10} frustumCulled={false}>
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
        premultipliedAlpha={false}
      />
    </mesh>
  );
}

/* ----------------------------- Composite API ----------------------------- */
function HaloComposite({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,
  bloomLayer,
  bgProps = {},
  rimProps = {},
}) {
  return (
    <Billboard frustumCulled={false}>
      <SoftGlowPass
        color={color}
        baseRadius={baseRadius}
        active={active}
        bloomLayer={bloomLayer}
        {...bgProps}
      />
      <RimHaloPass
        color={color}
        baseRadius={baseRadius}
        active={active}
        bloomLayer={bloomLayer}
        {...rimProps}
      />
    </Billboard>
  );
}

/* ------------------------------ Public API ------------------------------- */
export default function RingHalo({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,
  bloomLayer,
  bgProps,
  rimProps,
}) {
  return (
    <HaloComposite
      color={color}
      baseRadius={baseRadius}
      active={active}
      bloomLayer={bloomLayer}
      bgProps={{
        // normal-blended cushion to prevent warm shift on light BGs
        thickness: 0.26,
        feather:   0.30,
        opacityIdle:   0.055,
        opacityActive: 0.110,
        pulseIdle:     0.003,
        pulseActive:   0.006,
        scale: 1.78,
        blendMode: 'normal', // <<< important
        intensity: 1.0,
        ...bgProps,
      }}
      rimProps={{
        // color-true, readable edge in front
        thickness: 0.18,
        feather:   0.10,
        rimWidth:    0.035,
        rimFeather:  0.010,
        rimStrength: 0.85,
        opacityIdle:   0.08,
        opacityActive: 0.16,
        pulseIdle:     0.004,
        pulseActive:   0.008,
        scale: 1.65,
        blendMode: 'normal',
        intensity: 1.0,
        ...rimProps,
      }}
    />
  );
}

export function RingHaloMini({
  color = '#ffffff',
  baseRadius = 1.2,
  active = false,
  bloomLayer,
  bgProps,
  rimProps,
}) {
  return (
    <HaloComposite
      color={color}
      baseRadius={baseRadius}
      active={active}
      bloomLayer={bloomLayer}
      bgProps={{
        thickness: 0.22,
        feather:   0.22,
        opacityIdle:   0.06,   // a touch higher with normal blending
        opacityActive: 0.12,
        pulseIdle:     0.003,
        pulseActive:   0.006,
        scale: 1.62,
        blendMode: 'normal',  // keep hue neutral
        intensity: 1.2,
        ...bgProps,
      }}
      rimProps={{
        thickness: 0.14,
        feather:   0.08,
        rimWidth:    0.030,
        rimFeather:  0.010,
        rimStrength: 0.90,
        opacityIdle:   0.09,
        opacityActive: 0.17,
        pulseIdle:     0.0035,
        pulseActive:   0.007,
        scale: 1.50,
        blendMode: 'normal',
        intensity: 1.0,
        ...rimProps,
      }}
    />
  );
}
