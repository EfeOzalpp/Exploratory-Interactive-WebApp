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
    maxRadius = params.bounds?.maxRadius ?? params.maxRadius ?? 800,
    dataCount = params.dataCount ?? (Array.isArray(params.data) ? params.data.length : 0),

    // idle config
    idle = {},
    // desktop threshold you liked (still read, but used to derive pivot)
    thresholds = { mobile: 60, tablet: 65, desktop: 70 },
  } = params;

  const {
    startOnLoad    = idle.startOnLoad ?? true,
    delayMs        = idle.delayMs ?? 1000,
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

  // pick the platform-specific threshold value you provided
  const THRESH = isSmallScreen
    ? thresholds.mobile
    : (isTabletLike ? thresholds.tablet : thresholds.desktop);

  // base camera distances
  const near = isSmallScreen ? 120 : 90;
  const far  = maxRadius;

  // ===== Saturating curve + cubic smoothstep (0..1) =====
  const K_RATIO = 0.6;                               // 0.5..0.7
  const K = Math.max(1, (THRESH || 70) * K_RATIO);   // pivot (~half-full)

  const BETA = 1.4;                                  // 1.3..1.8 for punchier mid

  const smooth = (s) => (s * s) * (3 - 2 * s);

  const rawFill = count / (count + K);               // 0..~1
  const curved  = Math.pow(rawFill, BETA);           // emphasize low/mid
  const fill    = smooth(Math.min(1, Math.max(0, curved)));

  const initialTargetComputed = Math.max(
    minRadius,
    Math.min(far, near + (far - near) * fill)
  );

  // ----- activity / idle helpers -----
  const { hasInteractedRef, lastActivityRef, markActivity, isIdle } =
    useActivity({ startOnLoad, delayMs });

  // Block idle when a tooltip is open
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
  const isIdleWrapped = ({
    userInteracting,
    hasInteractedRef: hiRef = hasInteractedRef,
    lastActivityRef: laRef = lastActivityRef
  }) => {
    if (hoverActiveRef.current) return false;
    return isIdle({ userInteracting, hasInteractedRef: hiRef, lastActivityRef: laRef });
  };

  // ----- zoom (wheel + pinch + spring) -----
  const { radius, zoomTargetRef, zoomVelRef, setZoomTarget } = useZoom({
    minRadius,
    maxRadius,
    initialTarget: initialTargetComputed,
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
  const getCursorEdgeDrift     = rot?.getCursorEdgeDrift     ?? (() => ({ active:false, vyaw:0, vpitch:0, strength:0 }));

  // ----- pixel-offset animation → group.position -----
  usePixelOffsets({ groupRef, camera, radius, xOffset, yOffset, xOffsetPx, yOffsetPx });

  // ----- idle drift (gated off during edge drift) -----
  const gatedIsIdle = ({ userInteracting, hasInteractedRef: hiRef, lastActivityRef: laRef }) => {
    const baseIdle = isIdleWrapped({ userInteracting, hasInteractedRef: hiRef, lastActivityRef: laRef });
    const edge = getCursorEdgeDrift();
    return baseIdle && !edge.active;
  };
  useIdleDrift({ groupRef, speed, horizontalOnly, isIdle: (args) => gatedIsIdle(args) });

  // ----- fast edge-drift driven by mouse near edges (desktop only) -----
  const EDGE_YAW_SPEED   = 1.2;  // rad/sec at full edge (horizontal)
  const EDGE_PITCH_SPEED = 0.6;  // rad/sec at full edge (vertical)
  const EDGE_ZOOM_GAIN   = 0.75; // extra gain with zoom out (0..1)

  useFrame((_, delta) => {
    if (!groupRef.current || !useDesktopLayout) return;
    const { active, vyaw, vpitch } = getCursorEdgeDrift();
    if (!active) return;

    const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
    const zoomMul = 1 + EDGE_ZOOM_GAIN * zf;

    groupRef.current.rotation.y += (EDGE_YAW_SPEED   * vyaw   * zoomMul) * delta;
    if (!horizontalOnly) {
      groupRef.current.rotation.x += (EDGE_PITCH_SPEED * vpitch * zoomMul) * delta;
    }
  });

  // ----- camera follow radius -----
  useFrame(() => {
    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
  });

  // ----- idle edge-detect handoff & rotation frame -----
  useFrame((_, delta) => {
    // Desktop rotates only on true drag/touch/pinch — plain hover doesn’t count.
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
