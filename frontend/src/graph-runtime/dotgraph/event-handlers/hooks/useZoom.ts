// src/graph-runtime/dotgraph/event-handlers/useZoom.ts
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';

export type GestureState = {
  pinching: boolean;
  touchCount: number;
  pinchCooldownUntil: number;
};

export type UseZoomParams = {
  minRadius: number;
  maxRadius: number;
  initialTarget?: number;
  markActivity?: () => void;
  gestureRef?: MutableRefObject<GestureState>;
};

export type UseZoomReturn = {
  radius: number;
  zoomTargetRef: MutableRefObject<number | null>;
  zoomVelRef: MutableRefObject<number>;
  setZoomTarget: (val: number) => void;
};

export default function useZoom({
  minRadius,
  maxRadius,
  initialTarget,
  markActivity,
  gestureRef,
}: UseZoomParams): UseZoomReturn {
  const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

  const [radius, setRadius] = useState(() => {
    return Number.isFinite(initialTarget)
      ? clamp(initialTarget as number, minRadius, maxRadius)
      : (minRadius + maxRadius) / 2;
  });

  const zoomTargetRef = useRef<number | null>(
    Number.isFinite(initialTarget) ? clamp(initialTarget as number, minRadius, maxRadius) : null
  );
  const zoomVelRef = useRef(0);

  // local pinch state
  const pinchCooldownRef = useRef(false);
  const pinchTimeoutRef = useRef<number | null>(null);
  const touchStartDistance = useRef<number | null>(null);

  useEffect(() => {
    const WHEEL_SENSITIVITY = 0.85;
    const CTRL_ZOOM_GAIN = 3.0;
    const PINCH_GAIN = 1.25;
    const PINCH_COOLDOWN_MS = 200;

    const ping = () => {
      if (typeof markActivity === 'function') markActivity();
    };

    const handleScroll = (event: WheelEvent) => {
      ping();
      const current = zoomTargetRef.current ?? radius;
      const gain = event.ctrlKey ? CTRL_ZOOM_GAIN : WHEEL_SENSITIVITY;
      // positive deltaY (wheel down) => zoom OUT (radius ↑)
      const next = clamp(current + event.deltaY * gain, minRadius, maxRadius);
      zoomTargetRef.current = next;
    };

    const handleTouchMove = (event: TouchEvent) => {
      // pinch zoom only (rotation is handled elsewhere)
      if (event.touches.length !== 2) return;
      if (pinchCooldownRef.current) return;

      ping();

      const [t1, t2] = [event.touches[0], event.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const current = zoomTargetRef.current ?? radius;

      if (touchStartDistance.current != null) {
        const pinchDelta = dist - touchStartDistance.current; // >0 when fingers move apart
        // Fingers apart => zoom IN => radius should DECREASE
        const next = clamp(current - pinchDelta * PINCH_GAIN, minRadius, maxRadius);
        zoomTargetRef.current = next;
      }
      touchStartDistance.current = dist;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        ping();
        const [t1, t2] = [event.touches[0], event.touches[1]];
        touchStartDistance.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        if (gestureRef?.current) {
          gestureRef.current.pinching = true;
          gestureRef.current.touchCount = 2;
        }
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      ping();

      const touches = event.touches.length;
      if (gestureRef?.current) gestureRef.current.touchCount = touches;

      // Leaving 2-finger state? end pinch and arm cooldown
      if (gestureRef?.current) {
        if (gestureRef.current.pinching && touches < 2) {
          gestureRef.current.pinching = false;
          gestureRef.current.pinchCooldownUntil = performance.now() + PINCH_COOLDOWN_MS;
        }
      }

      if (touches < 2) {
        if (pinchTimeoutRef.current) window.clearTimeout(pinchTimeoutRef.current);
        pinchTimeoutRef.current = window.setTimeout(() => {
          touchStartDistance.current = null;
        }, 120);

        pinchCooldownRef.current = true;
        window.setTimeout(() => (pinchCooldownRef.current = false), 160);
      }
    };

    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      if (pinchTimeoutRef.current) window.clearTimeout(pinchTimeoutRef.current);
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [minRadius, maxRadius, radius, markActivity, gestureRef]);

  // critically damped spring to target
  const ZOOM_OMEGA = 18.0;
  const ZOOM_SNAP_EPS = 0.0015;

  useFrame((_, delta) => {
    if (zoomTargetRef.current == null) return;

    const r = radius;
    const target = clamp(zoomTargetRef.current, minRadius, maxRadius);

    let v = zoomVelRef.current;
    const x = r - target;
    const a = -2 * ZOOM_OMEGA * v - ZOOM_OMEGA * ZOOM_OMEGA * x;

    v += a * delta;
    let next = r + v * delta;
    next = clamp(next, minRadius, maxRadius);

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
    zoomTargetRef,
    zoomVelRef,
    setZoomTarget: (val: number) => {
      zoomTargetRef.current = clamp(val, minRadius, maxRadius);
    },
  };
}
