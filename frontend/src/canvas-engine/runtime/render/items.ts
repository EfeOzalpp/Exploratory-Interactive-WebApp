// src/canvas-engine/runtime/render/items.ts

import type { EngineFieldItem } from "../types.ts";
import type { Ghost } from "./ghosts.ts";
import { clamp01, easeOutCubic } from "../util/easing.ts";

export type LiveState = {
  shapeKey: string;
  bornAtMs: number;
  x: number;
  y: number;
  shape: string;
  footprint?: any;
  _willDie?: boolean;
};

export function drawItems(params: {
  items: EngineFieldItem[];
  visible: boolean;
  nowMs: number;
  appearMs: number;
  Z: Record<string, number>;
  liveStates: Map<string, LiveState>;
  perShapeScale: Record<string, number> | undefined;
  baseR: number;
  baseShared: any;
  renderOne: (it: EngineFieldItem, rEff: number, shared: any, rootAppearK: number) => void;
  shapeKeyOfItem: (it: EngineFieldItem) => string;
  onGhost?: (g: Ghost) => void;
}) {
  const { items, visible, nowMs, appearMs, Z, liveStates, perShapeScale, baseR, baseShared, renderOne, shapeKeyOfItem, onGhost, } = params;

  if (!visible || !items.length) return;

  const sorted = items.slice().sort((a, b) => (Z[a.shape] ?? 9) - (Z[b.shape] ?? 9));

  for (const it of sorted) {
    let state = liveStates.get(it.id);
      if (!state) {
        state = {
          shapeKey: shapeKeyOfItem(it),
          bornAtMs: nowMs,
          x: it.x,
          y: it.y,
          shape: it.shape,
          footprint: it.footprint,
        };
        liveStates.set(it.id, state);
      } else {
        state.x = it.x;
        state.y = it.y;
        state.shape = it.shape;
        state.footprint = it.footprint;
      }

    const bornAt = state.bornAtMs;

    let easedK = 1;
    let alphaK = 1;

    if (appearMs > 0) {
      const appearT = clamp01((nowMs - bornAt) / appearMs);
      easedK = easeOutCubic(appearT);
      alphaK = easedK;
    }

    const scale = perShapeScale?.[it.shape] ?? 1;
    const rEff = baseR * scale;

    const shared = { ...baseShared, footprint: it.footprint, alpha: Math.round(235 * alphaK) };
    renderOne(it, rEff, shared, easedK);
  }
}

export function defaultShapeKeyOfItem(it: EngineFieldItem) {
  const f = it.footprint || { w: 0, h: 0, r0: 0, c0: 0 };
  return `${it.shape}|w${f.w}h${f.h}|r${f.r0}c${f.c0}`;
}

