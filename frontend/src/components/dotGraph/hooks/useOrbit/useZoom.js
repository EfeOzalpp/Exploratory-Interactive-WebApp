import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

export default function useZoom({
  minRadius,
  maxRadius,
  initialTarget,      // optional starting target (number)
  markActivity,       // optional callback from useActivity
}) {
  const [radius, setRadius] = useState(
    Number.isFinite(initialTarget)
      ? Math.max(minRadius, Math.min(maxRadius, initialTarget))
      : (minRadius + maxRadius) / 2
  );

  // public refs (expected by orchestrator)
  const zoomTargetRef = useRef(
    Number.isFinite(initialTarget)
      ? Math.max(minRadius, Math.min(maxRadius, initialTarget))
      : null
  );
  const zoomVelRef = useRef(0);

  // local pinch state
  const pinchCooldownRef   = useRef(false);
  const pinchTimeoutRef    = useRef(null);
  const touchStartDistance = useRef(null);

  useEffect(() => {
    const WHEEL_SENSITIVITY = 0.85;
    const CTRL_ZOOM_GAIN    = 3.0;
    const PINCH_GAIN        = 1.25;

    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
    const ping  = () => { if (typeof markActivity === 'function') markActivity(); };

    const handleScroll = (event) => {
      ping();
      const current = zoomTargetRef.current ?? radius;
      const gain = event.ctrlKey ? CTRL_ZOOM_GAIN : WHEEL_SENSITIVITY;
      // positive deltaY (wheel down) => zoom OUT (radius ↑)
      const next = clamp(current + event.deltaY * gain, minRadius, maxRadius);
      zoomTargetRef.current = next;
    };

    const handleTouchMove = (event) => {
      // pinch zoom only (rotation is handled elsewhere)
      if (event.touches.length !== 2) return;
      if (pinchCooldownRef.current) return;

      ping();

      const [t1, t2] = event.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const current = zoomTargetRef.current ?? radius;

      if (touchStartDistance.current != null) {
        const pinchDelta = dist - touchStartDistance.current; // pinch out => +
        const next = clamp(current + pinchDelta * PINCH_GAIN, minRadius, maxRadius);
        zoomTargetRef.current = next;
      }
      touchStartDistance.current = dist;
    };

    const handleTouchStart = (event) => {
      if (event.touches.length === 2) {
        ping();
        // initialize touchStartDistance to avoid first-frame jump
        const [t1, t2] = event.touches;
        touchStartDistance.current = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY
        );
      }
    };

    const handleTouchEnd = (event) => {
      ping();
      if (event.touches.length < 2) {
        if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
        pinchTimeoutRef.current = setTimeout(() => {
          touchStartDistance.current = null;
        }, 120);
        pinchCooldownRef.current = true;
        setTimeout(() => (pinchCooldownRef.current = false), 160);
      }
    };

    window.addEventListener('wheel',      handleScroll,     { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove',  handleTouchMove,  { passive: false });
    window.addEventListener('touchend',   handleTouchEnd);

    return () => {
      if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
      window.removeEventListener('wheel',      handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove',  handleTouchMove);
      window.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [minRadius, maxRadius, radius, markActivity]);

  // critically damped spring to target
  const ZOOM_OMEGA    = 18.0;
  const ZOOM_SNAP_EPS = 0.0015;

  useFrame((_, delta) => {
    if (zoomTargetRef.current == null) return;

    const clamp2 = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
    const r = radius;
    const target = clamp2(zoomTargetRef.current, minRadius, maxRadius);

    let v = zoomVelRef.current;
    const x = r - target;
    const a = -2 * ZOOM_OMEGA * v - (ZOOM_OMEGA * ZOOM_OMEGA) * x;

    v += a * delta;
    let next = r + v * delta;
    next = clamp2(next, minRadius, maxRadius);

    // anti-rebound at bounds
    if (next === maxRadius && v < 0) v = 0;
    if (next === minRadius && v > 0) v = 0;

    if (Math.abs(next - r) > ZOOM_SNAP_EPS) {
      setRadius(next);
    } else {
      setRadius(target);
      v = 0;
      zoomTargetRef.current = null; // stop tiny oscillations
    }
    zoomVelRef.current = v;
  });

  return {
    radius,
    zoomTargetRef,                // <- provided for orchestrator / external reads
    zoomVelRef,                   // <- provided for orchestrator if needed
    setZoomTarget: (val) => {
      const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
      zoomTargetRef.current = clamp(val, minRadius, maxRadius);
    },
  };
}
