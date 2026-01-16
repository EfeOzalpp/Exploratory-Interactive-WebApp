// src/graph-runtime/dotgraph/event-handlers/useRotation.ts
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { Group } from 'three';

export type GestureState = {
  pinching: boolean;
  touchCount: number;
  pinchCooldownUntil: number; // ms timestamp
};

export type EdgeDrive = { active: boolean; nx: number; ny: number; strength: number };

export type UseRotationParams = {
  groupRef: RefObject<Group | null>;
  useDesktopLayout: boolean;
  isTabletLike: boolean;
  minRadius: number;
  maxRadius: number;
  radius: number;
  markActivity?: () => void;
  isDragging?: boolean;
  gestureRef?: RefObject<GestureState>;
  edgeDriveRef?: RefObject<EdgeDrive>;

  // add: info panel gate
  menuOpenRef?: RefObject<boolean>;
};

export type UseRotationReturn = {
  isPinchingRef: RefObject<boolean>;
  isTouchRotatingRef: RefObject<boolean>;
  effectiveDraggingRef: RefObject<boolean>;
  getDesktopCursorTarget: () => { x: number; y: number };
  applyRotationFrame: (args: { idleActive: boolean; delta: number }) => void;
  notePossibleIdleExit: (idleActive: boolean) => void;
  lastMouseMoveTsRef: RefObject<number>;
};

