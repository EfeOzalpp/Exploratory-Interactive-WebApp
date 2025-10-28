// Tiny p5-ish engine + your existing startQ5 logic, without the Q5 dependency.

/* ───────────────────────────────────────────────────────────
   Imports MUST be at the top (ESLint import/first)
   ─────────────────────────────────────────────────────────── */
import {
  drawClouds, drawSnow, drawHouse, drawPower, drawSun,
  drawVilla, drawCarFactory, drawCar, drawSea, drawBus, drawTrees
} from './shape/index.js';
import { bandFromWidth, GRID_MAP } from './grid/config.ts';
import { makeCenteredSquareGrid } from './grid/layoutCentered.ts';

/* ───────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────── */
function clamp01(t){ return t < 0 ? 0 : t > 1 ? 1 : t; }
function easeOutCubic(t){ t = clamp01(t); const u = 1 - t; return 1 - u*u*u; }

function resolvePixelDensity(mode) {
  const dpr = window.devicePixelRatio || 1;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  switch (mode) {
    case 'fixed1': return 1;
    case 'cap1_5': return Math.min(1.5, dpr);
    case 'cap2':   return Math.min(2, dpr);
    case 'auto':   return isMobile ? Math.min(2, dpr) : Math.min(3, dpr);
    default:       return Math.min(3, dpr);
  }
}

/* ───────────────────────────────────────────────────────────
   Minimal p5-ish facade (now with engine p-state stack)
   ─────────────────────────────────────────────────────────── */
