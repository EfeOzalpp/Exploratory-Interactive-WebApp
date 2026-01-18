// src/canvas-engine/runtime/render/gridOverlay.ts

import type { PLike } from "../p/makeP.ts";
import type { CanvasPaddingSpec } from "../../adjustable-rules/canvasPadding.ts";

export type GridOverlayParams = {
  cellW: number;
  cellH: number;
  ox: number;
  oy: number;
  rows: number;
  cols: number;
  usedRows: number;
};

export type GridOverlayDebug = {
  enabled: boolean;
  gridAlpha?: number;
  forbiddenAlpha?: number;
};

export function drawGridOverlay(
  p: PLike,
  grid: GridOverlayParams,
  spec: CanvasPaddingSpec,
  debug: GridOverlayDebug
) {
  if (!debug.enabled) return;

  const { cellW, cellH, ox, oy, rows, cols, usedRows } = grid;
  if (!cellW || !cellH || !rows || !cols) return;

  const ctx = p.drawingContext;
  const gridAlpha = debug.gridAlpha ?? 0.35;
  const forbAlpha = debug.forbiddenAlpha ?? 0.25;

  ctx.save();
  ctx.globalAlpha = gridAlpha;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";

  // verticals
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(ox + c * cellW) + 0.5;
    if (x < 0 || x > p.width) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, p.height);
    ctx.stroke();
  }

  // horizontals
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(oy + r * cellH) + 0.5;
    if (y < 0 || y > p.height) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(p.width, y);
    ctx.stroke();
  }

  // usedRows boundary
  {
    const y = Math.round(oy + usedRows * cellH) + 0.5;
    ctx.strokeStyle = "rgba(255,0,0,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(p.width, y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
  }

  // forbidden
  if (spec.forbidden) {
    ctx.globalAlpha = forbAlpha;
    ctx.fillStyle = "rgba(0,0,0,0.35)";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (spec.forbidden(r, c, rows, cols)) {
          ctx.fillRect(ox + c * cellW, oy + r * cellH, cellW, cellH);
        }
      }
    }
  }

  ctx.restore();
}