export default function useRotation({
  groupRef,
  useDesktopLayout,
  isTabletLike,
  minRadius,
  maxRadius,
  radius,
  markActivity,
  isDragging,
  gestureRef,
  edgeDriveRef,
  menuOpenRef,
}: UseRotationParams): UseRotationReturn {
  const { gl } = useThree(); // canvas element lives here

  const isPinchingRef = useRef(false);
  const isTouchRotatingRef = useRef(false);
  const lastTouchRef = useRef({ x: 0, y: 0, t: 0 });
  const spinVelRef = useRef({ x: 0, y: 0 });

  // After pinch, ignore first 1-finger frame (until we reseed)
  const ignoreFirstSingleAfterPinchRef = useRef(false);

  // ✅ exported: "effectiveDraggingRef" (for orchestrator to read)
  const effectiveDraggingRef = useRef(false);

  // --- Canonical latched state helpers (global, shared across app) ---
  const getLatched = () => {
    if (typeof window === 'undefined') return true;
    const w = window as any;
    if (w.__gpEdgeLatched == null) w.__gpEdgeLatched = true;
    return !!w.__gpEdgeLatched;
  };

  const setLatched = (next: boolean) => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.__gpEdgeLatched = !!next;
    window.dispatchEvent(
      new CustomEvent('gp:edge-cue-state', {
        detail: { latched: !!next },
      })
    );
  };

  // --- App activity gate: true only when the app/tab is focused and pointer is inside the OS window
  const appActiveRef = useRef(true);

  useEffect(() => {
    const recompute = () => {
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus?.() ?? true;
      appActiveRef.current = visible && focused;
    };

    // If pointer leaves **the OS window**, stop edge-drive immediately
    const onPointerOut = (e: PointerEvent) => {
      // relatedTarget === null means it left the browser window
      if ((e as any).relatedTarget === null) appActiveRef.current = false;
    };

    const onPointerOver = () => {
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus?.() ?? true;
      appActiveRef.current = visible && focused;
    };

    const onBlur = () => {
      appActiveRef.current = false;
    };
    const onFocus = () => recompute();
    const onVis = () => recompute();

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('pointerover', onPointerOver);

    recompute();

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('pointerover', onPointerOver);
    };
  }, []);

  // --- Touch-only: long-press → flip canonical latched state (mobile HUD) ---
  const holdTimerRef = useRef<number | null>(null);
  const holdArmedRef = useRef(false); // prevent repeat fires per gesture
  const holdSceneRef = useRef(false); // true only if touch started on canvas
  const HOLD_MS = 650;

  // desktop cursor-follow state
  const lastCursorPositionRef = useRef({ x: 0, y: 0 }); // -1..1 in canvas space
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragEndRef = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  // recent mouse movement (idle gating)
  const lastMouseMoveTsRef = useRef(0);

  // bias
  const rotBiasRef = useRef({ x: 0, y: 0 });
  const rotBiasDecayRef = useRef(0);

  // idle bookkeeping
  const wasIdleRef = useRef(false);
  const idleEnterYawRef = useRef<number | null>(null);

  // edge-drive bookkeeping (for exit remap)
  const wasEdgeDrivingRef = useRef(false);

  const isMovingRef = useRef(false);

  // Live mirror of isDragging for single-bound handlers & frames
  const isDraggingRef = useRef(!!isDragging);
  useEffect(() => {
    isDraggingRef.current = !!isDragging;
  }, [isDragging]);

  // Keep a live canvas rect so we can map window coords → canvas NDC
  const canvasRectRef = useRef({ left: 0, top: 0, width: 1, height: 1 });

  // persistent cursor→rotation remap (prevents snap on handoffs)
  const cursorRemapXRef = useRef(0);
  const cursorRemapYRef = useRef(0);
  const remapArmedRef = useRef(false);

  // keep canvas rect fresh
  useEffect(() => {
    const canvas = (gl as any)?.domElement as HTMLElement | undefined;

    const updateRect = () => {
      const r = canvas?.getBoundingClientRect?.();
      if (r)
        canvasRectRef.current = {
          left: r.left,
          top: r.top,
          width: r.width || 1,
          height: r.height || 1,
        };
    };

    updateRect();

    let ro: ResizeObserver | undefined;
    if (canvas && 'ResizeObserver' in window) {
      ro = new ResizeObserver(updateRect);
      ro.observe(canvas);
    }

    window.addEventListener('resize', updateRect);
    const raf = requestAnimationFrame(updateRect);

    return () => {
      ro?.disconnect?.();
      window.removeEventListener('resize', updateRect);
      cancelAnimationFrame(raf);
    };
  }, [gl]);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const DEADZONE_PX = 2.0 * dpr;
    const PX_TO_RAD = (isTabletLike ? 0.004 : 0.006) / dpr;

    // Helper: did this touch start over the WebGL canvas?
    const isSceneTouchTarget = (target: EventTarget | null) => {
      const canvas = (gl as any)?.domElement as HTMLElement | undefined;
      if (!canvas || !(target instanceof Node)) return false;
      return target === canvas || canvas.contains(target);
    };

    // --- Desktop/global pointer tracking ---
    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvasRectRef.current;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      lastCursorPositionRef.current = { x: nx, y: ny };
      lastMouseMoveTsRef.current = performance.now();
      markActivity?.();
    };

    // --- Touch handlers ---
    const handleTouchStart = (event: TouchEvent) => {
      markActivity?.();
      if (gestureRef?.current) gestureRef.current.touchCount = event.touches.length;

      if (event.touches.length === 1) {
        const t = event.touches[0];
        holdSceneRef.current = isSceneTouchTarget(t.target);

        isTouchRotatingRef.current = true;
        isMovingRef.current = false;
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
        spinVelRef.current = { x: 0, y: 0 };

        holdArmedRef.current = holdSceneRef.current;
        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);

        if (holdArmedRef.current) {
          holdTimerRef.current = window.setTimeout(() => {
            if (
              holdArmedRef.current &&
              holdSceneRef.current &&
              !isPinchingRef.current &&
              !gestureRef?.current?.pinching
            ) {
              setLatched(!getLatched());
              holdArmedRef.current = false;
            }
          }, HOLD_MS);
        }
      } else if (event.touches.length >= 2) {
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };
        if (gestureRef?.current) gestureRef.current.pinching = true;

        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        holdArmedRef.current = false;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      if (isDraggingRef.current) return;
      markActivity?.();

      const now = performance.now();
      const gs = gestureRef?.current;
      const inCooldown = gs ? now < (gs.pinchCooldownUntil || 0) : false;
      const multiTouch = (gs?.touchCount ?? event.touches.length) >= 2;
      const pinching = !!(gs?.pinching || isPinchingRef.current);

      if (multiTouch || pinching) return;

      if (inCooldown) {
        if (event.touches.length === 1) {
          const t = event.touches[0];
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
          ignoreFirstSingleAfterPinchRef.current = true;
        }
        return;
      }

      if (event.touches.length === 1) {
        const t = event.touches[0];
        const now2 = performance.now();

        if (ignoreFirstSingleAfterPinchRef.current) {
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
          ignoreFirstSingleAfterPinchRef.current = false;
          return;
        }

        const last = lastTouchRef.current;
        const dt = Math.max(1, now2 - last.t);
        const dx = t.clientX - last.x;
        const dy = t.clientY - last.y;

        const moving = Math.abs(dx) >= DEADZONE_PX || Math.abs(dy) >= DEADZONE_PX;
        isMovingRef.current = moving;

        if (!moving) {
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
          return;
        }

        const g = groupRef.current;
        if (g) {
          g.rotation.x += -dy * PX_TO_RAD;
          g.rotation.y += -dx * PX_TO_RAD;
        }

        const vx = (-dy / dt) * 1000 * PX_TO_RAD;
        const vy = (-dx / dt) * 1000 * PX_TO_RAD;
        spinVelRef.current = {
          x: (spinVelRef.current.x + vx) * 0.5,
          y: (spinVelRef.current.y + vy) * 0.5,
        };

        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      markActivity?.();

      if (gestureRef?.current) {
        gestureRef.current.touchCount = event.touches.length;
        if (gestureRef.current.pinching && event.touches.length < 2) {
          gestureRef.current.pinching = false;
          if ((gestureRef.current.pinchCooldownUntil || 0) < performance.now() + 200) {
            gestureRef.current.pinchCooldownUntil = performance.now() + 200;
          }
        }
      }

      if (event.touches.length === 0) {
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
      }
      if (event.touches.length < 2) isPinchingRef.current = false;

      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      holdArmedRef.current = false;
      holdSceneRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    };
  }, [isTabletLike, groupRef, markActivity, gl, gestureRef]);

  // desktop drag reconciliation (so orbit doesn't jump after UI drag)
  useEffect(() => {
    if (!useDesktopLayout) return;
    if (isDragging) {
      lastCursorPositionRef.current = {
        x: lastCursorPositionRef.current.x - (dragOffset.current?.x || 0),
        y: lastCursorPositionRef.current.y - (dragOffset.current?.y || 0),
      };
      dragStartRef.current = { ...lastCursorPositionRef.current };
      markActivity?.();
    } else {
      dragEndRef.current = { ...lastCursorPositionRef.current };
      dragOffset.current = {
        x: dragEndRef.current.x - dragStartRef.current.x,
        y: dragEndRef.current.y - dragStartRef.current.y,
      };
    }
  }, [isDragging, useDesktopLayout, markActivity]);

  // base mapping from cursor to target (desktop)
  const getDesktopCursorTargetBase = () => {
    const tx = (lastCursorPositionRef.current.y - (dragOffset.current?.y || 0)) * Math.PI * 0.25;
    const ty = (lastCursorPositionRef.current.x - (dragOffset.current?.x || 0)) * Math.PI * 0.5;
    return { x: tx, y: -ty };
  };

  // wrapper that applies cursor→rotation remap
  const getDesktopCursorTarget = () => {
    const base = getDesktopCursorTargetBase();
    return { x: base.x + (cursorRemapXRef.current || 0), y: base.y + (cursorRemapYRef.current || 0) };
  };

  // ----- Idle transition with remap set on exit (existing behavior: yaw only) -----
  function notePossibleIdleExit(idleActive: boolean) {
    if (!wasIdleRef.current && idleActive) {
      const g = groupRef.current;
      if (g) {
        idleEnterYawRef.current = g.rotation.y;
        rotBiasRef.current.x = 0;
        rotBiasRef.current.y = 0;
        rotBiasDecayRef.current = 0;
      } else {
        idleEnterYawRef.current = null;
      }
    }

    if (wasIdleRef.current && !idleActive) {
      const g = groupRef.current;
      if (g) {
        const currentY = g.rotation.y;
        const { y: baseY } = getDesktopCursorTargetBase();
        cursorRemapYRef.current = currentY - baseY;
        remapArmedRef.current = true;
      }
      idleEnterYawRef.current = null;
    }

    wasIdleRef.current = idleActive;
  }

  // frame application
  const ROT_RELEASE_TAU = 0.09;
  const ROT_MIN_SPEED = 0.02;

  // continuous edge-driven rotation speed caps (rad/s)
  const EDGE_MAX_PITCH_SPEED = 1.7;
  const EDGE_MAX_YAW_SPEED = 2.4;

  function applyRotationFrame({ idleActive, delta }: { idleActive: boolean; delta: number }) {
    const g = groupRef.current;
    if (!g) return;

    // ✅ effectiveDraggingRef: what the system should consider “user interacting”
    effectiveDraggingRef.current =
      !!isDraggingRef.current || !!isTouchRotatingRef.current || !!isPinchingRef.current;

    // ✅ additional hard gate: menu open freezes rotation updates
    if (menuOpenRef?.current) return;

    // Freeze rotation while dragging external UI
    if (isDraggingRef.current) return;

    if (!idleActive) {
      if (useDesktopLayout) {
        const edge = edgeDriveRef?.current;
        const appActive = appActiveRef.current;
        const isEdgeDriving = appActive && !!edge?.active;

        // Exit edge-drive → set remap to avoid snap on resume
        if (wasEdgeDrivingRef.current && !isEdgeDriving) {
          const base = getDesktopCursorTargetBase();
          const curX = g.rotation.x;
          const curY = g.rotation.y;
          cursorRemapXRef.current = curX - base.x;
          cursorRemapYRef.current = curY - base.y;
          remapArmedRef.current = true;
        }
        wasEdgeDrivingRef.current = isEdgeDriving;

        if (isEdgeDriving && edge) {
          g.rotation.x += edge.ny * EDGE_MAX_PITCH_SPEED * delta;
          g.rotation.y += -edge.nx * EDGE_MAX_YAW_SPEED * delta;
          return;
        }

        // Standard desktop cursor-follow
        const { x: targetXFromCursor, y: targetYFromCursor } = getDesktopCursorTarget();

        if (rotBiasDecayRef.current > 0) {
          const tau = 0.18;
          const k = 1 - Math.exp(-delta / tau);
          rotBiasRef.current.x -= rotBiasRef.current.x * k;
          rotBiasRef.current.y -= rotBiasRef.current.y * k;
          rotBiasDecayRef.current = Math.max(0, rotBiasDecayRef.current - delta);
        }

        const targetX = targetXFromCursor + (rotBiasRef.current.x || 0);
        const targetY = targetYFromCursor + (rotBiasRef.current.y || 0);

        // Zoom-aware easing
        const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
        const EASE_MIN = 0.06;
        const EASE_MAX = 0.12;
        const EASE = EASE_MIN + (EASE_MAX - EASE_MIN) * (1 - zf);

        g.rotation.x += (targetX - g.rotation.x) * EASE;
        g.rotation.y += (targetY - g.rotation.y) * EASE;
      } else {
        // touch inertia
        const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
        const zoomMul = 0.9 + 0.8 * zf;
        const tabletMul = isTabletLike ? 1.6 : 1.25;
        const movingBoost = (0.10 + (0.30 - 0.10) * zf);
        const motionMul = isMovingRef.current ? movingBoost : 1.0;

        const holdingTouch = isTouchRotatingRef.current && !isPinchingRef.current;
        if (!holdingTouch) {
          const k = Math.exp(-delta / ROT_RELEASE_TAU);
          spinVelRef.current.x *= k;
          spinVelRef.current.y *= k;
          if (Math.abs(spinVelRef.current.x) < ROT_MIN_SPEED) spinVelRef.current.x = 0;
          if (Math.abs(spinVelRef.current.y) < ROT_MIN_SPEED) spinVelRef.current.y = 0;
        }

        const mul = zoomMul * tabletMul * motionMul;
        g.rotation.x += spinVelRef.current.x * delta * mul;
        g.rotation.y += spinVelRef.current.y * delta * mul;
      }
    }
  }

  // keep your optional debug frame hook (no behavior change)
  useFrame(() => {
    // example placeholder: remapArmedRef is still here if you want logs
    void remapArmedRef.current;
  });

  return {
    isPinchingRef,
    isTouchRotatingRef,
    effectiveDraggingRef,
    getDesktopCursorTarget,
    applyRotationFrame,
    notePossibleIdleExit,
    lastMouseMoveTsRef,
  };
}
