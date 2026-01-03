// src/graph-runtime/dotgraph/event-handlers/usePixelOffsets.ts
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import type { Camera, Group } from 'three';

export type UsePixelOffsetsParams = {
  groupRef: MutableRefObject<Group | null>;
  camera: Camera;
  radius: number;
  xOffset: number;
  yOffset: number;
  xOffsetPx: number;
  yOffsetPx: number;
};

export default function usePixelOffsets({
  groupRef,
  camera,
  radius,
  xOffset,
  yOffset,
  xOffsetPx,
  yOffsetPx,
}: UsePixelOffsetsParams) {
  const desiredPxRef = useRef({ x: xOffsetPx, y: yOffsetPx });
  const animPxRef = useRef({ x: xOffsetPx, y: yOffsetPx });

  useEffect(() => {
    desiredPxRef.current = { x: xOffsetPx, y: yOffsetPx };
  }, [xOffsetPx, yOffsetPx]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const targetPx = desiredPxRef.current;
    const anim = animPxRef.current;

    const alpha = 1 - Math.exp(-((delta || 0.016) / 0.25));
    anim.x += (targetPx.x - anim.x) * alpha;
    anim.y += (targetPx.y - anim.y) * alpha;

    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;

    const aspect = (camera as any).aspect || W / H;
    const fov = (camera as any).fov ?? 50;
    const fovRad = (fov * Math.PI) / 180;

    const worldPerPxY = (2 * Math.tan(fovRad / 2) * radius) / H;
    const worldPerPxX = worldPerPxY * aspect;

    const offX = xOffset + anim.x * worldPerPxX;
    const offY = yOffset + -anim.y * worldPerPxY;

    g.position.set(offX, offY, 0);
  });
}
