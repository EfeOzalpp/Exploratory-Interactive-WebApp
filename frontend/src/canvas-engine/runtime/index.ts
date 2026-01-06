// canvas-engine/runtime/index.ts

import {
  drawClouds,
  drawSnow,
  drawHouse,
  drawPower,
  drawSun,
  drawVilla,
  drawCarFactory,
  drawCar,
  drawSea,
  drawBus,
  drawTrees,
} from "../shapes/index.js";

import { getGridSpec } from "../layout/grid-layout/config.ts";
import { makeCenteredSquareGrid } from "../layout/grid-layout/layoutCentered.ts";

import { ensureMount, applyCanvasStyle, type EngineLayoutMode } from "./mount.ts";
import { getViewportSize, resolvePixelDensity, type DprMode } from "./viewport.ts";
import { makeP, type PLike } from "./p/makeP.ts";

// derive palette in the render loop (same layer as shape mods)
import { gradientColor } from "../modifiers/color-modifiers/gradient.ts";
import { BRAND_STOPS_VIVID } from "../modifiers/color-modifiers/stops.ts";

function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeOutCubic(t: number) {
  t = clamp01(t);
  const u = 1 - t;
  return 1 - u * u * u;
}

/* ───────────────────────────────────────────────────────────
   background radial
   ─────────────────────────────────────────────────────────── */
function drawBackground(p: PLike) {
  const BG = "#b4e4fdff";
  p.background(BG);

  const ctx = p.drawingContext;
  const cx = p.width / 2;
  const cy = p.height * 0.82;
  const inner = Math.min(p.width, p.height) * 0.06;
  const outer = Math.hypot(p.width, p.height);

  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0.0, "rgba(255,255,255,1.00)");
  g.addColorStop(0.14, "rgba(255,255,255,0.90)");
  g.addColorStop(0.28, "rgba(255,255,255,0.60)");
  g.addColorStop(0.46, "rgba(255,255,255,0.30)");
  g.addColorStop(0.64, "rgba(210,230,246,0.18)");
  g.addColorStop(0.82, "rgba(190,229,253,0.10)");
  g.addColorStop(1.0, "rgba(180,228,253,1.00)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.width, p.height);
}

/**
 * STYLE = knobs/config that change rendering but are not "signals".
 * Signals like liveAvg go into inputs instead.
 */
const REG_STYLE_DEFAULT = {
  r: 11,
  perShapeScale: {} as Record<string, number>,
  // gradientRGB is derived from inputs.liveAvg in the render loop.
  gradientRGBOverride: null as null | { r: number; g: number; b: number },
  blend: 0.5,
  exposure: 1.0,
  contrast: 1.0,
  appearMs: 300,
  exitMs: 300,
};

type FieldItem = {
  id: string;
  x: number;
  y: number;
  shape: string;
  footprint?: any;
};

export type CanvasEngineControls = EngineControls;

type EngineControls = {
  setInputs: (args?: { liveAvg?: number }) => void;

  setFieldItems: (nextItems?: FieldItem[]) => void;
  setFieldStyle: (args?: Partial<typeof REG_STYLE_DEFAULT> & Record<string, any>) => void;

  setFieldVisible: (v: boolean) => void;
  setHeroVisible: (v: boolean) => void;
  setVisible: (v: boolean) => void;

  stop: () => void;
  setQuestionnaireOpen: (v: boolean) => void;

  readonly canvas: HTMLCanvasElement | null;
};

const REGISTRY = new Map<string, { controls: EngineControls }>();

