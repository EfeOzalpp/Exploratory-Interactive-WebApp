import { useMemo, useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

import useActivity from './useActivity.js';
import useZoom from './useZoom.js';
import useRotation from './useRotation.js';
import useIdleDrift from './useIdleDrift.js';
import usePixelOffsets from './usePixelOffsets.js';

import { useDynamicOffset } from '../../utils/dynamicOffset.ts';

export default function useOrbit(params = {}) {
  const ROTATE_EVT = 'gp:orbit-rot';

  const {
    // layout
    isDragging = false,
    useDesktopLayout = params.layout?.useDesktopLayout ?? true,
    isSmallScreen   = params.layout?.isSmallScreen   ?? false,
    isTabletLike    = params.layout?.isTabletLike    ?? false,

    // world offsets
    xOffset = params.layout?.xOffset ?? params.xOffset ?? 0,
    yOffset = params.layout?.yOffset ?? params.yOffset ?? 0,

    // pixel offsets
    xOffsetPx = params.layout?.xOffsetPx ?? params.xOffsetPx ?? 0,
    yOffsetPx = params.layout?.yOffsetPx ?? params.yOffsetPx ?? 0,

    // bounds & data
    minRadius = params.bounds?.minRadius ?? params.minRadius ?? (isSmallScreen ? 2 : 20),
    maxRadius = params.bounds?.maxRadius ?? params.maxRadius ?? 400,
    dataCount = params.dataCount ?? (Array.isArray(params.data) ? params.data.length : 0),

    // idle config
    idle = {},
    thresholds = { mobile: 150, tablet: 60, desktop: 300 },
  } = params;

  const {
    startOnLoad    = idle.startOnLoad ?? true,
    delayMs        = idle.delayMs ?? 1000,     // <- your 1s setting
    speed          = idle.speed ?? 0.15,
    horizontalOnly = idle.horizontalOnly ?? true,
  } = idle;

  const { camera } = useThree();
  const groupRef = useRef();

  // ----- initial zoom target from data count -----
  const count = useMemo(
    () => (typeof dataCount === 'number' ? dataCount : 0),
    [dataCount]
  );
  const THRESH = isSmallScreen ? thresholds.mobile : (isTabletLike ? thresholds.tablet : thresholds.desktop);
  const near = isSmallScreen ? 120 : 90;
  const far  = maxRadius;

  // ----- activity / idle helpers -----
  const { hasInteractedRef, lastActivityRef, markActivity, isIdle } =
    useActivity({ startOnLoad, delayMs });

  // 🔒 Block idle when a tooltip is open
  const hoverActiveRef = useRef(false);
  useEffect(() => {
    const onOpen = () => { hoverActiveRef.current = true; };
    const onClose = () => { hoverActiveRef.current = false; };
    window.addEventListener('gp:hover-open', onOpen);
    window.addEventListener('gp:hover-close', onClose);
    return () => {
      window.removeEventListener('gp:hover-open', onOpen);
      window.removeEventListener('gp:hover-close', onClose);
    };
  }, []);

  // Wrap base isIdle to include hover gating
  const isIdleWrapped = ({ userInteracting, hasInteractedRef: hiRef = hasInteractedRef, lastActivityRef: laRef = lastActivityRef }) => {
    if (hoverActiveRef.current) return false;
    return isIdle({ userInteracting, hasInteractedRef: hiRef, lastActivityRef: laRef });
  };

  // ----- zoom (wheel + pinch + spring) -----
  const { radius, zoomTargetRef, zoomVelRef, setZoomTarget } = useZoom({
    minRadius,
    maxRadius,
    initialTarget: (() => {
      const tRaw = Math.min(1, count / THRESH);
      const t    = 1 - Math.pow(1 - tRaw, 0.6);
      return Math.max(minRadius, Math.min(far, near + (far - near) * t));
    })(),
    markActivity,
  });

  // ----- rotation (desktop drag-only + touch inertia) -----
  const rot = useRotation({
    groupRef,
    useDesktopLayout,
    isTabletLike,
    minRadius,
    maxRadius,
    radius,
    markActivity,
    isDragging,
  });

  // Safe fallbacks
  const isPinchingRef          = rot?.isPinchingRef          ?? { current: false };
  const isTouchRotatingRef     = rot?.isTouchRotatingRef     ?? { current: false };
  const lastMouseMoveTsRef     = rot?.lastMouseMoveTsRef     ?? { current: 0 };
  const effectiveDraggingRef   = rot?.effectiveDraggingRef    ?? { current: false };
  const getDesktopCursorTarget = rot?.getDesktopCursorTarget ?? (() => ({ x: 0, y: 0 }));
  const applyRotationFrame     = rot?.applyRotationFrame     ?? (() => {});
  const notePossibleIdleExit   = rot?.notePossibleIdleExit   ?? (() => {});

  // ----- pixel-offset animation → group.position -----
  usePixelOffsets({ groupRef, camera, radius, xOffset, yOffset, xOffsetPx, yOffsetPx });

  // ----- idle drift (separate & tiny) -----
  // Use the wrapped idle predicate so drift never runs when a tooltip is up
  useIdleDrift({ groupRef, speed, horizontalOnly, isIdle: isIdleWrapped });

  // ----- camera follow radius -----
  useFrame(() => {
    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
  });

  // ----- idle edge-detect handoff & rotation frame -----
  useFrame((_, delta) => {
    // We do NOT consider plain hover as interaction. Desktop rotates only on true drag.
    const userInteracting =
      effectiveDraggingRef.current || isTouchRotatingRef.current || isPinchingRef.current;

    const idleActive = isIdleWrapped({ userInteracting, hasInteractedRef, lastActivityRef });
    notePossibleIdleExit(idleActive);
    applyRotationFrame({ idleActive, delta });
  });

  // ----- rotation event (throttled for listeners like tooltips) -----
  const lastRotEvtRef = useRef({ x: 0, y: 0, t: 0 });
  useFrame(() => {
    if (!groupRef.current) return;
    const now2 = performance.now();
    const rx = groupRef.current.rotation.x;
    const ry = groupRef.current.rotation.y;
    const d  = Math.abs(rx - lastRotEvtRef.current.x) + Math.abs(ry - lastRotEvtRef.current.y);
    if (d > 0.002 && (now2 - lastRotEvtRef.current.t) > 120) {
      lastRotEvtRef.current = { x: rx, y: ry, t: now2 };
      window.dispatchEvent(
        new CustomEvent(ROTATE_EVT, {
          detail: { rx, ry, source: useDesktopLayout ? 'desktop' : 'touch' },
        })
      );
    }
  });

  // ----- tooltip offset (zoom-blended) -----
  const dynamicOffset = useDynamicOffset();
  const isPortrait =
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
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
    setZoomTarget,
    zoomTargetRef,
  };
}
