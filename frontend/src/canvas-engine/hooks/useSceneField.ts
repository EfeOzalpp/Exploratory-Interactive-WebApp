// src/canvas-engine/hooks/useSceneField.ts
import { useEffect, useRef } from "react";

import { composeField, makeDefaultPoolItem } from "../scene-logic/composeField.ts";
import type { PoolItem as ScenePoolItem } from "../scene-logic/types.ts";

import type { HostId } from "../multi-canvas-setup/ids.ts";
import { HOST_DEFS } from "../multi-canvas-setup/hostDefs.ts";

import { resolveSceneMode } from "../adjustable-rules/resolveSceneMode.ts";
import type { SceneMode } from "../multi-canvas-setup/sceneProfile.ts";

import { targetPoolSize } from "../adjustable-rules/poolSizes.ts";

import { resolveCanvasPaddingSpec } from "../adjustable-rules/resolveCanvasPadding.ts";
import { CANVAS_PADDING } from "../adjustable-rules/canvasPadding.ts";

type Engine = {
  ready: React.RefObject<boolean>;
  controls: React.RefObject<any>;
};

const clamp01 = (v?: number) =>
  typeof v === "number" ? Math.max(0, Math.min(1, v)) : 0.5;

function getCanvasLogicalSize(canvas: HTMLCanvasElement | undefined | null) {
  if (!canvas) {
    const w = typeof window !== "undefined" ? window.innerWidth : 1024;
    const h = typeof window !== "undefined" ? window.innerHeight : 768;
    return { w: Math.round(w), h: Math.round(h) };
  }

  const dpr =
    (canvas as any)._dpr ||
    (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

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

export function useSceneField(
  engine: Engine,
  hostId: HostId,
  allocAvg: number | undefined,
  signals: SceneSignals,
  viewportKey?: number | string
) {
  const { questionnaireOpen } = signals;

  const hostDef = HOST_DEFS[hostId];
  if (!hostDef) throw new Error(`Unknown hostId "${hostId}"`);

  const ruleset = hostDef.scene?.ruleset;
  if (!ruleset) throw new Error(`[${hostId}] missing scene.ruleset`);

  const baseMode = hostDef.scene?.baseMode ?? "start";

  // single source of truth: mode derived from (signals + host baseMode)
  const mode: SceneMode = resolveSceneMode(
    { questionnaireOpen },
    { baseMode }
  );

  // causes validation to run if you wrapped with defineRuleSet()
  const profile = ruleset.getProfile(mode);
  const quotaCurves = profile.quotaCurves;

  const uRef = useRef(0.5);
  uRef.current = clamp01(allocAvg);

  const poolRef = useRef<ScenePoolItem[] | null>(null);

  useEffect(() => {
    if (!engine?.ready?.current) return;

    const canvas = engine.controls.current?.canvas as
      | HTMLCanvasElement
      | null
      | undefined;

    const { w, h } = getCanvasLogicalSize(canvas);

    // IMPORTANT: poolsize from adjustable-rules by mode
    const desired = targetPoolSize({ mode, width: w } as any);
    ensurePoolSize(poolRef, desired);

    const pool = poolRef.current ?? [];

    const result = composeField({
      mode,
      allocAvg: uRef.current,
      viewportKey,
      canvas: { w, h },
      pool,
      quotaCurves,
    });

    poolRef.current = result.nextPool;

    // Optional layout injection
    try {
      const spec = resolveCanvasPaddingSpec(w, CANVAS_PADDING, mode);
      engine.controls.current?.setLayoutSpec?.({
        rows: spec.rows,
        useTopRatio: spec.useTopRatio,
      });
    } catch {}

    engine.controls.current?.setFieldItems?.(result.placed);
    engine.controls.current?.setFieldVisible?.(result.placed.length > 0);
  }, [engine, allocAvg, questionnaireOpen, viewportKey, hostId, mode, profile]);
}