function makeP(canvas, ctx) {
  let _delta = 16, _last = performance.now();
  const state = { doFill: true, doStroke: false, lineWidth: 1 };

  // Engine-side state that must survive save/restore
  let _rectMode = 'corner'; // 'corner' | 'center'
  const _pStateStack = [];  // mirrors ctx.save/restore for engine-level p-state

  // simple css→rgb parser using canvas
  const _scratch = document.createElement('canvas').getContext('2d');
  function parseCss(css) {
    _scratch.fillStyle = '#000';
    _scratch.fillStyle = css;
    const s = _scratch.fillStyle; // canonicalized css
    _scratch.fillStyle = s;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(_scratch.fillStyle);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  // simple immediate-mode beginShape/vertex path
  let _shapeOpen = false;
  let _firstVertex = true;

  const p = {
    canvas,
    get width(){ return canvas._cssW || canvas.width; },
    get height(){ return canvas._cssH || canvas.height; },
    get deltaTime(){ return _delta; },
    millis(){ return performance.now(); },
    drawingContext: ctx,
    P2D: '2d',

    // compatibility shims
    createCanvas(w, h){ canvas.width = w; canvas.height = h; return canvas; },
    resizeCanvas(w, h){
      const ratio = canvas._dpr || 1;
      canvas._cssW = w; canvas._cssH = h;
      canvas.width = Math.max(1, Math.floor(w * ratio));
      canvas.height = Math.max(1, Math.floor(h * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    pixelDensity(dpr){
      const w = canvas._cssW || canvas.clientWidth || window.innerWidth;
      const h = canvas._cssH || canvas.clientHeight || window.innerHeight;
      canvas._dpr = Math.max(1, dpr || 1);
      p.resizeCanvas(w, h);
    },

    background(css){
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle = css;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.restore();
    },

    // Engine-aware push/pop (save/restore ctx + p-state)
    push(){
      _pStateStack.push({ _rectMode });
      ctx.save();
    },
    pop(){
      ctx.restore();
      const s = _pStateStack.pop();
      if (s) _rectMode = s._rectMode; else _rectMode = 'corner';
    },

    translate(x,y){ ctx.translate(x,y); },
    scale(x,y){ ctx.scale(x, y==null?x:y); },
    rotate(r){ ctx.rotate(r); },

    noFill(){ state.doFill = false; },
    fill(r,g,b,a=255){
      state.doFill = true;
      if (typeof r === 'string') { const c = parseCss(r); ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a/255})`; }
      else ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${(a|0)/255})`;
    },
    noStroke(){ state.doStroke = false; },
    stroke(r,g,b,a=255){ state.doStroke = true; ctx.strokeStyle = `rgba(${r|0},${g|0},${b|0},${(a|0)/255})`; },
    strokeWeight(w){ state.lineWidth = w; ctx.lineWidth = w; },

    // rectMode API + constants
    CORNER: 'corner',
    CENTER: 'center',
    rectMode(mode){ _rectMode = (mode === this.CENTER) ? 'center' : 'corner'; },

    rect(x,y,w,h, tl=0,tr=tl,br=tl,bl=tl){
      if (_rectMode === 'center') { x = x - w/2; y = y - h/2; }
      const rr=(rad)=>Math.max(0,Math.min(rad,Math.min(w,h)/2));
      const rtl=rr(tl), rtr=rr(tr), rbr=rr(br), rbl=rr(bl);
      ctx.beginPath();
      ctx.moveTo(x+rtl,y);
      ctx.lineTo(x+w-rtr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+rtr);
      ctx.lineTo(x+w,y+h-rbr); ctx.quadraticCurveTo(x+w,y+h,x+w-rbr,y+h);
      ctx.lineTo(x+rbl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-rbl);
      ctx.lineTo(x,y+rtl); ctx.quadraticCurveTo(x,y,x+rtl,y);
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },
    circle(x,y,d){
      ctx.beginPath();
      ctx.arc(x,y,d/2,0,Math.PI*2);
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },
    line(x1,y1,x2,y2){
      ctx.beginPath();
      ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    },
    triangle(x1, y1, x2, y2, x3, y3) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },

    beginShape(){ ctx.beginPath(); _shapeOpen = true; _firstVertex = true; },
    vertex(x,y){
      if (!_shapeOpen) return;
      if (_firstVertex) { ctx.moveTo(x,y); _firstVertex = false; }
      else { ctx.lineTo(x,y); }
    },
    endShape(mode){
      if (!_shapeOpen) return;
      if (mode && (mode === 'close' || mode === p.CLOSE)) ctx.closePath();
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
      _shapeOpen = false;
    },
    CLOSE: 'close',

    // color helpers used in sun.js
    color(css){ return parseCss(css); },
    red(c){ return c.r; }, green(c){ return c.g; }, blue(c){ return c.b; },

    // main loop hook (installed by engine)
    __tick(now){ _delta = now - _last; _last = now; },
  };
  return p;
}

/* ───────────────────────────────────────────────────────────
   startQ5 engine (API-compatible with your existing code)
   ─────────────────────────────────────────────────────────── */

const REGISTRY = new Map();

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
  el.style.transform = 'translateZ(0)';     // force its own layer (mobile crispness)
  el.style.imageRendering = 'auto';
  el.setAttribute('tabindex', '-1');
}

/* background radial (kept from your q5.js) */
function drawBackground(p) {
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
}

const REG_STYLE_DEFAULT = {
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

export function startQ5({ mount = '#canvas-root', onReady, dprMode = 'fixed1' } = {}) {
  // Guard against double inits on the same mount
  if (REGISTRY.has(mount)) {
    try { REGISTRY.get(mount).controls?.stop?.(); } catch {}
    REGISTRY.delete(mount);
  }

  const parentEl = ensureMount(mount);

  const style = { ...REG_STYLE_DEFAULT };
  const field = { items: [], visible: false, epoch: 0 };
  const hero = { x: null, y: null, visible: false };
  let canvasEl = null, p = null;

  const liveStates = new Map();
  let ghosts = [];

  function shapeKeyOfItem(it) {
    const f = it.footprint || { w: 0, h: 0, r0: 0, c0: 0 };
    return `${it.shape}|w${f.w}h${f.h}|r${f.r0}c${f.c0}`;
  }

  // grid cache
  let cachedGrid = { w: 0, h: 0, cell: 0, rows: 0, cols: 0 };
  const computeGrid = () => {
    if (p.width === cachedGrid.w && p.height === cachedGrid.h && cachedGrid.cell > 0) return cachedGrid;
    const spec = GRID_MAP[bandFromWidth(p.width)];
    const { cell, rows, cols } = makeCenteredSquareGrid({
      w: p.width, h: p.height, rows: spec.rows, useTopRatio: spec.useTopRatio ?? 1,
    });
    cachedGrid = { w: p.width, h: p.height, cell, rows, cols };
    return cachedGrid;
  };

  /* init canvas */
  const canvas = document.createElement('canvas');
  canvasEl = canvas;
  applyCanvasNonBlockingStyle(canvasEl);
  parentEl.appendChild(canvasEl);

  // Context loss guard (for WebGL it matters; for 2D we still trap to stop loop)
  const onContextLost = (e) => {
    try { e?.preventDefault?.(); } catch {}
    try { console.warn('[q5-lite] context lost'); } catch {}
    stop();
  };
  canvasEl.addEventListener('webglcontextlost', onContextLost, { passive: false });

  const ctx = canvasEl.getContext('2d', { alpha: true });
  p = makeP(canvasEl, ctx);

  /* DPR + size */
  let resizeRaf = null;
  function resizeToViewport() {
    const { w, h } = getViewportSize();
    p.pixelDensity(resolvePixelDensity(dprMode));
    p.resizeCanvas(w, h);
    // Ensure CSS box == logical size so grid math centers correctly
    canvasEl.style.width  = w + 'px';
    canvasEl.style.height = h + 'px';
    cachedGrid.w = cachedGrid.h = cachedGrid.cell = 0;
    applyCanvasNonBlockingStyle(canvasEl);
    if (hero.x == null) hero.x = Math.round(p.width * 0.50);
    if (hero.y == null) hero.y = Math.round(p.height * 0.30);
  }
  const resizeThrottled = () => {
    if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resizeToViewport);
  };
  resizeToViewport();
  window.addEventListener('resize', resizeThrottled, { passive: true });

  /* vis pause/resume */
  const visHandler = () => {
    if (document.visibilityState === 'visible') {
      resizeThrottled();
    }
  };
  document.addEventListener('visibilitychange', visHandler);

  // draw registry (same as before)
  function renderOne(p, it, rEff, sharedOpts, rootAppearK) {
    const opts = { ...sharedOpts, rootAppearK };
    switch (it.shape) {
      case 'snow': {
        // Responsive hideGroundAboveFrac by viewport width
        const vw = p.width;
        const hideFrac =
          vw < 768  ? 0.32 :
          vw < 1024 ? 0.4 :
                      0.2;
        drawSnow(p, it.x, it.y, rEff, {
          ...opts,
          footprint: it.footprint,
          usedRows: cachedGrid.rows,
          hideGroundAboveFrac: hideFrac,
          showGround: true,
        });
        break;
      }
      case 'house':  drawHouse(p, it.x, it.y, rEff, opts); break;
      case 'power':  drawPower(p, it.x, it.y, rEff, opts); break;
      case 'villa':  drawVilla(p, it.x, it.y, rEff, opts); break;
      case 'carFactory': drawCarFactory(p, it.x, it.y, rEff, opts); break;
      case 'bus':  drawBus(p, it.x, it.y, rEff, opts); break;
      case 'trees': drawTrees(p, it.x, it.y, rEff, opts); break;
      case 'car':    drawCar(p, it.x, it.y, rEff, opts); break;
      case 'sea':    drawSea(p, it.x, it.y, rEff, opts); break;
      case 'sun':    drawSun(p, it.x, it.y, rEff, opts); break;
      case 'clouds': drawClouds(p, it.x, it.y, rEff, opts); break;
    }
  }

  // NEW: sandbox each shape with p.push/pop and post-restore DPR check
  function renderOneSandboxed(p, it, rEff, sharedOpts, rootAppearK) {
    p.push();
    try {
      renderOne(p, it, rEff, sharedOpts, rootAppearK);
    } finally {
      p.pop();
      // reassert DPR transform if any child mutated ctx transform directly
      const ctx = p.drawingContext;
      const dpr = p.canvas?._dpr || 1;
      const T = ctx.getTransform();
      if (T.a !== dpr || T.d !== dpr || T.b !== 0 || T.c !== 0 || T.e !== 0 || T.f !== 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }

  function nowMs(){ return performance.now(); }

  /* main loop */
  let running = true;
  let rafId = null;
  function frame(now) {
    if (!running) return;
    p.__tick(now);

    // Normalize DPR transform at the very start of the frame
    {
      const dpr = p.canvas?._dpr || 1;
      const ctx = p.drawingContext;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // background
    drawBackground(p);

    const { cell } = computeGrid();

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

    // Match original z-order from q5.js
    const Z = {
      villa: 3,
      house: 2,
      power: 5,
      car:   8,
      carFactory: 6,
      snow:  9,
      sea:   10,
      bus: 11,
      sun:   0,
      trees:   12,
      clouds:1,
    };

    // ghosts
    if (useGhosts && ghosts.length) {
      const nextGhosts = [];
      for (const g of ghosts) {
        const dt = tMs - g.dieAtMs;
        if (dt >= style.exitMs) continue;
        const k = 1 - easeOutCubic(clamp01(dt / style.exitMs));
        const it = { x: g.x, y: g.y, shape: g.shape, footprint: g.footprint };
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
      const items = field.items.slice().sort((a,b)=>(Z[a.shape]??9)-(Z[b.shape]??9));
      for (const it of items) {
        const state = liveStates.get(it.id);
        const bornAt = state?.bornAtMs ?? tMs;

        let easedK = 1, alphaK = 1;
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

    // optional hero dot
    if (hero.visible && hero.x != null && hero.y != null) {
      p.fill(255,0,0,255);
      p.circle(hero.x, hero.y, style.r * 2);
    }

    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* controls (API-compatible) */
  function setFieldItems(nextItems = []) {
    const now = nowMs();
    field.epoch++;

    const useGhosts = style.exitMs > 0;

    if (!useGhosts) {
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

    // ghosts enabled
    for (const s of liveStates.values()) s._willDie = true;

    for (const it of Array.isArray(nextItems) ? nextItems : []) {
      const key = shapeKeyOfItem(it);
      const prev = liveStates.get(it.id);
      if (!prev) {
        liveStates.set(it.id, {
          shapeKey: key, bornAtMs: now, x: it.x, y: it.y, shape: it.shape, footprint: it.footprint, _willDie: false,
        });
      } else {
        if (prev.shapeKey !== key) {
          ghosts.push({ dieAtMs: now, x: prev.x, y: prev.y, shape: prev.shape, footprint: prev.footprint });
          prev.shapeKey = key;
          prev.bornAtMs = now;
        }
        prev.x = it.x; prev.y = it.y; prev.shape = it.shape; prev.footprint = it.footprint;
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
  function setFieldVisible(v){ field.visible = !!v; }
  function setHeroVisible(v){ hero.visible = !!v; }
  function setVisibleCanvas(v){ if (canvasEl?.style) canvasEl.style.opacity = v ? '1' : '0'; }
  function stop(){
    try { running = false; } catch {}
    if (rafId != null) { try { cancelAnimationFrame(rafId); } catch {} }
    document.removeEventListener('visibilitychange', visHandler);
    window.removeEventListener('resize', resizeThrottled);
    try { canvasEl?.removeEventListener?.('webglcontextlost', onContextLost); } catch {}
    try { canvasEl?.remove?.(); } catch {}
    REGISTRY.delete(mount);
  }

  const controls = {
    setFieldItems, setFieldStyle, setFieldVisible, setHeroVisible, setVisible: setVisibleCanvas, stop,
    get canvas(){ return canvasEl; },
  };
  REGISTRY.set(mount, { controls });
  onReady?.(controls);
  return controls;
}

// Build a p-like facade on an existing canvas (no animation / no DOM attach).
export function makePFromCanvas(canvas, { dpr = 1 } = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const p = makeP(canvas, ctx);          // reuse the same facade your drawers expect
  const cssW = canvas.style.width  ? parseFloat(canvas.style.width)  : canvas.width  / dpr;
  const cssH = canvas.style.height ? parseFloat(canvas.style.height) : canvas.height / dpr;
  p.pixelDensity(Math.max(1, dpr || 1));
  p.resizeCanvas(cssW, cssH);
  return p;
}

export default startQ5;