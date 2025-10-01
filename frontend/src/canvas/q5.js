// src/canvas/q5.js
import * as Q5NS from 'q5';
import { bandFromWidth, GRID_MAP } from './grid/config.ts';
import { makeCenteredSquareGrid } from './grid/layoutCentered.ts';

// Resolve callable constructor from q5 export shapes
const q5 =
  (Q5NS && typeof Q5NS.q5 === 'function' && Q5NS.q5) ||
  (Q5NS && typeof Q5NS.default === 'function' && Q5NS.default) ||
  (typeof Q5NS === 'function' && Q5NS);

if (typeof q5 !== 'function') {
  // eslint-disable-next-line no-console
  console.error('q5 import shape:', Q5NS);
  throw new Error('Could not resolve a callable q5() from the q5 package export.');
}

const REGISTRY = new Map();

// -------- viewport helpers
function getViewportSize() {
  const vv = typeof window !== 'undefined' && window.visualViewport;
  if (vv && vv.width && vv.height) {
    return { w: Math.round(vv.width), h: Math.round(vv.height) };
  }
  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  return { w, h };
}

// --- Non-interactive, body-level mount container
function ensureMount(mount) {
  let el = document.querySelector(mount);
  if (!el) {
    el = document.createElement('div');
    el.id = mount.startsWith('#') ? mount.slice(1) : mount;
    document.body.appendChild(el);
  }
  el.style.position = 'fixed';
  el.style.inset = '0';
  // dynamic viewport height on mobile; avoids iOS URL bar issues
  el.style.height = '100dvh';
  el.style.width = '100vw';
  el.style.zIndex = '0';
  el.style.pointerEvents = 'none';
  el.style.touchAction = 'auto';
  el.style.userSelect = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  el.classList.add('gp-q5-layer');
  return el;
}

// --- ensure the canvas itself is non-blocking (call on setup + resize)
function applyCanvasNonBlockingStyle(el) {
  if (!el?.style) return;
  el.style.position = 'absolute';
  el.style.inset = '0';
  // do not set explicit width/height here; let p5 style the canvas box.
  el.style.zIndex = '0';
  el.style.pointerEvents = 'none';
  el.style.touchAction = 'auto';
  el.style.userSelect = 'none';
  el.setAttribute('tabindex', '-1');
}

// --- Soft blue radial background (center-bottom glow)
const drawBackground = (p) => {
  p.background('#b4e4fdff');

  const ctx = p.drawingContext;
  const cx = p.width / 2;
  const cy = p.height;

  const inner = Math.min(p.width, p.height) * 0.12;
  const outer = Math.max(p.width, p.height) * 0.95;

  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0.00, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.50)');
  g.addColorStop(0.55, 'rgba(196,220,242,0.25)');
  g.addColorStop(0.85, 'rgba(196,220,242,0.10)');
  g.addColorStop(1.00, 'rgba(196,220,242,0.00)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.width, p.height);
};

/**
 * Start q5 app.
 * @param {object} param0
 *  - mount: CSS selector for mount element (default '#canvas-root')
 *  - onReady: ({ ...controls }) => void
 *  - dprMode: 'fixed1' | 'cap2' (default 'fixed1')
 */
