// graph-runtime/sprites/cache/frozenRegistry.ts
import * as THREE from 'three';
import {
  particleCacheGet,
  particleCacheSet,
  particleCacheClear,
  particleCacheSize,
} from './particleLRU.ts';

const FAILED_KEYS = new Set<string>();
const INFLIGHT = new Set<string>();

export function frozenGet(key: string) {
  return particleCacheGet(key);
}

export function frozenSet(key: string, tex: THREE.CanvasTexture) {
  particleCacheSet(key, tex);
}

export function frozenMarkFailed(key: string) {
  FAILED_KEYS.add(key);
}

export function frozenIsFailed(key: string) {
  return FAILED_KEYS.has(key);
}

export function frozenBeginInflight(key: string) {
  if (INFLIGHT.has(key)) return false;
  INFLIGHT.add(key);
  return true;
}

export function frozenEndInflight(key: string) {
  INFLIGHT.delete(key);
}

export function frozenIsInflight(key: string) {
  return INFLIGHT.has(key);
}

export function frozenClearAll() {
  FAILED_KEYS.clear();
  INFLIGHT.clear();
  particleCacheClear();
}

export function frozenSize() {
  return particleCacheSize();
}
