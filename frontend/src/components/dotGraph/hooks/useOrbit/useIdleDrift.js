import { useFrame } from '@react-three/fiber';

export default function useIdleDrift({ groupRef, speed = 0.15, horizontalOnly = true, isIdle }) {
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const idleActive = isIdle({ userInteracting: false }); // userInteracting evaluated upstream
    if (!idleActive) return;
    if (!horizontalOnly) {
      groupRef.current.rotation.x += (speed * 0.25) * delta;
    }
    groupRef.current.rotation.y += speed * delta;
  });
}