export function startCanvasEngine({
  mount = "#canvas-root",
  onReady,
  dprMode = "fixed1" as DprMode,
  zIndex = 2,
  layout = "fixed" as EngineLayoutMode,
}: {
  mount?: string;
  onReady?: (controls: EngineControls) => void;
  dprMode?: DprMode;
  zIndex?: number;
  layout?: EngineLayoutMode;
} = {}): EngineControls {
  // Guard against double inits on the same mount
  if (REGISTRY.has(mount)) {
    try {
      REGISTRY.get(mount)!.controls?.stop?.();
    } catch {}
    REGISTRY.delete(mount);
  }

  const parentEl = ensureMount(mount, zIndex, layout);

  // style knobs/config (NOT signals)
  const style = { ...REG_STYLE_DEFAULT };

  // inputs/signals (things like liveAvg that drive many systems)
  const inputs = { liveAvg: 0.5 };

  const field = { items: [] as FieldItem[], visible: false, epoch: 0 };
  const hero = { x: null as number | null, y: null as number | null, visible: false };

  let canvasEl: HTMLCanvasElement | null = null;
  let p: PLike | null = null;

  let questionnaireOpen = false;

  const liveStates = new Map<
    string,
    {
      shapeKey: string;
      bornAtMs: number;
      x: number;
      y: number;
      shape: string;
      footprint?: any;
      _willDie?: boolean;
    }
  >();

  let ghosts: Array<{ dieAtMs: number; x: number; y: number; shape: string; footprint?: any }> = [];

  function shapeKeyOfItem(it: FieldItem) {
    const f = it.footprint || { w: 0, h: 0, r0: 0, c0: 0 };
    return `${it.shape}|w${f.w}h${f.h}|r${f.r0}c${f.c0}`;
  }

  // grid cache (includes usedRows)
  let cachedGrid = { w: 0, h: 0, cell: 0, rows: 0, cols: 0, usedRows: 0, q: null as null | boolean };

  const computeGrid = () => {
    if (
      p &&
      p.width === cachedGrid.w &&
      p.height === cachedGrid.h &&
      cachedGrid.q === questionnaireOpen &&
      cachedGrid.cell > 0
    ) {
      return cachedGrid;
    }

    if (!p) return cachedGrid;

    const spec = getGridSpec(p.width, questionnaireOpen);
    const { cell, rows, cols } = makeCenteredSquareGrid({
      w: p.width,
      h: p.height,
      rows: spec.rows,
      useTopRatio: spec.useTopRatio ?? 1,
    });

    const useTop = Math.max(0.01, Math.min(1, spec.useTopRatio ?? 1));
    const usedRows = Math.max(1, Math.round(rows * useTop));

    cachedGrid = { w: p.width, h: p.height, cell, rows, cols, usedRows, q: questionnaireOpen };
    return cachedGrid;
  };

  /* init canvas */
  const canvas = document.createElement("canvas");
  canvasEl = canvas;
  applyCanvasStyle(canvasEl);
  parentEl.appendChild(canvasEl);

  const ctx = canvasEl.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2D canvas context not available");
  p = makeP(canvasEl, ctx);

  /* DPR + size */
  let resizeRaf: number | null = null;

  function resizeToViewport() {
    if (!p || !canvasEl) return;
    const { w, h } = getViewportSize();
    p.pixelDensity(resolvePixelDensity(dprMode));
    p.resizeCanvas(w, h);

    // Ensure CSS box == logical size so grid math centers correctly
    canvasEl.style.width = w + "px";
    canvasEl.style.height = h + "px";

    cachedGrid.w = cachedGrid.h = cachedGrid.cell = 0;
    applyCanvasStyle(canvasEl);

    if (hero.x == null) hero.x = Math.round(p.width * 0.5);
    if (hero.y == null) hero.y = Math.round(p.height * 0.3);
  }

  const resizeThrottled = () => {
    if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resizeToViewport);
  };

  resizeToViewport();
  window.addEventListener("resize", resizeThrottled);

  /* vis pause/resume */
  const visHandler = () => {
    if (document.visibilityState === "visible") resizeThrottled();
  };
  document.addEventListener("visibilitychange", visHandler);

  // draw registry
  function renderOne(p2: PLike, it: FieldItem, rEff: number, sharedOpts: any, rootAppearK: number) {
    const opts = { ...sharedOpts, rootAppearK };
    switch (it.shape) {
      case "snow": {
        // Responsive hideGroundAboveFrac by viewport width
        const vw = p2.width;
        const hideFrac = vw < 768 ? 0.32 : vw < 1024 ? 0.4 : 0.2;

        drawSnow(p2 as any, it.x, it.y, rEff, {
          ...opts,
          footprint: it.footprint,
          usedRows: cachedGrid.usedRows,
          hideGroundAboveFrac: hideFrac,
          showGround: true,
        });
        break;
      }
      case "house":
        drawHouse(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "power":
        drawPower(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "villa":
        drawVilla(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "carFactory":
        drawCarFactory(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "bus":
        drawBus(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "trees":
        drawTrees(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "car":
        drawCar(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "sea":
        drawSea(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "sun":
        drawSun(p2 as any, it.x, it.y, rEff, opts);
        break;
      case "clouds":
        drawClouds(p2 as any, it.x, it.y, rEff, opts);
        break;
    }
  }

  function renderOneSandboxed(p2: PLike, it: FieldItem, rEff: number, sharedOpts: any, rootAppearK: number) {
    p2.push();
    try {
      renderOne(p2, it, rEff, sharedOpts, rootAppearK);
    } finally {
      p2.pop();
      // reassert DPR transform if any child mutated ctx transform directly
      const ctx2 = p2.drawingContext;
      const dpr = (p2.canvas as any)?._dpr || 1;
      const T = ctx2.getTransform();
      if (T.a !== dpr || T.d !== dpr || T.b !== 0 || T.c !== 0 || T.e !== 0 || T.f !== 0) {
        ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }

  function nowMs() {
    return performance.now();
  }

  /* main loop */
  let running = true;
  let rafId: number | null = null;

  // optional optimization: only recompute gradient when liveAvg changes
  let lastU = NaN;
  let cachedGradient: { r: number; g: number; b: number } | null = null;

  function frame(now: number) {
    if (!running || !p) return;
    p.__tick(now);

    // Normalize DPR transform at the very start of the frame
    {
      const dpr = (p.canvas as any)?._dpr || 1;
      const ctx2 = p.drawingContext;
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    drawBackground(p);

    const { cell } = computeGrid();

    const tMs = p.millis();
    const tSec = tMs / 1000;
    const bpm = 120;
    const beatPhase = ((tSec * bpm) / 60) % 1;
    const transport = { tSec, bpm, beatPhase };

    // liveAvg is a signal, shared by color + shape mods
    const signal1 = inputs.liveAvg;

    // palette and shape mods are both derived in render loop
    const uq = Math.round(signal1 * 1000) / 1000;
    if (uq !== lastU) { lastU = uq; 
      cachedGradient = gradientColor(BRAND_STOPS_VIVID, uq).rgb; 
    }
    const gradientRGB = style.gradientRGBOverride ?? cachedGradient;

    const baseShared = {
      cell,
      gradientRGB,
      blend: style.blend,
      liveAvg: signal1,
      alpha: 235,
      timeMs: tMs,
      exposure: style.exposure,
      contrast: style.contrast,
      transport,
    };

    const useGhosts = style.exitMs > 0;

    const Z: Record<string, number> = {
      villa: 3,
      house: 2,
      power: 5,
      car: 8,
      carFactory: 6,
      snow: 9,
      sea: 10,
      bus: 11,
      sun: 0,
      trees: 12,
      clouds: 1,
    };

    // ghosts
    if (useGhosts && ghosts.length) {
      const nextGhosts: typeof ghosts = [];
      for (const g of ghosts) {
        const dt = tMs - g.dieAtMs;
        if (dt >= style.exitMs) continue;
        const k = 1 - easeOutCubic(clamp01(dt / style.exitMs));
        const it: FieldItem = { id: "__ghost__", x: g.x, y: g.y, shape: g.shape, footprint: g.footprint };
        const scale = style.perShapeScale?.[it.shape] ?? 1;
        const rEff = style.r * scale;
        const shared = { ...baseShared, footprint: g.footprint, alpha: Math.round(235 * k) };
        renderOneSandboxed(p, it, rEff, shared, k);
        nextGhosts.push(g);
      }
      ghosts = nextGhosts;
    }

    // live
    if (field.visible && field.items.length) {
      const items = field.items.slice().sort((a, b) => (Z[a.shape] ?? 9) - (Z[b.shape] ?? 9));
      for (const it of items) {
        const state = liveStates.get(it.id);
        const bornAt = state?.bornAtMs ?? tMs;

        let easedK = 1,
          alphaK = 1;
        if (style.appearMs > 0) {
          const appearT = clamp01((tMs - bornAt) / style.appearMs);
          easedK = easeOutCubic(appearT);
          alphaK = easedK;
        }

        const scale = style.perShapeScale?.[it.shape] ?? 1;
        const rEff = style.r * scale;

        const sharedOpts = { ...baseShared, footprint: it.footprint, alpha: Math.round(235 * alphaK) };
        renderOneSandboxed(p, it, rEff, sharedOpts, easedK);
      }
    }

    if (hero.visible && hero.x != null && hero.y != null) {
      p.fill(255, 0, 0, 255);
      p.circle(hero.x, hero.y, style.r * 2);
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  /* controls */

  function setInputs(args: any = {}) {
    // Signal layer
    if (typeof args.liveAvg === "number") inputs.liveAvg = clamp01(args.liveAvg);
  }

  function setFieldItems(nextItems: FieldItem[] = []) {
    const now = nowMs();
    field.epoch++;

    const useGhosts = style.exitMs > 0;

    if (!useGhosts) {
      liveStates.clear();
      for (const it of Array.isArray(nextItems) ? nextItems : []) {
        liveStates.set(it.id, {
          shapeKey: shapeKeyOfItem(it),
          bornAtMs: now,
          x: it.x,
          y: it.y,
          shape: it.shape,
          footprint: it.footprint,
        });
      }
      field.items = Array.isArray(nextItems) ? nextItems : [];
      return;
    }

    // ghosts enabled
    for (const s of liveStates.values()) s._willDie = true;

    for (const it of Array.isArray(nextItems) ? nextItems : []) {
      const key = shapeKeyOfItem(it);
      const prev = liveStates.get(it.id);
      if (!prev) {
        liveStates.set(it.id, {
          shapeKey: key,
          bornAtMs: now,
          x: it.x,
          y: it.y,
          shape: it.shape,
          footprint: it.footprint,
          _willDie: false,
        });
      } else {
        if (prev.shapeKey !== key) {
          ghosts.push({ dieAtMs: now, x: prev.x, y: prev.y, shape: prev.shape, footprint: prev.footprint });
          prev.shapeKey = key;
          prev.bornAtMs = now;
        }
        prev.x = it.x;
        prev.y = it.y;
        prev.shape = it.shape;
        prev.footprint = it.footprint;
        prev._willDie = false;
      }
    }

    for (const [id, s] of [...liveStates.entries()]) {
      if (s._willDie) {
        ghosts.push({ dieAtMs: now, x: s.x, y: s.y, shape: s.shape, footprint: s.footprint });
        liveStates.delete(id);
      }
    }

    field.items = Array.isArray(nextItems) ? nextItems : [];
  }

  function setFieldStyle(args: any = {}) {
    // Style layer (NO liveAvg here)
    const {
      r,
      // allow override but not required anymore
      gradientRGBOverride,
      blend,
      perShapeScale,
      exposure,
      contrast,
      appearMs,
      exitMs,
    } = args;

    if (Number.isFinite(r) && r > 0) style.r = r;

    if ("gradientRGBOverride" in args) style.gradientRGBOverride = gradientRGBOverride ?? null;

    if (typeof blend === "number") style.blend = Math.max(0, Math.min(1, blend));
    if (typeof exposure === "number") style.exposure = Math.max(0.1, Math.min(3, exposure));
    if (typeof contrast === "number") style.contrast = Math.max(0.5, Math.min(2, contrast));

    if (perShapeScale && typeof perShapeScale === "object") {
      style.perShapeScale = { ...style.perShapeScale, ...perShapeScale };
    }

    if (Number.isFinite(appearMs) && appearMs >= 0) style.appearMs = appearMs | 0;
    if (Number.isFinite(exitMs) && exitMs >= 0) style.exitMs = exitMs | 0;
  }

  function setFieldVisible(v: boolean) {
    field.visible = !!v;
  }
  function setHeroVisible(v: boolean) {
    hero.visible = !!v;
  }
  function setVisibleCanvas(v: boolean) {
    if (canvasEl?.style) canvasEl.style.opacity = v ? "1" : "0";
  }

  function stop() {
    try {
      running = false;
    } catch {}
    if (rafId != null) {
      try {
        cancelAnimationFrame(rafId);
      } catch {}
    }
    document.removeEventListener("visibilitychange", visHandler);
    window.removeEventListener("resize", resizeThrottled);
    try {
      canvasEl?.remove?.();
    } catch {}
    REGISTRY.delete(mount);
  }

  function setQuestionnaireOpen(v: boolean) {
    questionnaireOpen = !!v;
    cachedGrid = { w: 0, h: 0, cell: 0, rows: 0, cols: 0, usedRows: 0, q: null };
  }

  const controls: EngineControls = {
    setInputs,
    setFieldItems,
    setFieldStyle,
    setFieldVisible,
    setHeroVisible,
    setVisible: setVisibleCanvas,
    stop,
    setQuestionnaireOpen,
    get canvas() {
      return canvasEl;
    },
  };

  REGISTRY.set(mount, { controls });
  onReady?.(controls);
  return controls;
}

// Build a p-like facade on an existing canvas (no animation / no DOM attach).
export function makePFromCanvas(canvas: HTMLCanvasElement, { dpr = 1 } = {}) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("2D canvas context not available");
  const p = makeP(canvas, ctx);
  const cssW = canvas.style.width ? parseFloat(canvas.style.width) : canvas.width / dpr;
  const cssH = canvas.style.height ? parseFloat(canvas.style.height) : canvas.height / dpr;
  p.pixelDensity(Math.max(1, dpr || 1));
  p.resizeCanvas(cssW, cssH);
  return p;
}

export function stopCanvasEngine(mount = "#canvas-root") {
  try {
    const rec = REGISTRY.get(mount);
    if (rec?.controls?.stop) rec.controls.stop();
  } catch {}
  REGISTRY.delete(mount);

  try {
    const el = document.querySelector(mount);
    if (el && el.classList?.contains("be-canvas-layer")) {
      el.remove();
    }
  } catch {}
}

export function isCanvasRunning(mount = "#canvas-root") {
  return REGISTRY.has(mount);
}

export function stopAllCanvasEngines() {
  for (const key of [...REGISTRY.keys()]) {
    stopCanvasEngine(key);
  }
}

export default startCanvasEngine;
