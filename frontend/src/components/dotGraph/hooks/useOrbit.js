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
  } = params;

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

  // unified zoom (spring target)
  const zoomTargetRef = useRef(null);
  const zoomVelRef    = useRef(0);

  // helper
  const isMovingRef = useRef(false);

  const count = useMemo(() => (typeof dataCount === 'number' ? dataCount : 0), [dataCount]);

  // starting zoom based on count
  useEffect(() => {
    const THRESH = 300;
    const near   = isSmallScreen ? 120 : 90;
    const far    = maxRadius;
    const tRaw   = Math.min(1, count / THRESH);
    const t      = 1 - Math.pow(1 - tRaw, 0.6);
    zoomTargetRef.current = Math.max(minRadius, Math.min(far, near + (far - near) * t));
  }, [count, isSmallScreen, minRadius, maxRadius]);

  // Inputs: wheel (zoom), mousemove (cursor-follow), touch (rotate & pinch)
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const DEADZONE_PX = 2.5 * dpr;
    const PX_TO_RAD   = (isTabletLike ? 0.0135 : 0.0125) / dpr; // sensitivity
    const LERP_GAIN   = 0.8;  // while held smoothing
    const FRICTION_WHILE_HELD = 1.0;

    const WHEEL_SENSITIVITY = 0.85;
    const CTRL_ZOOM_GAIN    = 3.0;
    const PINCH_GAIN        = 1.25;

    const lerp  = (a, b, t) => a + (b - a) * t;
    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

    const handleScroll = (event) => {
      const current = zoomTargetRef.current ?? radius;
      const gain = event.ctrlKey ? CTRL_ZOOM_GAIN : WHEEL_SENSITIVITY;
      const next = clamp(current - event.deltaY * gain, minRadius, maxRadius);
      zoomTargetRef.current = next;
    };

    const handleMouseMove = (event) => {
      const nx = (event.clientX / window.innerWidth)  * 2 - 1;   // -1..1
      const ny = -(event.clientY / window.innerHeight) * 2 + 1;  // -1..1 (top=+1)
      lastCursorPositionRef.current = { x: nx, y: ny };
    };

    // Touch
    const handleTouchStart = (event) => {
      if (event.touches.length === 1) {
        const t = event.touches[0];
        isTouchRotatingRef.current = true; // finger down → keep velocity alive
        isMovingRef.current = false;
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
      }
    };

    const handleTouchMove = (event) => {
      event.preventDefault();
      if (isDragging) return;

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

        const vx = (-dy / dt) * 1000 * PX_TO_RAD;
        const vy = (-dx / dt) * 1000 * PX_TO_RAD;

        const nextVx = lerp(spinVelRef.current.x * FRICTION_WHILE_HELD, vx, LERP_GAIN);
        const nextVy = lerp(spinVelRef.current.y * FRICTION_WHILE_HELD, vy, LERP_GAIN);
        spinVelRef.current = { x: nextVx, y: nextVy };

        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now };
      } else if (event.touches.length === 2) {
        if (pinchCooldownRef.current) return;

        isPinchingRef.current = true;
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };

        const [t1, t2] = event.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const clamp2 = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
        const current = zoomTargetRef.current ?? radius;
        if (touchStartDistance.current != null) {
          const pinchDelta = dist - touchStartDistance.current;
          const next = clamp2(current - pinchDelta * PINCH_GAIN, minRadius, maxRadius);
          zoomTargetRef.current = next;
        }
        touchStartDistance.current = dist;
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isTouchRotatingRef.current = false; // now allow decay
        isMovingRef.current = false;
        // keep spinVelRef → will decay after release for smoothness
      }
      if (e.touches.length < 2) {
        if (isPinchingRef.current) {
          clearTimeout(pinchTimeoutRef.current);
          pinchTimeoutRef.current = setTimeout(() => {
            isPinchingRef.current = false;
            touchStartDistance.current = null;
          }, 150);
        }
        pinchCooldownRef.current = true;
        setTimeout(() => (pinchCooldownRef.current = false), 200);
        touchStartDistance.current = null;
      }
    };

    window.addEventListener('wheel',      handleScroll,     { passive: true });
    window.addEventListener('mousemove',  handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove',  handleTouchMove,  { passive: false });
    window.addEventListener('touchend',   handleTouchEnd);

    return () => {
      window.removeEventListener('wheel',      handleScroll);
      window.removeEventListener('mousemove',  handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove',  handleTouchMove);
      window.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [isDragging, isSmallScreen, isTabletLike, minRadius, maxRadius, radius]);

  // reconcile drag offset (freeze while dragging)
  useEffect(() => {
    if (isDragging) {
      lastCursorPositionRef.current = {
        x: lastCursorPositionRef.current.x - (dragOffset.current?.x || 0),
        y: lastCursorPositionRef.current.y - (dragOffset.current?.y || 0),
      };
      dragStartRef.current = { ...lastCursorPositionRef.current };
    } else {
      dragEndRef.current = { ...lastCursorPositionRef.current };
      dragOffset.current = {
        x: dragEndRef.current.x - dragStartRef.current.x,
        y: dragEndRef.current.y - dragStartRef.current.y,
      };
    }
  }, [isDragging]);

  useFrame((_, delta) => {
    if (!isDragging && groupRef.current) {
      if (useDesktopLayout) {
        // Desktop: cursor-follow (smooth)
        const targetX =
          (lastCursorPositionRef.current.y - (dragOffset.current?.y || 0)) * Math.PI * 0.25;
        const targetY =
          (lastCursorPositionRef.current.x - (dragOffset.current?.x || 0)) * Math.PI * 0.5;

        const EASE = 0.10;
        groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * EASE;
        groupRef.current.rotation.y += (-(targetY) - groupRef.current.rotation.y) * EASE;
      } else {
        // Touch / tablet: velocity integration with zoom-based scaling
        const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
        const zoomMul   = 0.9 + 0.8 * zf;
        const tabletMul = isTabletLike ? 1.6 : 1.25;
        const MOVING_BOOST_MIN = 0.10;
        const MOVING_BOOST_MAX = 0.30;
        const movingBoost = MOVING_BOOST_MIN + (MOVING_BOOST_MAX - MOVING_BOOST_MIN) * zf;
        const motionMul   = isMovingRef.current ? movingBoost : 1.0;

        // 🔑 keep spinning indefinitely while a finger is held (no decay),
        // and only decay after release for smooth easing out.
        const holdingTouch = isTouchRotatingRef.current && !isPinchingRef.current;
        const DECAY = holdingTouch ? 1.0 : 0.92; // <- was 0.85 always; this was killing it

        spinVelRef.current.x *= DECAY;
        spinVelRef.current.y *= DECAY;

        const mul = zoomMul * tabletMul * motionMul;
        groupRef.current.rotation.x += spinVelRef.current.x * delta * mul;
        groupRef.current.rotation.y += spinVelRef.current.y * delta * mul;
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
      const now = performance.now();
      const rx = groupRef.current.rotation.x;
      const ry = groupRef.current.rotation.y;
      const d  = Math.abs(rx - lastRotEvtRef.current.x) + Math.abs(ry - lastRotEvtRef.current.y);
      if (d > 0.002 && (now - lastRotEvtRef.current.t) > 120) {
        lastRotEvtRef.current = { x: rx, y: ry, t: now };
        window.dispatchEvent(new CustomEvent(ROTATE_EVT, {
          detail: { rx, ry, source: useDesktopLayout ? 'desktop' : 'touch' }
        }));
      }
    }

    // spring zoom toward target
    if (zoomTargetRef.current != null) {
      const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
      const omega = 10.5; // smooth
      const r = radius;
      const target = clamp(zoomTargetRef.current, minRadius, maxRadius);
      let v = zoomVelRef.current;
      const x = r - target;
      const a = -2 * omega * v - omega * omega * x;
      v += a * delta;
      let next = r + v * delta;
      next = clamp(next, minRadius, maxRadius);

      if (Math.abs(next - r) > 0.0004) setRadius(next);
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
