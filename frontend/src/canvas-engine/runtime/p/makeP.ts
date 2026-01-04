// canvas-engine/engine/p/makeP.ts

type CssRGB = { r: number; g: number; b: number };

export type PLike = {
  canvas: HTMLCanvasElement & { _dpr?: number; _cssW?: number; _cssH?: number };
  readonly width: number;
  readonly height: number;
  readonly deltaTime: number;
  millis(): number;
  drawingContext: CanvasRenderingContext2D;

  P2D: "2d";

  createCanvas(w: number, h: number): HTMLCanvasElement;
  resizeCanvas(w: number, h: number): void;
  pixelDensity(dpr: number): void;

  background(css: string): void;

  push(): void;
  pop(): void;

  translate(x: number, y: number): void;
  scale(x: number, y?: number): void;
  rotate(r: number): void;

  noFill(): void;
  fill(r: number | string, g?: number, b?: number, a?: number): void;

  noStroke(): void;
  stroke(r: number, g: number, b: number, a?: number): void;

  strokeWeight(w: number): void;

  CORNER: "corner";
  CENTER: "center";
  rectMode(mode: "corner" | "center"): void;

  rect(x: number, y: number, w: number, h: number, tl?: number, tr?: number, br?: number, bl?: number): void;
  circle(x: number, y: number, d: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;

  beginShape(): void;
  vertex(x: number, y: number): void;
  endShape(mode?: string): void;
  CLOSE: "close";

  color(css: string): CssRGB;
  red(c: CssRGB): number;
  green(c: CssRGB): number;
  blue(c: CssRGB): number;

  __tick(now: number): void;
};

export function makeP(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): PLike {
  let _delta = 16,
    _last = performance.now();
  const state = { doFill: true, doStroke: false, lineWidth: 1 };

  // Engine-side state that must survive save/restore
  let _rectMode: "corner" | "center" = "corner";
  const _pStateStack: Array<{ _rectMode: "corner" | "center" }> = [];

  // simple css→rgb parser using canvas
  const _scratch = document.createElement("canvas").getContext("2d")!;
  function parseCss(css: string): CssRGB {
    _scratch.fillStyle = "#000";
    _scratch.fillStyle = css;
    const s = _scratch.fillStyle as string; // canonicalized css
    _scratch.fillStyle = s;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(_scratch.fillStyle as string);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  // simple immediate-mode beginShape/vertex path
  let _shapeOpen = false;
  let _firstVertex = true;

  const c = canvas as PLike["canvas"];

  const p: PLike = {
    canvas: c,
    get width() {
      return c._cssW || c.width;
    },
    get height() {
      return c._cssH || c.height;
    },
    get deltaTime() {
      return _delta;
    },
    millis() {
      return performance.now();
    },
    drawingContext: ctx,
    P2D: "2d",

    createCanvas(w, h) {
      c.width = w;
      c.height = h;
      return c;
    },

    resizeCanvas(w, h) {
      const ratio = c._dpr || 1;
      c._cssW = w;
      c._cssH = h;
      c.width = Math.max(1, Math.floor(w * ratio));
      c.height = Math.max(1, Math.floor(h * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    },

    pixelDensity(dpr) {
      const w = c._cssW || c.clientWidth || window.innerWidth;
      const h = c._cssH || c.clientHeight || window.innerHeight;
      c._dpr = Math.max(1, dpr || 1);
      p.resizeCanvas(w, h);
    },

    background(css) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    },

    push() {
      _pStateStack.push({ _rectMode });
      ctx.save();
    },
    pop() {
      ctx.restore();
      const s = _pStateStack.pop();
      _rectMode = s ? s._rectMode : "corner";
    },

    translate(x, y) {
      ctx.translate(x, y);
    },
    scale(x, y) {
      ctx.scale(x, y == null ? x : y);
    },
    rotate(r) {
      ctx.rotate(r);
    },

    noFill() {
      state.doFill = false;
    },
    fill(r, g, b, a = 255) {
      state.doFill = true;
      if (typeof r === "string") {
        const c2 = parseCss(r);
        ctx.fillStyle = `rgba(${c2.r},${c2.g},${c2.b},${a / 255})`;
      } else {
        ctx.fillStyle = `rgba(${r | 0},${(g as number) | 0},${(b as number) | 0},${(a | 0) / 255})`;
      }
    },
    noStroke() {
      state.doStroke = false;
    },
    stroke(r, g, b, a = 255) {
      state.doStroke = true;
      ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${(a | 0) / 255})`;
    },
    strokeWeight(w) {
      state.lineWidth = w;
      ctx.lineWidth = w;
    },

    CORNER: "corner",
    CENTER: "center",
    rectMode(mode) {
      _rectMode = mode === p.CENTER ? "center" : "corner";
    },

    rect(x, y, w, h, tl = 0, tr = tl, br = tl, bl = tl) {
      if (_rectMode === "center") {
        x = x - w / 2;
        y = y - h / 2;
      }
      const rr = (rad: number) => Math.max(0, Math.min(rad, Math.min(w, h) / 2));
      const rtl = rr(tl),
        rtr = rr(tr),
        rbr = rr(br),
        rbl = rr(bl);

      ctx.beginPath();
      ctx.moveTo(x + rtl, y);
      ctx.lineTo(x + w - rtr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rtr);
      ctx.lineTo(x + w, y + h - rbr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h);
      ctx.lineTo(x + rbl, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rbl);
      ctx.lineTo(x, y + rtl);
      ctx.quadraticCurveTo(x, y, x + rtl, y);

      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },

    circle(x, y, d) {
      ctx.beginPath();
      ctx.arc(x, y, d / 2, 0, Math.PI * 2);
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },

    line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
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

    beginShape() {
      ctx.beginPath();
      _shapeOpen = true;
      _firstVertex = true;
    },
    vertex(x, y) {
      if (!_shapeOpen) return;
      if (_firstVertex) {
        ctx.moveTo(x, y);
        _firstVertex = false;
      } else {
        ctx.lineTo(x, y);
      }
    },
    endShape(mode) {
      if (!_shapeOpen) return;
      if (mode && (mode === "close" || mode === p.CLOSE)) ctx.closePath();
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
      _shapeOpen = false;
    },
    CLOSE: "close",

    color(css) {
      return parseCss(css);
    },
    red(c2) {
      return c2.r;
    },
    green(c2) {
      return c2.g;
    },
    blue(c2) {
      return c2.b;
    },

    __tick(now) {
      _delta = now - _last;
      _last = now;
    },
  };

  return p;
}
