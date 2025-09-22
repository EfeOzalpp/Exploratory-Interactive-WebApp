// src/hooks/orbit/useRotation.js
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

export default function useRotation({
  groupRef,
  useDesktopLayout,
  isTabletLike,
  minRadius,
  maxRadius,
  radius,
  markActivity,
  isDragging,

  // edge-drive info from useOrbit
  edgeDriveRef, // { current: { active, nx, ny, strength } }
}) {
  const { gl } = useThree(); // canvas element lives here

  const isPinchingRef      = useRef(false);
  const isTouchRotatingRef = useRef(false);
  const lastTouchRef       = useRef({ x: 0, y: 0, t: 0 });
  const spinVelRef         = useRef({ x: 0, y: 0 });

  // --- Canonical latched state helpers (global, shared across app) ---
  const getLatched = () => {
    if (typeof window === 'undefined') return true;
    if (window.__gpEdgeLatched == null) window.__gpEdgeLatched = true;
    return !!window.__gpEdgeLatched;
  };
  const setLatched = (next) => {
    if (typeof window === 'undefined') return;
    window.__gpEdgeLatched = !!next;
    window.dispatchEvent(new CustomEvent('gp:edge-cue-state', {
      detail: { latched: !!next }
    }));
  };

  // --- Touch-only: long-press → flip canonical latched state (mobile HUD) ---
  const holdTimerRef   = useRef(null);
  const holdArmedRef   = useRef(false);   // prevent repeat fires per gesture
  const holdSceneRef   = useRef(false);   // true only if touch started on canvas
  const HOLD_MS        = 650;             // tweak to taste

  // desktop cursor-follow state
  const lastCursorPositionRef = useRef({ x: 0, y: 0 }); // -1..1 in canvas space
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragEndRef   = useRef({ x: 0, y: 0 });
  const dragOffset   = useRef({ x: 0, y: 0 });

  // recent mouse movement (idle gating)
  const lastMouseMoveTsRef = useRef(0);

  // bias (kept for other blends if you use it elsewhere)
  const rotBiasRef      = useRef({ x: 0, y: 0 });
  const rotBiasDecayRef = useRef(0);

  // idle bookkeeping
  const wasIdleRef      = useRef(false);
  const idleEnterYawRef = useRef(null); // radians (for logs / debugging)

  // edge-drive bookkeeping (for exit remap)
  const wasEdgeDrivingRef = useRef(false);

  const isMovingRef     = useRef(false);

  // Live mirror of isDragging for single-bound handlers & frames
  const isDraggingRef = useRef(!!isDragging);
  useEffect(() => { isDraggingRef.current = !!isDragging; }, [isDragging]);

  // Keep a live canvas rect so we can map window coords → canvas NDC even when UI overlaps
  const canvasRectRef = useRef({ left: 0, top: 0, width: 1, height: 1 });

  // persistent cursor→rotation remap (prevents snap on handoffs)
  const cursorRemapXRef = useRef(0);       // radians (pitch/x)
  const cursorRemapYRef = useRef(0);       // radians (yaw/y)
  const remapArmedRef   = useRef(false);   // for optional logs

  const rad2deg = (r) => (r * 180) / Math.PI;

  // keep canvas rect fresh
  useEffect(() => {
    const canvas = gl?.domElement;
    const updateRect = () => {
      const r = canvas?.getBoundingClientRect?.();
      if (r) canvasRectRef.current = {
        left: r.left,
        top: r.top,
        width: r.width || 1,
        height: r.height || 1,
      };
    };
    updateRect();

    let ro;
    if (canvas && 'ResizeObserver' in window) {
      ro = new ResizeObserver(updateRect);
      ro.observe(canvas);
    }
    window.addEventListener('resize', updateRect);
    const raf = requestAnimationFrame(updateRect);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateRect);
      cancelAnimationFrame(raf);
    };
  }, [gl]);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const DEADZONE_PX = 2.0 * dpr;
    const PX_TO_RAD   = (isTabletLike ? 0.009 : 0.005) / dpr;

    // Helper: did this touch start over the WebGL canvas?
    const isSceneTouchTarget = (target) => {
      const canvas = gl?.domElement;
      if (!canvas) return false;
      return target === canvas || canvas.contains(target);
    };

    // --- Desktop/global pointer tracking (works even over other UI) ---
    const handlePointerMove = (event) => {
      const rect = canvasRectRef.current; // canvas rect in page space
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      lastCursorPositionRef.current = { x: nx, y: ny };
      lastMouseMoveTsRef.current = performance.now();
      markActivity?.();
    };

    // --- Touch handlers (rotate/pinch + long-press latch flip) ---
    const handleTouchStart = (event) => {
      markActivity?.();
      if (event.touches.length === 1) {
        const t = event.touches[0];

        // Only arm long-press if touch begins on the canvas (not UI)
        holdSceneRef.current = isSceneTouchTarget(t.target);

        isTouchRotatingRef.current = true;
        isMovingRef.current = false;
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
        spinVelRef.current = { x: 0, y: 0 };

        // Arm long-press regardless of movement; cancel only on pinch / touchend.
        holdArmedRef.current = holdSceneRef.current; // arm only for scene touches
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (holdArmedRef.current) {
          holdTimerRef.current = setTimeout(() => {
            if (holdArmedRef.current && holdSceneRef.current && !isPinchingRef.current) {
              // Flip canonical state ONCE per gesture
              setLatched(!getLatched());
              holdArmedRef.current = false;
            }
          }, HOLD_MS);
        }
      }
    };

    const handleTouchMove = (event) => {
      event.preventDefault();
      if (isDraggingRef.current) return;

      markActivity?.();

      if (event.touches.length === 1 && !isPinchingRef.current) {
        const t   = event.touches[0];
        const now = performance.now();
        const last = lastTouchRef.current;
        const dt = Math.max(1, now - last.t);
        const dx = t.clientX - last.x;
        const dy = t.clientY - last.y;

        const moving = Math.abs(dx) >= DEADZONE_PX || Math.abs(dy) >= DEADZONE_PX;
        isMovingRef.current = moving;

        // NOTE: We do NOT cancel the long-press on movement anymore.

        if (!moving) {
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now };
          return;
        }

        if (groupRef.current) {
          groupRef.current.rotation.x += (-dy) * PX_TO_RAD;
          groupRef.current.rotation.y += (-dx) * PX_TO_RAD;
        }

        const vx = (-dy / dt) * 1000 * PX_TO_RAD;
        const vy = (-dx / dt) * 1000 * PX_TO_RAD;
        spinVelRef.current = {
          x: (spinVelRef.current.x + vx) * 0.5,
          y: (spinVelRef.current.y + vy) * 0.5,
        };
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now };
      } else if (event.touches.length === 2) {
        isPinchingRef.current = true;
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };

        // any pinch cancels the long-press intent
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        holdArmedRef.current = false;
      }
    };

    const handleTouchEnd = (e) => {
      markActivity?.();

      // cleanup long-press timer
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      holdArmedRef.current = false;
      holdSceneRef.current = false;

      if (e.touches.length === 0) {
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
      }
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchstart',  handleTouchStart,  { passive: false });
    window.addEventListener('touchmove',   handleTouchMove,   { passive: false });
    window.addEventListener('touchend',    handleTouchEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchstart',  handleTouchStart);
      window.removeEventListener('touchmove',   handleTouchMove);
      window.removeEventListener('touchend',    handleTouchEnd);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [isTabletLike, groupRef, markActivity, gl]);

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
    const tx =
      (lastCursorPositionRef.current.y - (dragOffset.current?.y || 0)) *
      Math.PI * 0.25;
    const ty =
      (lastCursorPositionRef.current.x - (dragOffset.current?.x || 0)) *
      Math.PI * 0.5;
    return { x: tx, y: -ty };
  };

  // wrapper that applies cursor→rotation remap (prevents snap on handoffs)
  const getDesktopCursorTarget = () => {
    const base = getDesktopCursorTargetBase();
    const xRemapped = base.x + (cursorRemapXRef.current || 0);
    const yRemapped = base.y + (cursorRemapYRef.current || 0);
    return { x: xRemapped, y: yRemapped };
  };

  // ----- Idle transition with remap set on exit (existing behavior: yaw only) -----
  function notePossibleIdleExit(idleActive) {
    // ENTER idle
    if (!wasIdleRef.current && idleActive) {
      if (groupRef.current) {
        idleEnterYawRef.current = groupRef.current.rotation.y;
        rotBiasRef.current.x = 0;
        rotBiasRef.current.y = 0;
        rotBiasDecayRef.current = 0;
      } else {
        idleEnterYawRef.current = null;
      }
    }

    // EXIT idle → align yaw to cursor (keep your existing logic)
    if (wasIdleRef.current && !idleActive) {
      if (groupRef.current != null) {
        const currentY = groupRef.current.rotation.y;
        const { y: baseY } = getDesktopCursorTargetBase(); // raw cursor-mapped yaw (no remap)
        const remapY = currentY - baseY;
        cursorRemapYRef.current = remapY;
        remapArmedRef.current = true;
      }
      idleEnterYawRef.current = null;
    }

    wasIdleRef.current = idleActive;
  }

  // (optional) debug log, throttled
  useFrame(() => {
    if (!useDesktopLayout || !groupRef.current) return;
    if (remapArmedRef.current) {
      if (!useFrame._lastLog || performance.now() - useFrame._lastLog > 500) {
        const { x, y } = getDesktopCursorTarget();
        // console.log("[Remap] target=(", rad2deg(x).toFixed(1), ",", rad2deg(y).toFixed(1), ") yaw=", rad2deg(groupRef.current.rotation.y).toFixed(1));
        useFrame._lastLog = performance.now();
      }
    }
  });

  // frame application
  const ROT_RELEASE_TAU = 0.09;
  const ROT_MIN_SPEED   = 0.02;

  // continuous edge-driven rotation speed caps (rad/s)
  const EDGE_MAX_PITCH_SPEED = 1.70;  // x-axis
  const EDGE_MAX_YAW_SPEED   = 2.4;   // y-axis

  function applyRotationFrame({ idleActive, delta }) {
    if (!groupRef.current) return;

    // Freeze rotation while dragging external UI, but still track pointer via window
    if (isDraggingRef.current) return;

    if (!idleActive) {
      if (useDesktopLayout) {
        const edge = edgeDriveRef?.current;
        const isEdgeDriving = !!edge?.active;

        // ===== Edge-drive EXIT → set remap for BOTH axes to prevent snap =====
        if (wasEdgeDrivingRef.current && !isEdgeDriving) {
          const base = getDesktopCursorTargetBase(); // raw cursor-mapped (no remap)
          const curX = groupRef.current.rotation.x;
          const curY = groupRef.current.rotation.y;

          cursorRemapXRef.current = curX - base.x; // align pitch (x)
          cursorRemapYRef.current = curY - base.y; // align yaw   (y)
          remapArmedRef.current = true;
        }
        wasEdgeDrivingRef.current = isEdgeDriving;

        // ---- If cursor is inside an edge band, apply continuous rotation (velocity-based)
        if (isEdgeDriving) {
          // top = pitch DOWN; right = yaw LEFT
          const vx = ( edge.ny) * EDGE_MAX_PITCH_SPEED; // x-axis (pitch)
          const vy = (-edge.nx) * EDGE_MAX_YAW_SPEED;   // y-axis (yaw)

          groupRef.current.rotation.x += vx * delta;
          groupRef.current.rotation.y += vy * delta;

          // skip standard cursor-follow easing while edge-driving
          return;
        }

        // ---- Standard desktop cursor-follow (unchanged)
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

        const EASE = 0.10;
        groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * EASE;
        groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * EASE;
      } else {
        // touch inertia (unchanged)
        const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
        const zoomMul   = 0.9 + 0.8 * zf;
        const tabletMul = isTabletLike ? 1.6 : 1.25;
        const MOVING_BOOST_MIN = 0.10;
        const MOVING_BOOST_MAX = 0.30;
        const movingBoost = MOVING_BOOST_MIN + (MOVING_BOOST_MAX - MOVING_BOOST_MIN) * zf;
        const motionMul   = isMovingRef.current ? movingBoost : 1.0;

        const holdingTouch = isTouchRotatingRef.current && !isPinchingRef.current;
        if (!holdingTouch) {
          const k = Math.exp(-delta / ROT_RELEASE_TAU);
          spinVelRef.current.x *= k;
          spinVelRef.current.y *= k;
          if (Math.abs(spinVelRef.current.x) < ROT_MIN_SPEED) spinVelRef.current.x = 0;
          if (Math.abs(spinVelRef.current.y) < ROT_MIN_SPEED) spinVelRef.current.y = 0;
        }
        const mul = zoomMul * tabletMul * motionMul;
        groupRef.current.rotation.x += spinVelRef.current.x * delta * mul;
        groupRef.current.rotation.y += spinVelRef.current.y * delta * mul;
      }
    }
  }

  return {
    isPinchingRef,
    isTouchRotatingRef,
    getDesktopCursorTarget, 
    applyRotationFrame,
    notePossibleIdleExit,
    lastMouseMoveTsRef,
  };
}
