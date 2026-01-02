// src/canvas-engine/hooks/useSceneField.ts
import { useEffect, useRef } from 'react';
import { useAppState } from '../../app-context/appStateContext.tsx';

import { composeField, makeDefaultPoolItem } from '../layout/scene-composition/composeField.ts';
import type { PoolItem as ScenePoolItem } from '../layout/scene-composition/types.ts';

import { targetPoolSize } from '../layout/scene-composition/poolSizing.ts';

type Engine = {
  ready: React.MutableRefObject<boolean>;
  controls: React.MutableRefObject<any>;
};

const clamp01 = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;

/**
 * Derives logical canvas size from the backing store, accounting for DPR.
 * This avoids depending on DOM rect reads while transforms/animations are active.
 */
function getCanvasLogicalSize(canvas: HTMLCanvasElement | undefined | null) {
  if (!canvas) {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const h = typeof window !== 'undefined' ? window.innerHeight : 768;
    return { w: Math.round(w), h: Math.round(h) };
  }

  const dpr =
    (canvas as any)._dpr ||
    (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  const backingW = (canvas.width || 0) / dpr;
  const backingH = (canvas.height || 0) / dpr;

  const cssW = (canvas as any)._cssW;
  const cssH = (canvas as any)._cssH;

  const w = Number.isFinite(cssW) ? cssW : backingW;
  const h = Number.isFinite(cssH) ? cssH : backingH;

  return { w: Math.round(w), h: Math.round(h) };
}

function ensurePoolSize(poolRef: React.MutableRefObject<ScenePoolItem[] | null>, desired: number) {
  if (desired <= 0) {
    poolRef.current = [];
    return;
  }

  const cur = poolRef.current;

  if (!cur) {
    poolRef.current = Array.from({ length: desired }, (_, i) => makeDefaultPoolItem(i + 1));
    return;
  }

  if (cur.length === desired) return;

  if (cur.length > desired) {
    poolRef.current = cur.slice(0, desired);
    return;
  }

  const maxId = cur.reduce((m, p) => Math.max(m, p.id), 0);
  const toAdd = desired - cur.length;

  const extra = Array.from({ length: toAdd }, (_, k) => makeDefaultPoolItem(maxId + k + 1));
  poolRef.current = cur.concat(extra);
}

/**
 * React hook that keeps the engine field in sync with app state and allocAvg.
 * It owns lifecycle, sizing, and control writes; composition lives in scene-composition.
 */
export function useSceneField(
  engine: Engine,
  allocAvg: number | undefined,
  viewportKey?: number | string,
  opts?: { overlay?: boolean }
) {
  const { questionnaireOpen } = useAppState();
  const overlay = !!opts?.overlay;

  const uRef = useRef(0.5);
  uRef.current = clamp01(allocAvg);

  const poolRef = useRef<ScenePoolItem[] | null>(null);

  useEffect(() => {
    if (!engine?.ready?.current) return;

    engine.controls.current?.setQuestionnaireOpen?.(questionnaireOpen);

    const canvas = engine.controls.current?.canvas as HTMLCanvasElement | null | undefined;
    const { w, h } = getCanvasLogicalSize(canvas);

    const desired = targetPoolSize({
      questionnaireOpen,
      overlay,
      width: w,
    });

    ensurePoolSize(poolRef, desired);

    const pool = poolRef.current ?? [];

    const result = composeField({
      questionnaireOpen,
      overlay,
      allocAvg: uRef.current,
      viewportKey,
      canvas: { w, h },
      pool,
    });

    poolRef.current = result.nextPool;

    engine.controls.current?.setFieldItems?.(result.placed);
    engine.controls.current?.setFieldVisible?.(result.placed.length > 0);
  }, [engine, allocAvg, questionnaireOpen, viewportKey, overlay]);
}
