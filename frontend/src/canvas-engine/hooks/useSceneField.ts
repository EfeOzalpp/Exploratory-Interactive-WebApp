// src/canvas-engine/hooks/useSceneField.ts

import { useEffect, useRef } from 'react';
import { composeField, makeDefaultPoolItem } from '../scene-logic/composeField.ts';
import type { PoolItem as ScenePoolItem } from '../scene-logic/types.ts';
import { targetPoolSize } from '../scene-logic/poolSize.ts';

import type { HostId } from '../multi-canvas-setup/ids.ts';

// scene-key resolver (you add this file)
import { resolveSceneKey } from '../shared/scene-schema/resolveSceneKey.ts';
// profiles registry (you add this file)
import { SCENE_PROFILES } from '../shared/scene-schema/sceneProfiles.ts';

type Engine = {
  ready: React.RefObject<boolean>;
  controls: React.RefObject<any>;
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

function ensurePoolSize(
  poolRef: React.RefObject<ScenePoolItem[] | null>,
  desired: number
) {
  if (desired <= 0) {
    poolRef.current = [];
    return;
  }

  const cur = poolRef.current;

  if (!cur) {
    poolRef.current = Array.from({ length: desired }, (_, i) =>
      makeDefaultPoolItem(i + 1)
    );
    return;
  }

  if (cur.length === desired) return;

  if (cur.length > desired) {
    poolRef.current = cur.slice(0, desired);
    return;
  }

  const maxId = cur.reduce((m, p) => Math.max(m, p.id), 0);
  const toAdd = desired - cur.length;

  const extra = Array.from({ length: toAdd }, (_, k) =>
    makeDefaultPoolItem(maxId + k + 1)
  );
  poolRef.current = cur.concat(extra);
}

export type SceneSignals = {
  questionnaireOpen: boolean;
};

// keep this minimal for now; later you can pass a mode string instead of overlay boolean
export type SceneHostOpts = {
  baseMode?: 'start' | 'overlay';
};


export function useSceneField(
  engine: Engine,
  hostId: HostId,
  allocAvg: number | undefined,
  signals: SceneSignals,
  viewportKey?: number | string,
  opts?: SceneHostOpts
) {

  const { questionnaireOpen } = signals;

  // baseMode lets city default to overlay without sprinkling booleans everywhere
  const sceneKey = resolveSceneKey(hostId, { questionnaireOpen }, { baseMode: opts?.baseMode });
  const overlay = sceneKey.endsWith(':overlay');
  
  // get profile (even if you don't use it everywhere yet)
  const profile = SCENE_PROFILES[sceneKey];

  const uRef = useRef(0.5);
  uRef.current = clamp01(allocAvg);

  const poolRef = useRef<ScenePoolItem[] | null>(null);

  useEffect(() => {
    if (!engine?.ready?.current) return;

    engine.controls.current?.setQuestionnaireOpen?.(questionnaireOpen);

    const canvas = engine.controls.current?.canvas as
      | HTMLCanvasElement
      | null
      | undefined;

    const { w, h } = getCanvasLogicalSize(canvas);

    // still using old API (questionnaireOpen/overlay) for now
    const desired = targetPoolSize({
      questionnaireOpen,
      overlay,
      width: w,
    });

    ensurePoolSize(poolRef, desired);

    const pool = poolRef.current ?? [];

    // still using old composeField API for now
    // later: pass sceneKey or profile down and stop passing overlay/questionnaireOpen separately
    const result = composeField({
      questionnaireOpen,
      overlay,
      allocAvg: uRef.current,
      viewportKey,
      canvas: { w, h },
      pool,

      // optional: pass through for future migration (composeField can ignore for now)
      sceneKey,
      profile,
    } as any);

    poolRef.current = result.nextPool;

    engine.controls.current?.setFieldItems?.(result.placed);
    engine.controls.current?.setFieldVisible?.(result.placed.length > 0);
  }, [engine, allocAvg, questionnaireOpen, viewportKey, overlay, hostId, sceneKey, profile]);
}
