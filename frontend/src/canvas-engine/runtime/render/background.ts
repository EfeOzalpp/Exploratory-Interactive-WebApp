// src/canvas-engine/runtime/render/background.ts

import type { PLike } from "../p/makeP.ts";

export function drawBackground(p: PLike) {
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
