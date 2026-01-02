import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function usePixelOffsets({ groupRef, camera, radius, xOffset, yOffset, xOffsetPx, yOffsetPx }) {
  const desiredPxRef = useRef({ x: xOffsetPx, y: yOffsetPx });
  const animPxRef    = useRef({ x: xOffsetPx, y: yOffsetPx });
  useEffect(() => { desiredPxRef.current = { x: xOffsetPx, y: yOffsetPx }; }, [xOffsetPx, yOffsetPx]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetPx = desiredPxRef.current;
    const anim = animPxRef.current;
    const alpha = 1 - Math.exp(-(delta || 0.016) / 0.25);
    anim.x += (targetPx.x - anim.x) * alpha;
    anim.y += (targetPx.y - anim.y) * alpha;

    const W = window.innerWidth  || 1;
    const H = window.innerHeight || 1;
    const aspect = camera.aspect || (W / H);
    const fovRad = ((camera.fov ?? 50) * Math.PI) / 180;
    const worldPerPxY = (2 * Math.tan(fovRad / 2) * radius) / H;
    const worldPerPxX = worldPerPxY * aspect;
    const offX = xOffset + anim.x * worldPerPxX;
    const offY = yOffset + (-anim.y) * worldPerPxY;
    groupRef.current.position.set(offX, offY, 0);
  });
}