// src/graph-runtime/dotgraph/event-handlers/edgeCue.controller.ts
import { useEffect, useRef } from 'react';

export type EdgeCueMode = 'off' | 'near' | 'in';

export type EdgeCueState = {
  visible: boolean;
  mode: EdgeCueMode;
  insetX: number;
  insetY: number;
  pinned: boolean;
};

export type EdgeDriveState = {
  active: boolean;
  nx: number;
  ny: number;
  strength: number;
};

export type UseEdgeCueControllerParams = {
  useDesktopLayout: boolean;
  menuOpenRef: React.RefObject<boolean>;
};

export function useEdgeCueController({ useDesktopLayout, menuOpenRef }: UseEdgeCueControllerParams) {
  // === Desktop edge bands ===
  const edgeHotzoneRef = useRef(false);
  const edgeDriveRef = useRef<EdgeDriveState>({ active: false, nx: 0, ny: 0, strength: 0 });

  // HUD state we expose/broadcast
  const edgeCueRef = useRef<EdgeCueState>({
    visible: false,
    mode: 'off',
    insetX: 0,
    insetY: 0,
    pinned: false,
  });

  // Pinning
  const edgeCuePinnedRef = useRef(false);
  const edgeCueLastModeRef = useRef<EdgeCueMode>('off');

  // last desktop mode (for rising-edge)
  const lastDesktopModeRef = useRef<EdgeCueMode>('off');

  // Gating for unwanted first flip:
  const firstPointerSeenRef = useRef(false);
  const hasSeenNonEdgeRef = useRef(false);

  // --- canonical latched state broadcaster ---
  const lastBroadcastRef = useRef<EdgeCueState>(edgeCueRef.current);
  const broadcastEdgeCue = (next: EdgeCueState) => {
    const prev = lastBroadcastRef.current;
    if (
      !prev ||
      prev.visible !== next.visible ||
      prev.mode !== next.mode ||
      prev.insetX !== next.insetX ||
      prev.insetY !== next.insetY ||
      prev.pinned !== next.pinned
    ) {
      lastBroadcastRef.current = next;
      window.dispatchEvent(new CustomEvent('gp:edge-cue', { detail: next }));
    }
  };

  const broadcastLatchedState = (latched: boolean) => {
    (window as any).__gpEdgeLatched = !!latched;
    window.dispatchEvent(
      new CustomEvent('gp:edge-cue-state', { detail: { latched: !!latched } })
    );
  };

  // Initialize canonical latched once (SSR-safe default true if unset)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__gpEdgeLatched == null) {
      (window as any).__gpEdgeLatched = true; // LIGHT by default
    }
    broadcastLatchedState(Boolean((window as any).__gpEdgeLatched));
  }, []);

  // Toggle pin (from HUD click OR mobile long-press)
  useEffect(() => {
    const onToggle = () => {
      if (menuOpenRef.current) return; // ignore toggles while menu open

      if (!useDesktopLayout) {
        edgeCuePinnedRef.current = !edgeCuePinnedRef.current;
        const next: EdgeCueState = {
          visible: edgeCuePinnedRef.current,
          mode: edgeCuePinnedRef.current ? 'in' : 'off',
          insetX: 0,
          insetY: 0,
          pinned: edgeCuePinnedRef.current,
        };
        edgeCueLastModeRef.current = next.mode;
        edgeCueRef.current = next;
        broadcastEdgeCue(next);
        broadcastLatchedState(!Boolean((window as any).__gpEdgeLatched));
        hasSeenNonEdgeRef.current = false;
        return;
      }

      const currentlyVisible = edgeCueRef.current?.visible || edgeCuePinnedRef.current;
      if (!currentlyVisible) return;

      edgeCuePinnedRef.current = !edgeCuePinnedRef.current;

      if (!edgeCuePinnedRef.current) {
        const offPinned: EdgeCueState = { ...edgeCueRef.current, pinned: false };
        edgeCueRef.current = offPinned;
        broadcastEdgeCue(offPinned);
      } else {
        const modeToUse =
          edgeCueRef.current.mode === 'off'
            ? edgeCueLastModeRef.current === 'off'
              ? 'in'
              : edgeCueLastModeRef.current
            : edgeCueRef.current.mode;

        const snap: EdgeCueState = {
          ...edgeCueRef.current,
          visible: true,
          pinned: true,
          mode: modeToUse,
        };
        edgeCueLastModeRef.current = modeToUse;
        edgeCueRef.current = snap;
        broadcastEdgeCue(snap);
      }

      broadcastLatchedState(!Boolean((window as any).__gpEdgeLatched));
      hasSeenNonEdgeRef.current = false;
    };

    window.addEventListener('gp:edge-cue-toggle', onToggle);
    return () => window.removeEventListener('gp:edge-cue-toggle', onToggle);
  }, [useDesktopLayout, menuOpenRef]);

  // Desktop-only pointer bands that drive edge cue live state
  useEffect(() => {
    if (!useDesktopLayout) {
      const off: EdgeCueState = {
        visible: false,
        mode: 'off',
        insetX: 0,
        insetY: 0,
        pinned: false,
      };
      edgeCuePinnedRef.current = false;
      edgeCueRef.current = off;
      broadcastEdgeCue(off);
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      // While info panel is open, force edge-drive off and stop cues
      if (menuOpenRef.current) {
        edgeHotzoneRef.current = false;
        edgeDriveRef.current = { active: false, nx: 0, ny: 0, strength: 0 };
        if (!edgeCuePinnedRef.current) {
          const off: EdgeCueState = {
            visible: false,
            mode: 'off',
            insetX: 0,
            insetY: 0,
            pinned: false,
          };
          edgeCueRef.current = off;
          broadcastEdgeCue(off);
        }
        return;
      }

      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      if (w === 0 || h === 0) {
        edgeHotzoneRef.current = false;
        edgeDriveRef.current = { active: false, nx: 0, ny: 0, strength: 0 };
        if (!edgeCuePinnedRef.current) {
          const off: EdgeCueState = {
            visible: false,
            mode: 'off',
            insetX: 0,
            insetY: 0,
            pinned: false,
          };
          edgeCueRef.current = off;
          broadcastEdgeCue(off);
        }
        return;
      }

      const x = (e as any).clientX;
      const y = (e as any).clientY;

      const insetX = 240,
        insetY = 80;
      const NEAR_MARGIN_PX = 40;
      const nearInsetX = insetX + NEAR_MARGIN_PX;
      const nearInsetY = insetY + NEAR_MARGIN_PX;

      const CENTER_GAP_START = w * 0.38;
      const CENTER_GAP_END = w * 0.62;
      const inCenterGapX = x >= CENTER_GAP_START && x <= CENTER_GAP_END;

      const nx = (x / w) * 2 - 1;
      const ny = -((y / h) * 2 - 1);

      let sx = 0;
      if (x < insetX) sx = (insetX - x) / insetX;
      else if (x > w - insetX) sx = (x - (w - insetX)) / insetX;

      let syTop = 0,
        syBot = 0;
      if (!inCenterGapX) {
        if (y < insetY) syTop = (insetY - y) / insetY;
        else if (y > h - insetY) syBot = (y - (h - insetY)) / insetY;
      }
      const sy = Math.max(syTop, syBot);

      const strength = Math.max(sx, sy);
      const inEdge = strength > 0;

      const nearTop = !inCenterGapX && y < nearInsetY;
      const nearBottom = !inCenterGapX && y > h - nearInsetY;
      const nearLeft = x < nearInsetX;
      const nearRight = x > w - nearInsetX;
      const nearEdge = !inEdge && (nearTop || nearBottom || nearLeft || nearRight);

      edgeHotzoneRef.current = inEdge;
      edgeDriveRef.current = inEdge
        ? { active: true, nx, ny, strength: Math.min(1, Math.max(0, strength)) }
        : { active: false, nx: 0, ny: 0, strength: 0 };

      const candidate: EdgeCueState = {
        visible: inEdge || nearEdge,
        mode: inEdge ? 'in' : nearEdge ? 'near' : 'off',
        insetX,
        insetY,
        pinned: edgeCuePinnedRef.current,
      };

      let finalCue = candidate;
      if (edgeCuePinnedRef.current) {
        const modeToUse =
          candidate.mode === 'off' ? edgeCueLastModeRef.current || 'in' : candidate.mode;
        edgeCueLastModeRef.current = modeToUse;
        finalCue = { ...candidate, visible: true, mode: 'in', pinned: true };
      } else {
        edgeCueLastModeRef.current = candidate.mode;
      }

      if (!firstPointerSeenRef.current) {
        firstPointerSeenRef.current = true;
        lastDesktopModeRef.current = finalCue.mode;
        hasSeenNonEdgeRef.current = finalCue.mode !== 'in';
        edgeCueRef.current = finalCue;
        broadcastEdgeCue(finalCue);
        return;
      }

      if (finalCue.mode !== 'in') hasSeenNonEdgeRef.current = true;

      const prevMode = lastDesktopModeRef.current || 'off';
      const risingIn = finalCue.mode === 'in' && prevMode !== 'in' && hasSeenNonEdgeRef.current;

      lastDesktopModeRef.current = finalCue.mode;
      edgeCueRef.current = finalCue;

      if (risingIn) {
        broadcastLatchedState(!Boolean((window as any).__gpEdgeLatched));
        hasSeenNonEdgeRef.current = false;
      }

      broadcastEdgeCue(finalCue);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true } as any);
    return () => window.removeEventListener('pointermove', onPointerMove as any);
  }, [useDesktopLayout, menuOpenRef]);

  return {
    edgeHotzoneRef,
    edgeDriveRef,
    edgeCueRef,
  };
}
