// src/graph-runtime/dotgraph/event-handlers/useIdleDrift.ts
import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { Group } from 'three';

export type UseIdleDriftParams = {
  groupRef: RefObject<Group | null>;
  speed?: number;
  horizontalOnly?: boolean;
  isIdle: (args: { userInteracting: boolean }) => boolean;
};

export default function useIdleDrift({
  groupRef,
  speed = 0.15,
  horizontalOnly = true,
  isIdle,
}: UseIdleDriftParams) {
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const idleActive = isIdle({ userInteracting: false }); // userInteracting evaluated upstream
    if (!idleActive) return;

    if (!horizontalOnly) {
      g.rotation.x += speed * 0.25 * delta;
    }
    g.rotation.y += speed * delta;
  });
}
