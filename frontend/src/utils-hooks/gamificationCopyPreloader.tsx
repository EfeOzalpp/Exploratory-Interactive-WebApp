// src/utils/GamificationCopyPreloader.tsx
import { useGeneralPools, usePersonalizedPools } from './useGamificationPools.ts';

export default function GamificationCopyPreloader() {
  // just mounting these hooks triggers the initial Sanity fetch + live subscription
  useGeneralPools();
  usePersonalizedPools();

  // no UI
  return null;
}
