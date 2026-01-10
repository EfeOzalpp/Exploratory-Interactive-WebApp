// src/canvas/scene-logic/index.ts

export type {
  PoolItem,
  PlacedItem,
  FootRect,
  ComposeOpts,
  ComposeMeta,
  ComposeResult,
} from './types.ts';

export { composeField } from './composeField.ts';
export { targetPoolSize  } from '../adjustable-rules/poolSizes.ts';
