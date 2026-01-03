// src/components/dotgraph/hooks/useDynamicOffset.ts
import { useEffect, useState } from 'react';
import { computeDynamicOffset } from '../utils/dynamicOffset.ts';

export const useDynamicOffset = (): number => {
  const [dynamicOffset, setDynamicOffset] = useState<number>(10);

  useEffect(() => {
    const handleResize = () => {
      // If this hook can run in SSR contexts, guard window access.
      if (typeof window === 'undefined') return;
      setDynamicOffset(computeDynamicOffset(window.innerWidth, window.innerHeight));
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return dynamicOffset;
};
