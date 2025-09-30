// src/canvas/q5.js
import * as Q5NS from 'q5';
import { getDotColor } from './palette';

// Normalize export
const q5 =
  (Q5NS && typeof Q5NS.q5 === 'function' && Q5NS.q5) ||
  (Q5NS && typeof Q5NS.default === 'function' && Q5NS.default) ||
  (typeof Q5NS === 'function' && Q5NS);

if (typeof q5 !== 'function') {
  // eslint-disable-next-line no-console
  console.error('q5 import shape:', Q5NS);
  throw new Error('Could not resolve a callable q5() from the q5 package export.');
}

// --- Singleton registry (per mount key) ---
const REGISTRY = new Map();

// Ensure BODY-level mount container exists
function ensureMount(mount) {
  let el = document.querySelector(mount);
  if (!el) {
    el = document.createElement('div');
    el.id = mount.startsWith('#') ? mount.slice(1) : mount;
    document.body.appendChild(el);
  }
  el.style.position = 'relative';
  el.style.width = '0';
  el.style.height = '0';
  el.style.pointerEvents = 'none';
  return el;
}

// Radial gradient (gentle white to pale blue from bottom-center)
const drawBackground = (p) => {
  p.background('#F5FAFF');

  let innerRadius, outerRadius;
  if (p.width < 768) {
    innerRadius = p.width * 0.15;
    outerRadius = p.width * 1.8;
  } else if (p.width <= 1024) {
    innerRadius = p.width * 0.14;
    outerRadius = p.width * 1.3;
  } else {
    innerRadius = p.width * 0.12;
    outerRadius = p.width * 0.9;
  }

  const ctx = p.drawingContext;
  const cx = p.width / 2;
  const cy = p.height;

  const g = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
  g.addColorStop(0.00, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.50)');
  g.addColorStop(0.55, 'rgba(196,220,242,0.25)');
  g.addColorStop(0.85, 'rgba(196,220,242,0.10)');
  g.addColorStop(1.00, 'rgba(196,220,242,0.00)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.width, p.height);
}

// --- Ownership guard: kill extra q5 canvases created elsewhere ---
function installCanvasPolice(ownedCanvas, parentEl) {
  if (window.__gpQ5CanvasObserver) return;
  const isOwned = (node) => node === ownedCanvas || node.parentElement === parentEl;

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (
          n.nodeType === 1 &&
          n.tagName === 'CANVAS' &&
          /\bq5Canvas\b/i.test(n.className || '') &&
          !isOwned(n)
        ) {
          try { n.remove(); } catch {}
        }
      });
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
  window.__gpQ5CanvasObserver = obs;
}

export function startQ5({ mount = '#canvas-root', onReady } = {}) {
  // If already started here, return its controls
  if (REGISTRY.has(mount)) return REGISTRY.get(mount).controls;

  const parentEl = ensureMount(mount);

  // --- DOT STATE (single dot for now; expand later if needed)
  const dot = {
    x: null,           // default: center-ish position computed on first draw
    y: null,
    r: 10,             // radius in px
    colorKey: 'primary',
    color: null,       // optional direct CSS color overrides colorKey
    visible: true,
  };

  let canvasEl = null;

  const app = q5((p) => {
    p.setup = () => {
      const c = p.createCanvas(p.windowWidth, p.windowHeight);
      c.parent(parentEl);
      canvasEl = c.elt || c.canvas || c;
      p.noStroke();
      p.colorMode(p.HSB, 360, 100, 100, 100);

      if (canvasEl && canvasEl.style) {
        canvasEl.style.position = 'fixed';
        canvasEl.style.top = 0;
        canvasEl.style.left = 0;
        canvasEl.style.width = '100%';
        canvasEl.style.height = '100%';
        canvasEl.style.zIndex = 5;         // per your requirement
        canvasEl.style.pointerEvents = 'none';
      }

      installCanvasPolice(canvasEl, parentEl);
      onReady?.({ setDot, showDot, hideDot });
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      // If dot never positioned explicitly, keep it proportional
      if (dot.x == null) dot.x = p.width / 2;
      if (dot.y == null) dot.y = Math.floor(p.height * 0.78);
    };

    p.draw = () => {
      drawBackground(p);

      // default dot position (if not set yet)
      if (dot.x == null) dot.x = p.width / 2;
      if (dot.y == null) dot.y = Math.floor(p.height * 0.3);

      // render dot
      if (dot.visible) {
        const fillColor = dot.color || getDotColor(dot.colorKey);
        p.fill(fillColor);
        p.circle(dot.x, dot.y, dot.r * 2);
      }
    };
  });

  // --- Controls API ---
  function setDot(opts = {}) {
    const { x, y, r, colorKey, color, visible } = opts;
    if (typeof x === 'number') dot.x = x;
    if (typeof y === 'number') dot.y = y;
    if (typeof r === 'number' && r > 0) dot.r = r;
    if (typeof colorKey === 'string') dot.colorKey = colorKey;
    if (typeof color === 'string') dot.color = color;
    if (typeof visible === 'boolean') dot.visible = visible;
  }
  function showDot() { dot.visible = true; }
  function hideDot() { dot.visible = false; }

  function setVisibleCanvas(v) {
    if (!canvasEl?.style) return;
    canvasEl.style.opacity = v ? '1' : '0';
  }

  function stop() {
    try { app.remove?.(); } catch {}
    REGISTRY.delete(mount);
    parentEl?.querySelectorAll('canvas').forEach((cv) => {
      if (cv.parentElement === parentEl) cv.remove();
    });
  }

  const controls = {
    setDot,
    showDot,
    hideDot,
    setVisible: setVisibleCanvas,
    stop,
    get canvas() { return canvasEl; },
  };

  REGISTRY.set(mount, { app, controls });
  return controls;
}

export default startQ5;
