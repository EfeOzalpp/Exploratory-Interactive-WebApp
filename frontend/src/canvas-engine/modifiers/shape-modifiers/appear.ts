// src/canvas/utils/appear.ts

import type { ShapeMods, Anchor } from './shapeMods.ts';

type Ease = 'linear' | 'cubic' | 'back';

export type AppearParams = {
  scaleFrom?: number;     // default 0
  alphaFrom?: number;     // default 0
  anchor?: Anchor;        // default 'bottom-center'
  ease?: Ease;            // default 'cubic'
  backOvershoot?: number; // default 1.6
};

/** Merge an `appear` envelope onto any existing mods. */
export function withAppear(mods: ShapeMods | undefined, params?: AppearParams): ShapeMods {
  const appear = {
    scaleFrom: 0,
    alphaFrom: 0,
    anchor: 'bottom-center' as Anchor,
    ease: 'cubic' as Ease,
    backOvershoot: 1.6,
    ...(params ?? {}),
  };
  return { ...(mods ?? {}), appear };
}
