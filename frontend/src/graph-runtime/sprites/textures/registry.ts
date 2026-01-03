// graph-runtime/sprites/textures/registry.ts
import * as THREE from 'three';
import { makeTextureFromDrawer } from './makeTextureFromDrawer.ts';
import { enqueueTexture } from './queue.ts';

export type DrawerFn = (p: any, x: number, y: number, r: number, opts?: any) => void;

export type MakeArgs = {
  key: string;
  drawer: DrawerFn;
  tileSize: number;
  dpr: number;
  alpha: number;
  gradientRGB?: { r: number; g: number; b: number };
  liveAvg: number;
  blend: number;
  footprint: { w: number; h: number };
  bleed?: { top?: number; right?: number; bottom?: number; left?: number };
  seedKey?: string;
  prio?: number;
};

type Listener = (key: string, tex: THREE.CanvasTexture) => void;

class TextureRegistry {
  private cache = new Map<string, THREE.CanvasTexture>();
  private inFlight = new Set<string>();
  private listeners = new Set<Listener>();

  get(key: string) { return this.cache.get(key) || null; }

  onReady(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  ensure(args: MakeArgs) {
    const { key, prio = 0 } = args;
    if (this.cache.has(key) || this.inFlight.has(key)) return;

    this.inFlight.add(key);
    enqueueTexture(() => {
      let tex: THREE.CanvasTexture | null = null;
      try {
        tex = makeTextureFromDrawer({
          drawer: args.drawer,
          tileSize: args.tileSize,
          dpr: args.dpr,
          alpha: args.alpha,
          gradientRGB: args.gradientRGB,
          liveAvg: args.liveAvg,
          blend: args.blend,
          footprint: args.footprint,
          bleed: args.bleed,
          seedKey: args.seedKey ?? key,
        });
        tex.generateMipmaps = true;
        (tex as any).anisotropy = 8;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;

        this.cache.set(key, tex);
        for (const l of this.listeners) l(key, tex);
      } catch (err) {
        if ((window as any).__GP_LOG_LOAD_ERRORS) {
          console.warn('[SPRITE:STATIC] build failed', key, err);
        }
      } finally {
        this.inFlight.delete(key);
      }
    }, prio);
  }

  prewarm(list: MakeArgs[], { prioBase = 0 }: { prioBase?: number } = {}) {
    let p = prioBase;
    for (const args of list) this.ensure({ ...args, prio: p++ });
  }

  clear() {
    for (const tex of this.cache.values()) {
      try { tex.dispose(); } catch {}
    }
    this.cache.clear();
    this.inFlight.clear();
    this.listeners.clear();
  }
}

export const textureRegistry = new TextureRegistry();

if (typeof window !== 'undefined') {
  (window as any).__GP_DISPOSE_TEX_STATIC = () => textureRegistry.clear();
}
