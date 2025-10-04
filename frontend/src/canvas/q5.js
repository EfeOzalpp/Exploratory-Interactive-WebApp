// q5.js
import * as Q5NS from 'q5';
import { bandFromWidth, GRID_MAP } from './grid/config.ts';
import { makeCenteredSquareGrid } from './grid/layoutCentered.ts';

// renderers
import {
  drawClouds,
  drawSnow,
  drawHouse,
  drawPower,
  drawSun,
  drawVilla,
  drawPlus,
} from './shape/index.js';

// resolve callable constructor
const q5 =
  (Q5NS && typeof Q5NS.q5 === 'function' && Q5NS.q5) ||
  (Q5NS && typeof Q5NS.default === 'function' && Q5NS.default) ||
  (typeof Q5NS === 'function' && Q5NS);

if (typeof q5 !== 'function') {
  console.error('q5 import shape:', Q5NS);
  throw new Error('Could not resolve a callable q5() from the q5 package export.');
}

const REGISTRY = new Map();

/* ───────────────────────────────────────────────────────────
   Viewport helpers
   ─────────────────────────────────────────────────────────── */
function getViewportSize() {
  const vv = typeof window !== 'undefined' && window.visualViewport;
  if (vv && vv.width && vv.height) return { w: Math.round(vv.width), h: Math.round(vv.height) };
  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  return { w, h };
}

function ensureMount(mount) {
  let el = document.querySelector(mount);
  if (!el) {
    el = document.createElement('div');
    el.id = mount.startsWith('#') ? mount.slice(1) : mount;
    document.body.appendChild(el);
  }
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.height = '100dvh';
  el.style.width = '100vw';
  el.style.zIndex = '2';
  el.style.pointerEvents = 'none';
  el.style.touchAction = 'auto';
  el.style.userSelect = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  el.classList.add('gp-q5-layer');
  return el;
}

function applyCanvasNonBlockingStyle(el) {
  if (!el?.style) return;
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.zIndex = '2';
  el.style.pointerEvents = 'none';
  el.style.touchAction = 'auto';
  el.style.userSelect = 'none';
  el.setAttribute('tabindex', '-1');
}

/* Easing */
function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
function easeOutCubic(t) { t = clamp01(t); const u = 1 - t; return 1 - u*u*u; }

/* ───────────────────────────────────────────────────────────
   Background
   ─────────────────────────────────────────────────────────── */
const drawBackground = (p) => {
  const BG = '#b4e4fdff';
  p.background(BG);

  const ctx = p.drawingContext;
  const cx = p.width / 2;
  const cy = p.height * 0.82;
  const inner = Math.min(p.width, p.height) * 0.06;
  const outer = Math.hypot(p.width, p.height);

  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.14, 'rgba(255,255,255,0.90)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.60)');
  g.addColorStop(0.46, 'rgba(255,255,255,0.30)');
  g.addColorStop(0.64, 'rgba(210,230,246,0.18)');
  g.addColorStop(0.82, 'rgba(190,229,253,0.10)');
  g.addColorStop(1.00, 'rgba(180,228,253,1.00)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.width, p.height);
};

/* ───────────────────────────────────────────────────────────
   startQ5
   ─────────────────────────────────────────────────────────── */
