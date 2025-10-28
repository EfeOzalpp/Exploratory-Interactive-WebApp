// src/components/dotGraph/canvas/particleCache.ts
import * as THREE from 'three';

type Entry = { key: string; tex: THREE.CanvasTexture };
const MAX_CAP = 48; // tune for mobile

const getGlobals = () => {
  const w = window as any;
  w.__GP_TEX_REGISTRY = w.__GP_TEX_REGISTRY || new Set<THREE.Texture>();
  return w;
};

class ParticleLRU {
  private map = new Map<string, Entry>();
  private order: string[] = [];

  get size() { return this.map.size; }

  get(key: string) {
    const e = this.map.get(key);
    if (!e) return null;
    // bump to MRU
    this.order = this.order.filter(k => k !== key);
    this.order.push(key);
    return e.tex;
    }

  set(key: string, tex: THREE.CanvasTexture) {
    const g = getGlobals();
    // track for Debug HUD
    try { g.__GP_TEX_REGISTRY.add(tex); } catch {}
    if (this.map.has(key)) {
      // replace existing (dispose old)
      const old = this.map.get(key)!.tex;
      if (old !== tex) {
        try { old.dispose(); } catch {}
        try { g.__GP_TEX_REGISTRY.delete(old); } catch {}
      }
      this.map.set(key, { key, tex });
      this.order = this.order.filter(k => k !== key);
      this.order.push(key);
      this.evictIfNeeded();
      return;
    }
    this.map.set(key, { key, tex });
    this.order.push(key);
    this.evictIfNeeded();
  }

  clear() {
    const g = getGlobals();
    for (const { tex } of this.map.values()) {
      try { tex.dispose(); } catch {}
      try { g.__GP_TEX_REGISTRY.delete(tex); } catch {}
    }
    this.map.clear();
    this.order.length = 0;
  }

  private evictIfNeeded() {
    const g = getGlobals();
    while (this.order.length > MAX_CAP) {
      const lruKey = this.order.shift()!;
      const e = this.map.get(lruKey);
      if (!e) continue;
      try { e.tex.dispose(); } catch {}
      try { g.__GP_TEX_REGISTRY.delete(e.tex); } catch {}
      this.map.delete(lruKey);
    }
  }
}

const _LRU = new ParticleLRU();
export function particleCacheGet(key: string) { return _LRU.get(key); }
export function particleCacheSet(key: string, tex: THREE.CanvasTexture) { _LRU.set(key, tex); }
export function particleCacheClear() { _LRU.clear(); }
export function particleCacheSize() { return _LRU.size; }
