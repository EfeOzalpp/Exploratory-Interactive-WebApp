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
  gestureRef, 

  // edge-drive info from useOrbit
  edgeDriveRef, // { current: { active, nx, ny, strength } }
}) {
  const { gl } = useThree(); // canvas element lives here

  const isPinchingRef      = useRef(false);
  const isTouchRotatingRef = useRef(false);
  const lastTouchRef       = useRef({ x: 0, y: 0, t: 0 });
  const spinVelRef         = useRef({ x: 0, y: 0 });

  // After pinch, ignore first 1-finger frame (until we reseed)
  const ignoreFirstSingleAfterPinchRef = useRef(false);

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

  // --- App activity gate: true only when the app/tab is focused and pointer is inside the OS window
  const appActiveRef = useRef(true);

  useEffect(() => {
    const recompute = () => {
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus?.() ?? true;
      appActiveRef.current = visible && focused;
    };

    // If pointer leaves **the OS window**, stop edge-drive immediately
    const onPointerOut = (e) => {
      // relatedTarget === null means it left the browser window
      if (e.relatedTarget === null) {
        appActiveRef.current = false;
      }
    };
    // When pointer re-enters the OS window, allow again (actual drive still depends on edgeDriveRef)
    const onPointerOver = () => {
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus?.() ?? true;
      appActiveRef.current = visible && focused;
    };

    const onBlur  = () => { appActiveRef.current = false; };
    const onFocus = () => { recompute(); };
    const onVis   = () => { recompute(); };

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
      if (gestureRef?.current) {
        gestureRef.current.touchCount = event.touches.length;
      }

      if (event.touches.length === 1) {
        const t = event.touches[0];
        holdSceneRef.current = isSceneTouchTarget(t.target);

        isTouchRotatingRef.current = true;
        isMovingRef.current = false;
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
        spinVelRef.current = { x: 0, y: 0 };

        // long-press logic unchanged...
        holdArmedRef.current = holdSceneRef.current;
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (holdArmedRef.current) {
          holdTimerRef.current = setTimeout(() => {
            if (holdArmedRef.current && holdSceneRef.current && !isPinchingRef.current && !(gestureRef?.current?.pinching)) {
              setLatched(!getLatched());
              window.dispatchEvent(new CustomEvent('gp:edge-hint-request', { detail: { source: 'long-press' } }));
              holdArmedRef.current = false;
            }
          }, HOLD_MS);
        }
      } else if (event.touches.length >= 2) {
        // entering multi-touch — rotation must not consume deltas
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };
        if (gestureRef?.current) {
          gestureRef.current.pinching = true;
        }
        // cancel long-press
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        holdArmedRef.current = false;
      }
    };

    const handleTouchMove = (event) => {
      event.preventDefault();
      if (isDraggingRef.current) return;
      markActivity?.();

      // --- HARD GATES ---
      const now = performance.now();
      const gs = gestureRef?.current;
      const inCooldown = gs ? now < (gs.pinchCooldownUntil || 0) : false;
      const multiTouch = (gs?.touchCount ?? event.touches.length) >= 2;
      const pinching = gs?.pinching || isPinchingRef.current;

      if (multiTouch || pinching) {
        // don’t rotate while pinching / multi-touch
        return;
      }

      if (inCooldown) {
        // We just left a pinch; reseed and ignore this frame’s delta to avoid a jump
        if (event.touches.length === 1) {
          const t = event.touches[0];
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
          ignoreFirstSingleAfterPinchRef.current = true;
        }
        return;
      }

      if (event.touches.length === 1) {
        const t   = event.touches[0];
        const now2 = performance.now();

        // If we’re consuming the first 1-finger frame after pinch, just seed and skip deltas
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
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
      }
    };

    const handleTouchEnd = (event) => {
      markActivity?.();

      if (gestureRef?.current) {
        gestureRef.current.touchCount = event.touches.length;
        // Leaving multi-touch? set pinch=false and arm cooldown (zoom does this too; either is fine)
        if (gestureRef.current.pinching && event.touches.length < 2) {
          gestureRef.current.pinching = false;
          // Only set if not already set by zoom; keep the later timestamp
          if ((gestureRef.current.pinchCooldownUntil || 0) < performance.now() + 200) {
            gestureRef.current.pinchCooldownUntil = performance.now() + 200;
          }
        }
      }

      if (event.touches.length === 0) {
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
      }
      if (event.touches.length < 2) {
        isPinchingRef.current = false;
      }

      // cancel long-press timer
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      holdArmedRef.current = false;
      holdSceneRef.current = false;
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

    if (wasIdleRef.current && !idleActive) {
      if (groupRef.current != null) {
        const currentY = groupRef.current.rotation.y;
        const { y: baseY } = getDesktopCursorTargetBase();
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

        // *** Gate edge-drive by app activity ***
        const appActive = appActiveRef.current;
        const isEdgeDriving = appActive && !!edge?.active;

        // Exit edge-drive → set remap to avoid snap on resume
        if (wasEdgeDrivingRef.current && !isEdgeDriving) {
          const base = getDesktopCursorTargetBase();
          const curX = groupRef.current.rotation.x;
          const curY = groupRef.current.rotation.y;
          cursorRemapXRef.current = curX - base.x;
          cursorRemapYRef.current = curY - base.y;
          remapArmedRef.current = true;
        }
        wasEdgeDrivingRef.current = isEdgeDriving;

        if (isEdgeDriving) {
          const vx = ( edge.ny) * EDGE_MAX_PITCH_SPEED;
          const vy = (-edge.nx) * EDGE_MAX_YAW_SPEED;
          groupRef.current.rotation.x += vx * delta;
          groupRef.current.rotation.y += vy * delta;
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

        // Zoom-aware easing (slower when zoomed in)
        const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
        const EASE_MIN = 0.06;
        const EASE_MAX = 0.12;
        const EASE = EASE_MIN + (EASE_MAX - EASE_MIN) * (1 - zf);

        groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * EASE;
        groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * EASE;
      } else {
        // touch inertia
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