export function startQ5({ mount = '#canvas-root', onReady, dprMode = 'fixed1' } = {}) {
  if (REGISTRY.has(mount)) return REGISTRY.get(mount).controls;

  const parentEl = ensureMount(mount);

  // shared style (appear/exit overridable)
  const style = {
    r: 11,
    perShapeScale: {},
    gradientRGB: null,
    blend: 0.5,
    liveAvg: 0.5,
    exposure: 1.0,
    contrast: 1.0,
    appearMs: 300,
    exitMs: 300,
  };

  const field = { items: [], visible: false, epoch: 0 };
  const hero = { x: null, y: null, visible: false };
  let canvasEl = null;

  // live states (per id)
  // id -> { shapeKey, bornAtMs, x,y, shape, footprint }
  const liveStates = new Map();
  // only used if style.exitMs > 0
  let ghosts = [];

  // a key that changes when “visual identity” changes (shape or footprint move/size)
  function shapeKeyOfItem(it) {
    const f = it.footprint || { w: 0, h: 0, r0: 0, c0: 0 };
    return `${it.shape}|w${f.w}h${f.h}|r${f.r0}c${f.c0}`;
  }

  // Cache grid metrics until size changes
  let cachedGrid = { w: 0, h: 0, cell: 0, rows: 0, cols: 0 };
  const computeGrid = (p) => {
    if (p.width === cachedGrid.w && p.height === cachedGrid.h && cachedGrid.cell > 0) return cachedGrid;
    const spec = GRID_MAP[bandFromWidth(p.width)];
    const { cell, rows, cols } = makeCenteredSquareGrid({
      w: p.width,
      h: p.height,
      rows: spec.rows,
      useTopRatio: spec.useTopRatio ?? 1,
    });
    cachedGrid = { w: p.width, h: p.height, cell, rows, cols };
    return cachedGrid;
  };

  const app = q5((p) => {
    let resizeRAF = 0;

    const resizeToViewport = () => {
      const { w, h } = getViewportSize();
      p.resizeCanvas(w, h);
      cachedGrid.w = cachedGrid.h = cachedGrid.cell = 0; // invalidate cache
      applyCanvasNonBlockingStyle(canvasEl);
      if (hero.x == null) hero.x = Math.round(p.width * 0.50);
      if (hero.y == null) hero.y = Math.round(p.height * 0.30);
    };

    function resolvePixelDensity(mode) {
      const dpr = window.devicePixelRatio || 1;
      if (mode === 'fixed1') return 1;
      if (mode === 'cap2')   return Math.min(2, dpr);
      if (mode === 'snap2')  return dpr >= 1.5 ? 2 : 1; // <— new mode
      if (mode === 'force2') return 2;                  // <— optional hard 2x
      return dpr; // default: native/full DPR
    }

    p.setup = () => {
      const { w, h } = getViewportSize();
      const c = p.createCanvas(w, h, p.P2D);

      try {
        p.pixelDensity(resolvePixelDensity(dprMode));
      } catch {}

      c.parent(parentEl);
      canvasEl = c.elt || c.canvas || c;
      applyCanvasNonBlockingStyle(canvasEl);

      if (hero.x == null) hero.x = Math.round(p.width * 0.50);
      if (hero.y == null) hero.y = Math.round(p.height * 0.30);

      onReady?.({
        setFieldItems,
        setFieldStyle,
        setFieldVisible,
        setHeroVisible,
        setVisible: setVisibleCanvas,
        stop,
        get canvas() { return canvasEl; },
      });
    };

    // Debounced resize
    p.windowResized = () => {
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
      resizeRAF = requestAnimationFrame(resizeToViewport);
    };

    // tiny wrapper to standardize rootAppearK passing
    function renderOne(p, it, rEff, sharedOpts, rootAppearK) {
      const opts = { ...sharedOpts, rootAppearK };
      switch (it.shape) {
        case 'snow':
        drawSnow(p, it.x, it.y, rEff, {
          ...opts,
          footprint: it.footprint,  
          usedRows: cachedGrid.rows, 
          hideGroundAboveFrac: 0.2, 
          showGround: true,
        });
        break;
        case 'house':    drawHouse(p, it.x, it.y, rEff, opts); break;
        case 'power':  drawPower(p, it.x, it.y, rEff, opts); break;
        case 'villa':    drawVilla(p, it.x, it.y, rEff, opts); break;
        case 'plus':     drawPlus(p, it.x, it.y, rEff, opts); break;
        case 'sun':      drawSun(p, it.x, it.y, rEff, opts); break;
        case 'clouds':   drawClouds(p, it.x, it.y, rEff, opts); break;
      }
    }

    p.draw = () => {
      drawBackground(p);

      // grid spec & cell metrics (cached)
      const { cell, rows, cols } = computeGrid(p);

      // shared timing/transport bundle
      const tMs = p.millis();
      const tSec = tMs / 1000;
      const bpm = 120;
      const beatPhase = (tSec * bpm / 60) % 1;
      const transport = { tSec, bpm, beatPhase };

      const baseShared = {
        cell,
        gradientRGB: style.gradientRGB,
        blend: style.blend,
        liveAvg: style.liveAvg,
        alpha: 235,
        timeMs: tMs,
        exposure: style.exposure,
        contrast: style.contrast,
        transport,
      };

      const useGhosts = style.exitMs > 0;

      // z-order (lower draws first)
      const Z = { sun: 0, villa: 1, house: 2, plus: 3, power: 3, snow: 4, clouds: 5 };

      // 1) Draw ghosts (only if enabled)
      if (useGhosts && ghosts.length) {
        const nextGhosts = [];
        for (const g of ghosts) {
          const dt = tMs - g.dieAtMs;
          if (dt >= style.exitMs) continue;
          const k = 1 - easeOutCubic(clamp01(dt / style.exitMs)); // 1→0
          const it = { x: g.x, y: g.y, shape: g.shape, footprint: g.footprint };
          const scale = style.perShapeScale?.[it.shape] ?? 1;
          const rEff = style.r * scale;
          const shared = { ...baseShared, footprint: g.footprint, alpha: Math.round(235 * k) };
          renderOne(p, it, rEff, shared, k);
          nextGhosts.push(g);
        }
        ghosts = nextGhosts;
      }

      // 2) Live items
      if (field.visible && field.items.length) {
        const items = field.items.slice().sort((a, b) => (Z[a.shape] ?? 9) - (Z[b.shape] ?? 9));
        for (const it of items) {
          const state = liveStates.get(it.id);
          const bornAt = state?.bornAtMs ?? tMs;

          let easedK = 1;
          let alphaK = 1;

          if (style.appearMs > 0) {
            const appearT = clamp01((tMs - bornAt) / style.appearMs);
            easedK = easeOutCubic(appearT); // pass to shapes (e.g., sun)
            alphaK = easedK;                // default fade-in for all
          }

          const scale = style.perShapeScale?.[it.shape] ?? 1;
          const rEff = style.r * scale;

          const sharedOpts = {
            ...baseShared,
            footprint: it.footprint,
            alpha: Math.round(235 * alphaK),
          };

          renderOne(p, it, rEff, sharedOpts, easedK);
        }
      }

      // optional hero debug dot
      if (hero.visible && hero.x != null && hero.y != null) {
        p.fill(255, 0, 0);
        p.circle(hero.x, hero.y, style.r * 2);
      }

      // debug footprints
      if (window.__debugFootprints && field.items.length) {
        p.push();
        p.noFill();
        p.stroke(0, 120, 255, 160);
        p.strokeWeight(1);
        for (const it of field.items) {
          const f = it.footprint; if (!f) continue;
          p.rect(f.c0 * cell, f.r0 * cell, f.w * cell, f.h * cell);
        }
        p.pop();
      }
    };
  });

  /* ---------- reconciliation helpers ---------- */

  function nowMs() {
    return app?._renderer?.pInst?.millis?.() ?? performance.now();
  }

  function setFieldItems(nextItems = []) {
    const now = nowMs();
    field.epoch++;

    const useGhosts = style.exitMs > 0;

    if (!useGhosts) {
      // Instant replace: no ghosts, no linger, no overlap.
      liveStates.clear();
      for (const it of Array.isArray(nextItems) ? nextItems : []) {
        liveStates.set(it.id, {
          shapeKey: shapeKeyOfItem(it),
          bornAtMs: now,
          x: it.x, y: it.y, shape: it.shape, footprint: it.footprint,
        });
      }
      field.items = Array.isArray(nextItems) ? nextItems : [];
      return;
    }

    // ghosts enabled: minimal churn
    // 1) mark all live as unseen (potentially dying)
    for (const s of liveStates.values()) s._willDie = true;

    // 2) integrate new list
    for (const it of Array.isArray(nextItems) ? nextItems : []) {
      const key = shapeKeyOfItem(it);
      const prev = liveStates.get(it.id);

      if (!prev) {
        // brand new → appear
        liveStates.set(it.id, {
          shapeKey: key,
          bornAtMs: now,
          x: it.x, y: it.y, shape: it.shape, footprint: it.footprint,
          _willDie: false,
        });
      } else {
        if (prev.shapeKey !== key) {
          // visual identity changed → old becomes a ghost for exitMs
          ghosts.push({
            dieAtMs: now,
            x: prev.x, y: prev.y, shape: prev.shape, footprint: prev.footprint,
          });
          prev.shapeKey = key;
          prev.bornAtMs = now;
        }
        prev.x = it.x; prev.y = it.y; prev.shape = it.shape; prev.footprint = it.footprint;
        prev._willDie = false;
      }
    }

    // 3) any live not refreshed this tick → ghost them
    for (const [id, s] of [...liveStates.entries()]) {
      if (s._willDie) {
        ghosts.push({
          dieAtMs: now,
          x: s.x, y: s.y, shape: s.shape, footprint: s.footprint,
        });
        liveStates.delete(id);
      }
    }

    // 4) store the plain list
    field.items = Array.isArray(nextItems) ? nextItems : [];
  }

  function setFieldStyle({ r, gradientRGB, blend, liveAvg, perShapeScale, exposure, contrast, appearMs, exitMs } = {}) {
    if (Number.isFinite(r) && r > 0) style.r = r;
    if (gradientRGB) style.gradientRGB = gradientRGB;
    if (typeof blend === 'number') style.blend = Math.max(0, Math.min(1, blend));
    if (typeof liveAvg === 'number') style.liveAvg = Math.max(0, Math.min(1, liveAvg));
    if (typeof exposure === 'number') style.exposure = Math.max(0.1, Math.min(3, exposure));
    if (typeof contrast === 'number') style.contrast = Math.max(0.5, Math.min(2, contrast));
    if (perShapeScale && typeof perShapeScale === 'object')
      style.perShapeScale = { ...style.perShapeScale, ...perShapeScale };
    if (Number.isFinite(appearMs) && appearMs >= 0) style.appearMs = appearMs|0;
    if (Number.isFinite(exitMs)   && exitMs   >= 0) style.exitMs   = exitMs|0;
  }

  function setFieldVisible(v) { field.visible = !!v; }
  function setHeroVisible(v)  { hero.visible  = !!v; }
  function setVisibleCanvas(v) { if (canvasEl?.style) canvasEl.style.opacity = v ? '1' : '0'; }
  function stop() { try { app.remove?.(); } catch {} REGISTRY.delete(mount); }

  const controls = {
    setFieldItems,
    setFieldStyle,
    setFieldVisible,
    setHeroVisible,
    setVisible: setVisibleCanvas,
    stop,
    get canvas() { return canvasEl; },
  };

  REGISTRY.set(mount, { app, controls });
  return controls;
}

export default startQ5;
