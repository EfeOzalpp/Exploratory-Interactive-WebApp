// src/canvas-engine/validation/validateSceneProfile.ts
import type { SceneMode, SceneProfile } from "../multi-canvas-setup/sceneProfile.ts";
import { invariant } from "./invariant.ts";

const KINDS = ["A", "B", "C", "D"] as const;

function isCurvesBySet(x: any): x is Record<string, any> {
  // old format usually has "default"/"overlay" keys
  return !!x && typeof x === "object" && ("default" in x || "overlay" in x);
}

function validateCurvesByKind(id: string, curves: any) {
  invariant(
    !!curves && typeof curves === "object",
    `[${id}] quotaCurves must be an object keyed by condition kinds (A,B,C,D)`
  );

  for (const k of KINDS) {
    invariant(
      Array.isArray(curves[k]),
      `[${id}] quotaCurves missing kind "${k}". Available: ${Object.keys(curves).join(", ")}`
    );

    // Optional sanity: each anchor has {t, limits}
    for (const a of curves[k]) {
      invariant(
        a && typeof a.t === "number" && a.limits && typeof a.limits === "object",
        `[${id}] quotaCurves["${k}"] contains invalid anchor (expected { t:number, limits:object })`
      );
    }
  }
}

export function validateSceneProfile(id: string, mode: SceneMode, profile: SceneProfile) {
  invariant(!!profile, `[${id}] SceneProfile is missing`);
  invariant(!!profile.padding, `[${id}] missing "padding" on SceneProfile`);
  invariant(!!profile.bands, `[${id}] missing "bands" on SceneProfile`);
  invariant(!!profile.shapeMeta, `[${id}] missing "shapeMeta" on SceneProfile`);
  invariant(!!profile.poolSizes, `[${id}] missing "poolSizes" on SceneProfile (define per mode)`);

  // --- quotaCurves: support BOTH formats during migration ---
  const qc: any = (profile as any).quotaCurves;
  invariant(!!qc, `[${id}] missing "quotaCurves" on SceneProfile`);

  if (isCurvesBySet(qc)) {
    // OLD format: { default: CurvesByKind, overlay: CurvesByKind }
    const curveSet = (profile as any).curveSet ?? "default";
    const selected = qc[curveSet];

    invariant(
      !!selected,
      `[${id}] quotaCurves missing curveSet "${curveSet}". Available: ${Object.keys(qc).join(", ")}`
    );

    validateCurvesByKind(id, selected);
  } else {
    // NEW format: CurvesByKind directly
    validateCurvesByKind(id, qc);
  }

  // Optional: validate poolSizes contains the requested mode
  invariant(
    (profile as any).poolSizes?.[mode],
    `[${id}] poolSizes missing mode "${mode}". Available: ${Object.keys((profile as any).poolSizes ?? {}).join(", ")}`
  );
}
