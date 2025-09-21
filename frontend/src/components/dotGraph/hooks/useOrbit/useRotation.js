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
}) {
  const { gl } = useThree(); // canvas element lives here

  const isPinchingRef      = useRef(false);
  const isTouchRotatingRef = useRef(false);
  const lastTouchRef       = useRef({ x: 0, y: 0, t: 0 });
  const spinVelRef         = useRef({ x: 0, y: 0 });

  // desktop cursor-follow state
  const lastCursorPositionRef = useRef({ x: 0, y: 0 }); // -1..1 in canvas space
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragEndRef   = useRef({ x: 0, y: 0 });
  const dragOffset   = useRef({ x: 0, y: 0 });

  // recent mouse movement (idle gating)
  const lastMouseMoveTsRef = useRef(0);

  // bias (keep for other small blends if you use it elsewhere)
  const rotBiasRef      = useRef({ x: 0, y: 0 });
  const rotBiasDecayRef = useRef(0);

  // idle bookkeeping
  const wasIdleRef      = useRef(false);
  const idleEnterYawRef = useRef(null); // radians (for logs / debugging)

  const isMovingRef     = useRef(false);

  // Live mirror of isDragging for single-bound handlers & frames
  const isDraggingRef = useRef(!!isDragging);
  useEffect(() => { isDraggingRef.current = !!isDragging; }, [isDragging]);

  // Keep a live canvas rect so we can map window coords → canvas NDC even when UI overlaps
  const canvasRectRef = useRef({ left: 0, top: 0, width: 1, height: 1 });

  // === cursor→yaw remap to avoid snap on idle exit ===
  const cursorRemapYRef = useRef(0);       // radians
  const remapArmedRef   = useRef(false);   // for logs/clarity

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

    // --- Desktop/global pointer tracking (works even over other UI) ---
    const handlePointerMove = (event) => {
      const rect = canvasRectRef.current; // canvas rect in page space
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      lastCursorPositionRef.current = { x: nx, y: ny };
      lastMouseMoveTsRef.current = performance.now();
      markActivity?.();
    };

    // --- Touch handlers (rotate/pinch) ---
    const handleTouchStart = (event) => {
      markActivity?.();
      if (event.touches.length === 1) {
        const t = event.touches[0];
        isTouchRotatingRef.current = true;
        isMovingRef.current = false;
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
        // kill residual spin for immediate control
        spinVelRef.current = { x: 0, y: 0 };
      }
    };

    const handleTouchMove = (event) => {
      // rotate on single-finger drag; prevent default so page doesn't scroll
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
      }
    };

    const handleTouchEnd = (e) => {
      markActivity?.();
      if (e.touches.length === 0) {
        isTouchRotatingRef.current = false; // allow velocity decay
        isMovingRef.current = false;
      }
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
    };

    // Bind to window so we keep tracking over any overlay/UI
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchstart',  handleTouchStart,  { passive: false });
    window.addEventListener('touchmove',   handleTouchMove,   { passive: false });
    window.addEventListener('touchend',    handleTouchEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchstart',  handleTouchStart);
      window.removeEventListener('touchmove',   handleTouchMove);
      window.removeEventListener('touchend',    handleTouchEnd);
    };
  }, [isTabletLike, groupRef, markActivity]);

  // desktop drag reconciliation (so orbit doesn't jump after UI drag)
  useEffect(() => {
    if (!useDesktopLayout) return;
    if (isDragging) {
      // capture a neutralized "start" position (subtract existing offset)
      lastCursorPositionRef.current = {
        x: lastCursorPositionRef.current.x - (dragOffset.current?.x || 0),
        y: lastCursorPositionRef.current.y - (dragOffset.current?.y || 0),
      };
      dragStartRef.current = { ...lastCursorPositionRef.current };
      markActivity?.();
    } else {
      // when drag ends, compute how far the cursor moved during the UI drag
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

  // wrapper that applies our cursor→yaw remap (no snap on idle exit)
  const getDesktopCursorTarget = () => {
    const base = getDesktopCursorTargetBase();
    const yRemapped = base.y + (cursorRemapYRef.current || 0);
    return { x: base.x, y: yRemapped };
  };

  // ----- edge drift detection (desktop) -----
  // Outer 10% band at each edge; tweakable via EDGE_BAND.
  const EDGE_BAND = 0.10;
  const bandAmount = (v) => {
    const a = Math.abs(v);
    const start = 1 - EDGE_BAND;
    if (a <= start) return 0;
    return Math.min(1, (a - start) / EDGE_BAND); // 0..1
  };

  const getCursorEdgeDrift = () => {
    if (!useDesktopLayout) return { active: false, vyaw: 0, vpitch: 0, strength: 0 };
    const { x: nx, y: ny } = lastCursorPositionRef.current; // -1..1
    const ax = bandAmount(nx);
    const ay = bandAmount(ny);
    const active = ax > 0 || ay > 0;

    // Horizontal edges → yaw (rotate around Y): left -, right +
    // Vertical edges   → pitch (rotate around X): top +, bottom -
    const vyaw   = ax * Math.sign(nx);      // -1..1 scaled by edge proximity
    const vpitch = ay * -Math.sign(ny);     // invert so top moves up

    return { active, vyaw, vpitch, strength: Math.max(ax, ay) };
  };

  // ----- Idle transition with remap set on exit -----
  function notePossibleIdleExit(idleActive) {
    // ENTER idle
    if (!wasIdleRef.current && idleActive) {
      if (groupRef.current) {
        idleEnterYawRef.current = groupRef.current.rotation.y;
        // reset decay bias; we rely on remap on exit
        rotBiasRef.current.x = 0;
        rotBiasRef.current.y = 0;
        rotBiasDecayRef.current = 0;
        // console.log("[Idle Enter] yaw =", rad2deg(idleEnterYawRef.current).toFixed(2), "deg");
      } else {
        idleEnterYawRef.current = null;
      }
    }

    // EXIT idle
    if (wasIdleRef.current && !idleActive) {
      if (groupRef.current != null) {
        const currentY = groupRef.current.rotation.y;          // scene yaw now (rad)
        const { y: baseY } = getDesktopCursorTargetBase();     // raw cursor-mapped yaw (no remap)
        const remapY = currentY - baseY;
        cursorRemapYRef.current = remapY;
        remapArmedRef.current = true;
        // console.log("[Idle Exit] remapY=", rad2deg(remapY).toFixed(2), "deg");
      }
      idleEnterYawRef.current = null;
    }

    wasIdleRef.current = idleActive;
  }

  // (optional) debug: log remapped target occasionally
  useFrame(() => {
    if (!useDesktopLayout || !groupRef.current) return;
    if (remapArmedRef.current) {
      if (!useFrame._lastLog || performance.now() - useFrame._lastLog > 500) {
        const { y } = getDesktopCursorTarget();
        // console.log("[Remap] targetY=", rad2deg(y).toFixed(2), "deg");
        useFrame._lastLog = performance.now();
      }
    }
  });

  // frame application
  const ROT_RELEASE_TAU = 0.09;
  const ROT_MIN_SPEED   = 0.02;

  function applyRotationFrame({ idleActive, delta }) {
    if (!groupRef.current) return;

    // 🔒 Freeze rotation while dragging external UI, but still track pointer via window
    if (isDraggingRef.current) return;

    if (!idleActive) {
      if (useDesktopLayout) {
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
    getCursorEdgeDrift,         
  };
}