export function startQ5({ mount = '#canvas-root', onReady, dprMode = 'fixed1' } = {}) {
  if (REGISTRY.has(mount)) return REGISTRY.get(mount).controls;

  const parentEl = ensureMount(mount);

  // --- shared style for ALL field items
  const style = {
    r: 11,
    color: 'hsl(200, 70%, 55%)',
    // NEW: optional per-shape overrides for better legibility / theming
    perShapeScale: /** @type {Partial<Record<'circle'|'triangle'|'square'|'octagon', number>>} */ ({}),
    perShapeFill:  /** @type {Partial<Record<'circle'|'triangle'|'square'|'octagon', string>>} */ ({}),
  };

  // --- field items: {x, y, shape}
  const field = {
    // { id?: number, footprint?: { r0,c0,w,h } are accepted and ignored by default drawing }
    items: /** @type {Array<{x:number,y:number,shape:'circle'|'triangle'|'square'|'octagon',id?:number,footprint?:{r0:number,c0:number,w:number,h:number}}>} */ ([]),
    visible: true,
  };

  // Optional legacy "hero" dot — disabled by default
  const hero = { x: null, y: null, visible: false };

  let canvasEl = null;
  let vvResizeHandler = null;
  let winResizeHandler = null;
  let orientHandler = null;

  // ---- shape render helpers (centered on cx,cy; 'r' is radius-ish)
  function drawCircle(p, cx, cy, r) {
    p.circle(cx, cy, r * 2);
  }
  function drawTriangle(p, cx, cy, r) {
    const h = r * Math.sqrt(3);
    p.triangle(
      cx, cy - (2/3) * h,
      cx - r, cy + (1/3) * h,
      cx + r, cy + (1/3) * h
    );
  }
  function drawSquare(p, cx, cy, r) {
    const s = r * 2;
    p.rect(cx - r, cy - r, s, s, 2);
  }
  function drawOctagon(p, cx, cy, r) {
    // regular octagon approximated by radius r from center
    const a = Math.PI / 4;
    p.beginShape();
    for (let i = 0; i < 8; i++) {
      const th = a * i + a / 2; // rotate a touch for nicer alignment
      p.vertex(cx + r * Math.cos(th) * 1.07, cy + r * Math.sin(th) * 1.07);
    }
    p.endShape(p.CLOSE);
  }

  const app = q5((p) => {
    const resizeToViewport = () => {
      const { w, h } = getViewportSize();
      p.resizeCanvas(w, h);
      applyCanvasNonBlockingStyle(canvasEl);
      if (hero.x == null) hero.x = Math.round(p.width * 0.50);
      if (hero.y == null) hero.y = Math.round(p.height * 0.30);
    };

    p.setup = () => {
      const { w, h } = getViewportSize();
      const c = p.createCanvas(w, h, p.P2D);

      // Set pixel density AFTER createCanvas to avoid renderer=null errors
      try {
        if (dprMode === 'fixed1') {
          p.pixelDensity(1);
        } else {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          p.pixelDensity(dpr);
        }
      } catch {}

      c.parent(parentEl);
      canvasEl = c.elt || c.canvas || c;
      p.noStroke();

      applyCanvasNonBlockingStyle(canvasEl);

      if (hero.x == null) hero.x = Math.round(p.width * 0.50);
      if (hero.y == null) hero.y = Math.round(p.height * 0.30);

      // attach viewport listeners
      vvResizeHandler = () => resizeToViewport();
      winResizeHandler = () => resizeToViewport();
      orientHandler = () => setTimeout(resizeToViewport, 50);

      window.visualViewport?.addEventListener?.('resize', vvResizeHandler, { passive: true });
      window.addEventListener('resize', winResizeHandler, { passive: true });
      window.addEventListener('orientationchange', orientHandler, { passive: true });

      onReady?.({
        // FIELD controls
        setFieldItems, setFieldStyle, setFieldVisible,
        // optional legacy toggles:
        setHeroVisible,
      });
    };

    // p5 fallback (some browsers trigger this reliably)
    p.windowResized = () => {
      const { w, h } = getViewportSize();
      p.resizeCanvas(w, h);
      applyCanvasNonBlockingStyle(canvasEl);
      if (hero.x == null) hero.x = Math.round(p.width * 0.50);
      if (hero.y == null) hero.y = Math.round(p.height * 0.30);
    };

    p.draw = () => {
      drawBackground(p);
// Debug: visualize footprints (enable via window.__debugFootprints = true)
if (window.__debugFootprints && field.items.length) {
  p.push();
  p.noFill();
  p.stroke(0, 120, 255, 130);
  for (const it of field.items) {
    const f = it.footprint; if (!f) continue;
    const x = f.c0 * cell, y = f.r0 * cell, ww = f.w * cell, hh = f.h * cell;
    p.rect(x, y, ww, hh);
  }
  p.pop();
}

      // --- permanent grid for debugging/visual sanity
      const spec = GRID_MAP[bandFromWidth(p.width)];
      const { cell, rows, cols } = makeCenteredSquareGrid({
        w: p.width,
        h: p.height,
        rows: spec.rows,
        useTopRatio: spec.useTopRatio ?? 1,
      });

      p.push();
      p.noFill();
      p.stroke(0, 0, 0, 40); // faint grid lines
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cell;
          const y = r * cell;
          p.rect(x, y, cell, cell);
        }
      }
      p.pop();

      // --- draw the field (items with shapes)
      if (field.visible && field.items.length) {
        p.push();
        p.noStroke();
        for (let i = 0; i < field.items.length; i++) {
          const it = field.items[i];
          // effective style: per-shape overrides (fallback to global)
          const scale = style.perShapeScale?.[it.shape] ?? 1;
          const fill  = style.perShapeFill?.[it.shape]  ?? style.color;
          const rEff  = style.r * scale;
          p.fill(fill);
          switch (it.shape) {
            case 'triangle':  drawTriangle(p, it.x, it.y, rEff); break;
            case 'square':    drawSquare(p, it.x, it.y, rEff);   break;
            case 'octagon':   drawOctagon(p, it.x, it.y, rEff);  break;
            case 'circle':
            default:          drawCircle(p, it.x, it.y, rEff);   break;
          }
        }
        p.pop();
      }

      // (optional) hero dot — off by default
      if (hero.visible && hero.x != null && hero.y != null) {
        p.fill(style.color);
        p.circle(hero.x, hero.y, style.r * 2);
      }
    };
  });

  // -------- controls (FIELD is the primary API)
  function setFieldItems(items = []) { field.items = Array.isArray(items) ? items : []; }
  function setFieldStyle({ r, color } = {}) {
    if (Number.isFinite(r) && r > 0) style.r = r;
    if (typeof color === 'string') style.color = color;
    // NEW: accept optional per-shape maps via same API
    if (arguments[0] && typeof arguments[0].perShapeScale === 'object') {
      style.perShapeScale = { ...style.perShapeScale, ...arguments[0].perShapeScale };
    }
    if (arguments[0] && typeof arguments[0].perShapeFill === 'object') {
      style.perShapeFill = { ...style.perShapeFill, ...arguments[0].perShapeFill };
    }
  }
  function setFieldVisible(v) { field.visible = !!v; }

  // Back-compat: allow old "points" to still draw (as circles)
  function setFieldPoints(points = []) {
    if (!Array.isArray(points)) { field.items = []; return; }
    field.items = points.map((p) => ({ x: p.x, y: p.y, shape: 'circle' }));
  }

  // Optional: dev toggle to show a single hero dot
  function setHeroVisible(v) { hero.visible = !!v; }

  function setVisibleCanvas(v) {
    if (!canvasEl?.style) return;
    canvasEl.style.opacity = v ? '1' : '0';
  }

  function stop() {
    try { app.remove?.(); } catch {}
    // remove listeners
    if (vvResizeHandler) window.visualViewport?.removeEventListener?.('resize', vvResizeHandler);
    if (winResizeHandler) window.removeEventListener('resize', winResizeHandler);
    if (orientHandler) window.removeEventListener('orientationchange', orientHandler);

    REGISTRY.delete(mount);
    parentEl?.querySelectorAll('canvas').forEach((cv) => {
      if (cv.parentElement === parentEl) cv.remove();
    });
  }

  const controls = {
    // field API (primary)
    setFieldItems,
    setFieldStyle,
    setFieldVisible,

    // back-compat for older hooks
    setFieldPoints,

    // optional hero toggle
    setHeroVisible,

    // canvas visibility
    setVisible: setVisibleCanvas,

    // lifecycle
    stop,

    // canvas ref
    get canvas() { return canvasEl; },
  };

  REGISTRY.set(mount, { app, controls });
  return controls;
}

export default startQ5;
