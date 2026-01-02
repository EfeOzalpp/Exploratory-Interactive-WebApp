// src/canvas/layout/scene-composition/index.ts
export type {
  PoolItem,
  PlacedItem,
  FootRect,
  ComposeOpts,
  ComposeMeta,
  ComposeResult,
} from './types.ts';

export { composeField, makeDefaultPoolItem } from './composeField.ts';
export { targetPoolSize, ensurePoolSize } from './poolSizing.ts';
