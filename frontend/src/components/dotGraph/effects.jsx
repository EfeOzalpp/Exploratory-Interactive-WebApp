// src/components/Effects.jsx
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { HueSaturationShader } from 'three/examples/jsm/shaders/HueSaturationShader.js'
import { BrightnessContrastShader } from 'three/examples/jsm/shaders/BrightnessContrastShader.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/**
 * Props you can tune:
 * - saturation: [-1..1] (0.12 = +12% is subtle)
 * - brightness: [-1..1]
 * - contrast:   [-1..1] (0.04 = +4% is subtle)
 * - bloom: enable/disable glow
 * - bloomStrength: ~0.0 - 3.0 (start tiny like 0.2)
 * - bloomRadius:   ~0.0 - 1.0 (softness, start 0.15)
 * - bloomThreshold: 0..1 (what’s considered “bright”; higher = fewer pixels glow)
 */
export default function Effects({
  saturation = 0.12,
  brightness = 0.0,
  contrast = 0.04,
  bloom = true,
  bloomStrength = 0.2,
  bloomRadius = 0.15,
  bloomThreshold = 0.85,
}) {
  const { gl, scene, camera, size } = useThree()
  const composer = useRef(null)
  const satPass = useRef(null)
  const bcPass = useRef(null)
  const bloomPass = useRef(null)

    // src/components/Effects.jsx
    useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;

    // Keep transparency through the post stack:
    gl.setClearColor(0x000000, 0);   // transparent clear
    gl.setClearAlpha(0);
    gl.autoClear = false;            // we'll let the composer handle the passes

    const comp = new EffectComposer(gl);
    comp.addPass(new RenderPass(scene, camera));
    // ... add your sat/contrast/bloom passes ...
    comp.setSize(size.width, size.height);

    composer.current = comp;
    return () => {
        comp?.dispose();
        gl.autoClear = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gl, scene, camera, bloom]);

  // Keep sizes and uniforms in sync
  useEffect(() => {
    composer.current?.setSize(size.width, size.height)
    if (bloomPass.current) bloomPass.current.setSize(size.width, size.height)
  }, [size])

  useEffect(() => {
    if (satPass.current) satPass.current.uniforms.saturation.value = saturation
  }, [saturation])

  useEffect(() => {
    if (bcPass.current) {
      bcPass.current.uniforms.brightness.value = brightness
      bcPass.current.uniforms.contrast.value = contrast
    }
  }, [brightness, contrast])

  useEffect(() => {
    if (bloomPass.current) {
      bloomPass.current.strength = bloomStrength
      bloomPass.current.radius = bloomRadius
      bloomPass.current.threshold = bloomThreshold
    }
  }, [bloomStrength, bloomRadius, bloomThreshold])

  useFrame((_, delta) => composer.current?.render(delta), 1)
  return null
}
