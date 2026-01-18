// src/canvas-engine/runtime/engine/registry.ts

export type StopFn = () => void;

type EngineRecord = { stop: StopFn };

const REGISTRY_BY_EL = new WeakMap<HTMLElement, EngineRecord>();
const REGISTRY_BY_KEY = new Map<string, HTMLElement>();

function mountKey(mount: string) {
  return String(mount ?? "").trim();
}

function tryResolveMountEl(mount: string): HTMLElement | null {
  try {
    return document.querySelector(mount) as HTMLElement | null;
  } catch {
    return null;
  }
}

function stopByEl(el: HTMLElement) {
  try {
    const rec = REGISTRY_BY_EL.get(el);
    rec?.stop?.();
  } catch {}
  try {
    REGISTRY_BY_EL.delete(el);
  } catch {}
}

/**
 * Stops any existing engine attached to this element/key and registers the new one.
 * Returns a cleanup function that unregisters (and stops) *this* engine.
 */
export function registerEngineInstance(args: {
  mount: string;
  parentEl: HTMLElement;
  stop: StopFn;
}) {
  const { mount, parentEl, stop } = args;

  const key = mountKey(mount);

  // Stop any engine already on this element.
  {
    const existing = REGISTRY_BY_EL.get(parentEl);
    if (existing?.stop) {
      try {
        existing.stop();
      } catch {}
    }
    try {
      REGISTRY_BY_EL.delete(parentEl);
    } catch {}
  }

  // If this selector key used to point at a different element, stop that too.
  {
    const prevEl = REGISTRY_BY_KEY.get(key);
    if (prevEl && prevEl !== parentEl) stopByEl(prevEl);
  }

  REGISTRY_BY_KEY.set(key, parentEl);
  REGISTRY_BY_EL.set(parentEl, { stop });

  // return disposer for *this* instance
  return () => {
    try {
      const cur = REGISTRY_BY_KEY.get(key);
      if (cur === parentEl) REGISTRY_BY_KEY.delete(key);
    } catch {}
    try {
      stopByEl(parentEl);
    } catch {}
  };
}

export function stopCanvasEngine(mount = "#canvas-root") {
  const key = mountKey(mount);

  try {
    const el = REGISTRY_BY_KEY.get(key);
    if (el) {
      stopByEl(el);
      REGISTRY_BY_KEY.delete(key);
    }
  } catch {}

  try {
    const el2 = tryResolveMountEl(mount);
    if (el2) stopByEl(el2);
  } catch {}

  // optional: if your ensureMount creates the node and marks it, preserve old behavior:
  try {
    const el = document.querySelector(mount);
    if (el && (el as any).classList?.contains("be-canvas-layer")) (el as any).remove();
  } catch {}
}

export function isCanvasRunning(mount = "#canvas-root") {
  try {
    const el = REGISTRY_BY_KEY.get(mountKey(mount));
    if (el) return !!REGISTRY_BY_EL.get(el);
  } catch {}

  try {
    const el2 = tryResolveMountEl(mount);
    if (el2) return !!REGISTRY_BY_EL.get(el2);
  } catch {}

  return false;
}

export function stopAllCanvasEngines() {
  for (const [k, el] of [...REGISTRY_BY_KEY.entries()]) {
    try {
      stopByEl(el);
    } catch {}
    try {
      REGISTRY_BY_KEY.delete(k);
    } catch {}
  }
}
