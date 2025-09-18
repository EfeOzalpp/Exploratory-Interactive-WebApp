// src/components/dotGraph/hooks/useOrbit.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useDynamicOffset } from '../utils/dynamicOffset.ts';

export default function useOrbit(params = {}) {
  const ROTATE_EVT = 'gp:orbit-rot';

  const {
    isDragging = false,
    useDesktopLayout = params.layout?.useDesktopLayout ?? true,
    isSmallScreen   = params.layout?.isSmallScreen   ?? false,
    isTabletLike    = params.layout?.isTabletLike    ?? false,

    // world offsets (baseline)
    xOffset = params.layout?.xOffset ?? params.xOffset ?? 0,
    yOffset = params.layout?.yOffset ?? params.yOffset ?? 0,

    // pixel offsets (animated & converted to world; use for UI-driven shifts)
    xOffsetPx = params.layout?.xOffsetPx ?? params.xOffsetPx ?? 0,
    yOffsetPx = params.layout?.yOffsetPx ?? params.yOffsetPx ?? 0,

    minRadius = params.bounds?.minRadius ?? params.minRadius ?? (isSmallScreen ? 2 : 20),
    maxRadius = params.bounds?.maxRadius ?? params.maxRadius ?? 400,
    dataCount = params.dataCount ?? (Array.isArray(params.data) ? params.data.length : 0),

    // Idle drift options
    idle = {},
  } = params;

  const {
    startOnLoad   = idle.startOnLoad ?? true,   // drift on load until first interaction
    delayMs       = idle.delayMs ?? 10000,      // inactivity threshold
    speed         = idle.speed ?? 0.15,         // rad/s yaw
    horizontalOnly= idle.horizontalOnly ?? true // if false adds tiny pitch sway
  } = idle;

  const { camera } = useThree();
  const groupRef = useRef();

  // pixel-offset animation (~1s ease)
  const desiredPxRef = useRef({ x: xOffsetPx, y: yOffsetPx });
  const animPxRef    = useRef({ x: xOffsetPx, y: yOffsetPx });
  useEffect(() => { desiredPxRef.current = { x: xOffsetPx, y: yOffsetPx }; }, [xOffsetPx, yOffsetPx]);

  // rotation event throttle
  const lastRotEvtRef = useRef({ x: 0, y: 0, t: 0 });

  const [radius, setRadius] = useState(20);

  // --- Touch rotation (velocity model) ---
  const isPinchingRef       = useRef(false);
  const isTouchRotatingRef  = useRef(false); // true while at least one finger is down for rotate
  const lastTouchRef        = useRef({ x: 0, y: 0, t: 0 });
  const spinVelRef          = useRef({ x: 0, y: 0 }); // rad/s (touch)

  const pinchCooldownRef    = useRef(false);
  const pinchTimeoutRef     = useRef(null);
  const touchStartDistance  = useRef(null);

  // --- Desktop cursor-follow target & drag reconciliation ---
  const lastCursorPositionRef = useRef({ x: 0, y: 0 }); // -1..1
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragEndRef   = useRef({ x: 0, y: 0 });
  const dragOffset   = useRef({ x: 0, y: 0 });

  // --- Rotation handoff bias (idle → active) ---
  const rotBiasRef        = useRef({ x: 0, y: 0 }); // radians to add to cursor target
  const rotBiasDecayRef   = useRef(0);              // seconds remaining to decay
  const wasIdleRef        = useRef(false);          // previous idle state for edge detect

  // unified zoom (spring target)
  const zoomTargetRef = useRef(null);
  const zoomVelRef    = useRef(0);

  // helper
  const isMovingRef = useRef(false);

  // --- Idle bookkeeping ---
  const hasInteractedRef = useRef(false);           // flips true on first user interaction
  const lastActivityRef  = useRef(performance.now());
  const markActivity = () => {
    hasInteractedRef.current = true;
    lastActivityRef.current = performance.now();
  };

  // 🔧 NEW: mirror isDragging into a ref so handlers bound once can see updates
  const isDraggingRef = useRef(isDragging);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  const count = useMemo(() => (typeof dataCount === 'number' ? dataCount : 0), [dataCount]);

  // starting zoom based on count
  useEffect(() => {
    const thresholds = params.thresholds ?? { mobile: 150, tablet: 60, desktop: 300 };
    const THRESH = isSmallScreen ? thresholds.mobile : isTabletLike ? thresholds.tablet : thresholds.desktop;
    const near = isSmallScreen ? 120 : 90; // keep current near behavior
    const far  = maxRadius;
    const tRaw = Math.min(1, count / THRESH);
    const t    = 1 - Math.pow(1 - tRaw, 0.6); // gentle ease
    zoomTargetRef.current = Math.max(minRadius, Math.min(far, near + (far - near) * t));
  }, [count, isSmallScreen, isTabletLike, minRadius, maxRadius]);

  // Inputs: wheel (zoom), mousemove (cursor-follow), touch (rotate & pinch), keypress
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const DEADZONE_PX = 2.0 * dpr;
    const PX_TO_RAD   = (isTabletLike ? 0.009 : 0.005) / dpr; // sensitivity

    const WHEEL_SENSITIVITY = 0.85;
    const CTRL_ZOOM_GAIN    = 3.0;
    const PINCH_GAIN        = 1.25;

    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

    const handleScroll = (event) => {
      markActivity();
      const current = zoomTargetRef.current ?? radius;
      const gain = event.ctrlKey ? CTRL_ZOOM_GAIN : WHEEL_SENSITIVITY;
      const next = clamp(current - event.deltaY * gain, minRadius, maxRadius);
      zoomTargetRef.current = next;
    };

    const handleMouseMove = (event) => {
      markActivity();
      const nx = (event.clientX / window.innerWidth)  * 2 - 1;   // -1..1
      const ny = -(event.clientY / window.innerHeight) * 2 + 1;  // -1..1 (top=+1)
      lastCursorPositionRef.current = { x: nx, y: ny };
    };

    // Touch
    const handleTouchStart = (event) => {
      markActivity();
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
      event.preventDefault();
      // 🔧 use ref so drag-freeze works on mobile
      if (isDraggingRef.current) return;

      markActivity();

      // single-finger rotate
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

        // zero-latency: apply deltas directly to rotation
        if (groupRef.current) {
          groupRef.current.rotation.x += (-dy) * PX_TO_RAD;
          groupRef.current.rotation.y += (-dx) * PX_TO_RAD;
        }

        // instantaneous velocity for post-release inertia
        const vx = (-dy / dt) * 1000 * PX_TO_RAD;
        const vy = (-dx / dt) * 1000 * PX_TO_RAD;
        // small blend to smooth sensor noise, but no lag
        spinVelRef.current = {
          x: (spinVelRef.current.x + vx) * 0.5,
          y: (spinVelRef.current.y + vy) * 0.5,
        };

        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now };
      }
      // pinch zoom
      else if (event.touches.length === 2) {
        if (pinchCooldownRef.current) return;

        isPinchingRef.current = true;
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };

        const [t1, t2] = event.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const current = zoomTargetRef.current ?? radius;
        if (touchStartDistance.current != null) {
          const pinchDelta = dist - touchStartDistance.current;
          const next = clamp(current - pinchDelta * PINCH_GAIN, minRadius, maxRadius);
          zoomTargetRef.current = next;
        }
        touchStartDistance.current = dist;
      }
    };

    const handleTouchEnd = (e) => {
      markActivity();
      if (e.touches.length === 0) {
        isTouchRotatingRef.current = false; // allow velocity decay
        isMovingRef.current = false;
      }
      if (e.touches.length < 2) {
        if (isPinchingRef.current) {
          if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
          pinchTimeoutRef.current = setTimeout(() => {
            isPinchingRef.current = false;
            touchStartDistance.current = null;
          }, 120);
        }
        pinchCooldownRef.current = true;
        setTimeout(() => (pinchCooldownRef.current = false), 160);
        touchStartDistance.current = null;
      }
    };

    const handleKey = () => { markActivity(); };

    window.addEventListener('wheel',      handleScroll,     { passive: true });
    window.addEventListener('mousemove',  handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove',  handleTouchMove,  { passive: false });
    window.addEventListener('touchend',   handleTouchEnd);
    window.addEventListener('keydown',    handleKey);

    return () => {
      if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
      window.removeEventListener('wheel',      handleScroll);
      window.removeEventListener('mousemove',  handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove',  handleTouchMove);
      window.removeEventListener('touchend',   handleTouchEnd);
      window.removeEventListener('keydown',    handleKey);
    };
    // Bind once; use refs for changing values
  }, []); 

  // 🔧 Drag reconciliation:
  // - Keep as-is for desktop (cursor-follow UI needs it)
  // - Skip entirely on mobile/touch layouts per request (no delta-offset math)
  useEffect(() => {
    if (!useDesktopLayout) return; // <-- skip for mobile/tablet
    if (isDragging) {
      lastCursorPositionRef.current = {
        x: lastCursorPositionRef.current.x - (dragOffset.current?.x || 0),
        y: lastCursorPositionRef.current.y - (dragOffset.current?.y || 0),
      };
      dragStartRef.current = { ...lastCursorPositionRef.current };
      markActivity();
    } else {
      dragEndRef.current = { ...lastCursorPositionRef.current };
      dragOffset.current = {
        x: dragEndRef.current.x - dragStartRef.current.x,
        y: dragEndRef.current.y - dragStartRef.current.y,
      };
    }
  }, [isDragging, useDesktopLayout]);

  // Desktop target helper (mirrors desktop math)
  const getDesktopCursorTarget = () => {
    const tx =
      (lastCursorPositionRef.current.y - (dragOffset.current?.y || 0)) * Math.PI * 0.25;
    const ty =
      (lastCursorPositionRef.current.x - (dragOffset.current?.x || 0)) * Math.PI * 0.5;
    // y sign matches the easing below (no extra negation later)
    return { x: tx, y: -ty };
  };

  // ----- Tunables for snap/stop feel -----
  // Rotation inertia time-constant after release (seconds): smaller = stops faster
  const ROT_RELEASE_TAU = 0.09;
  const ROT_MIN_SPEED   = 0.02; // rad/s cutoff to zero tiny residuals

  // Zoom spring (critically damped): higher omega = faster to target
  const ZOOM_OMEGA      = 18.0;
  const ZOOM_SNAP_EPS   = 0.0015; // tighter snap to kill the last bit of coast

  useFrame((_, delta) => {
    const now = performance.now();

    const userInteracting =
      isDraggingRef.current || isTouchRotatingRef.current || isPinchingRef.current;

    const timeSinceActivity = now - lastActivityRef.current;

    // Idle is active on load (if enabled) or after delay with no interaction
    const idleActive =
      (!hasInteractedRef.current && startOnLoad && !userInteracting) ||
      (hasInteractedRef.current && !userInteracting && timeSinceActivity >= delayMs);

    // Edge-detect idle → active: capture rotation bias so there's no jump
    if (wasIdleRef.current && !idleActive) {
      if (useDesktopLayout && groupRef.current) {
        const tgt = getDesktopCursorTarget();
        rotBiasRef.current.x = groupRef.current.rotation.x - tgt.x;
        rotBiasRef.current.y = groupRef.current.rotation.y - tgt.y;
        rotBiasDecayRef.current = 0.25; // seconds to fade out bias
      } else {
        rotBiasRef.current.x = 0;
        rotBiasRef.current.y = 0;
        rotBiasDecayRef.current = 0;
      }
    }
    wasIdleRef.current = idleActive;

    if (!isDraggingRef.current && groupRef.current) {
      if (useDesktopLayout && !idleActive) {
        // Desktop: cursor-follow (smooth) + bias blending
        const { x: baseX, y: baseY } = getDesktopCursorTarget();

        // exponential decay of bias
        if (rotBiasDecayRef.current > 0) {
          const tau = 0.18; // smaller = faster fade
          const k = 1 - Math.exp(-delta / tau);
          rotBiasRef.current.x -= rotBiasRef.current.x * k;
          rotBiasRef.current.y -= rotBiasRef.current.y * k;
          rotBiasDecayRef.current = Math.max(0, rotBiasDecayRef.current - delta);
        } else {
          rotBiasRef.current.x = 0;
          rotBiasRef.current.y = 0;
        }

        const targetX = baseX + rotBiasRef.current.x;
        const targetY = baseY + rotBiasRef.current.y;

        const EASE = 0.10;
        groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * EASE;
        groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * EASE;
      } else if (!useDesktopLayout && !idleActive) {
        // Touch / tablet: inertia only (immediate motion is applied in handler)
        const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
        const zoomMul   = 0.9 + 0.8 * zf;
        const tabletMul = isTabletLike ? 1.6 : 1.25;
        const MOVING_BOOST_MIN = 0.10;
        const MOVING_BOOST_MAX = 0.30;
        const movingBoost = MOVING_BOOST_MIN + (MOVING_BOOST_MAX - MOVING_BOOST_MIN) * zf;
        const motionMul   = isMovingRef.current ? movingBoost : 1.0;

        // decay only after release, with fast time-constant
        const holdingTouch = isTouchRotatingRef.current && !isPinchingRef.current;
        if (!holdingTouch) {
          const k = Math.exp(-delta / ROT_RELEASE_TAU);
          spinVelRef.current.x *= k;
          spinVelRef.current.y *= k;

          // deadband to zero-out tiny velocities
          if (Math.abs(spinVelRef.current.x) < ROT_MIN_SPEED) spinVelRef.current.x = 0;
          if (Math.abs(spinVelRef.current.y) < ROT_MIN_SPEED) spinVelRef.current.y = 0;
        }

        const mul = zoomMul * tabletMul * motionMul;
        groupRef.current.rotation.x += spinVelRef.current.x * delta * mul;
        groupRef.current.rotation.y += spinVelRef.current.y * delta * mul;
      }

      // Idle drift (applied last). Keep bias neutral during idle.
      if (idleActive) {
        rotBiasRef.current.x = 0;
        rotBiasRef.current.y = 0;
        if (!horizontalOnly) {
          groupRef.current.rotation.x += (speed * 0.25) * delta;
        }
        groupRef.current.rotation.y += speed * delta;
      }
    }

    // Smooth pixel-offset animation (~1s settle) + apply position
    if (groupRef.current) {
      const targetPx = desiredPxRef.current;
      const anim = animPxRef.current;
      const alpha = 1 - Math.exp(-(delta || 0.016) / 0.25); // tau≈0.25s → ~1s to settle
      anim.x += (targetPx.x - anim.x) * alpha;
      anim.y += (targetPx.y - anim.y) * alpha;

      // px → world at current radius & FOV
      const W = window.innerWidth  || 1;
      const H = window.innerHeight || 1;
      const aspect = camera.aspect || (W / H);
      const fovRad = ((camera.fov ?? 50) * Math.PI) / 180;
      const worldPerPxY = (2 * Math.tan(fovRad / 2) * radius) / H;
      const worldPerPxX = worldPerPxY * aspect;

      const offX = xOffset + anim.x * worldPerPxX;
      const offY = yOffset + (-anim.y) * worldPerPxY; // +px down → -world Y
      groupRef.current.position.set(offX, offY, 0);
    }

    // rotation event (throttled)
    if (groupRef.current) {
      const now2 = performance.now();
      const rx = groupRef.current.rotation.x;
      const ry = groupRef.current.rotation.y;
      const d  = Math.abs(rx - lastRotEvtRef.current.x) + Math.abs(ry - lastRotEvtRef.current.y);
      if (d > 0.002 && (now2 - lastRotEvtRef.current.t) > 120) {
        lastRotEvtRef.current = { x: rx, y: ry, t: now2 };
        window.dispatchEvent(new CustomEvent(ROTATE_EVT, {
          detail: { rx, ry, source: useDesktopLayout ? 'desktop' : 'touch' }
        }));
      }
    }

    // ----- Faster zoom spring toward target -----
    if (zoomTargetRef.current != null) {
      const clamp2 = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
      const r = radius;
      const target = clamp2(zoomTargetRef.current, minRadius, maxRadius);

      // critically damped second-order system: a = -2*omega*v - omega^2 * x
      let v = zoomVelRef.current;
      const x = r - target;
      const a = -2 * ZOOM_OMEGA * v - (ZOOM_OMEGA * ZOOM_OMEGA) * x;

      v += a * delta;
      let next = r + v * delta;
      next = clamp2(next, minRadius, maxRadius);

      // tighter snap so it stops sooner
      if (Math.abs(next - r) > ZOOM_SNAP_EPS) setRadius(next);
      else {
        setRadius(target);
        v = 0;
        zoomTargetRef.current = null; // stop tiny oscillations
      }
      zoomVelRef.current = v;
    }

    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
  });

  // dynamic tooltip offset (zoom-blended)
  const dynamicOffset = useDynamicOffset();
  const isPortrait = typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
  const offsetBase = isPortrait ? 160 : 120;
  const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius)));
  const nonlinearLerp = (a, b, t) =>
    a + (b - a) * (1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 5));
  const tooltipOffsetPx = nonlinearLerp(
    offsetBase,
    Number.isFinite(dynamicOffset) ? dynamicOffset : 120,
    zf
  );

  return {
    groupRef,
    radius,
    isPinchingRef,
    isTouchRotatingRef,
    minRadius,
    maxRadius,
    tooltipOffsetPx,
  };
}
