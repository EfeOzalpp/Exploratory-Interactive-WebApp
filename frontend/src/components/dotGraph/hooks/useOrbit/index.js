// src/hooks/orbit/useOrbit.js
import { useMemo, useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

import useActivity from './useActivity.js';
import useZoom from './useZoom.js';
import useRotation from './useRotation.js';
import useIdleDrift from './useIdleDrift.js';
import usePixelOffsets from './usePixelOffsets.js';
import { useDynamicOffset } from '../../utils/dynamicOffset.ts';
import { createGestureState } from './sharedGesture.ts';

export default function useOrbit(params = {}) {
  const ROTATE_EVT = 'gp:orbit-rot';
  const MENU_EVT   = 'gp:menu-open'; // listen for InfoPanel open/close

  const {
    isDragging = false,
    useDesktopLayout = params.layout?.useDesktopLayout ?? true,
    isSmallScreen   = params.layout?.isSmallScreen   ?? false,
    isTabletLike    = params.layout?.isTabletLike    ?? false,

    xOffset = params.layout?.xOffset ?? params.xOffset ?? 0,
    yOffset = params.layout?.yOffset ?? params.yOffset ?? 0,

    xOffsetPx = params.layout?.xOffsetPx ?? params.xOffsetPx ?? 0,
    yOffsetPx = params.layout?.yOffsetPx ?? params.yOffsetPx ?? 0,

    minRadius = params.bounds?.minRadius ?? params.minRadius ?? (isSmallScreen ? 2 : 20),
    maxRadius = params.bounds?.maxRadius ?? params.maxRadius ?? 800,
    dataCount = params.dataCount ?? (Array.isArray(params.data) ? params.data.length : 0),

    idle = {},
    thresholds = { mobile: 60, tablet: 65, desktop: 90 },
  } = params;

  const {
    startOnLoad    = idle.startOnLoad ?? true,
    delayMs        = idle.delayMs ?? 2000,
    speed          = idle.speed ?? 0.15,
    horizontalOnly = idle.horizontalOnly ?? true,
  } = idle;

  const { camera } = useThree();
  const groupRef = useRef();

  const gestureRef = useRef(createGestureState());

  // Track InfoPanel open/close (from InfoPanel → window.dispatchEvent('gp:menu-open', { detail: { open } }))
  const menuOpenRef = useRef(false);
  useEffect(() => {
    const onMenu = (e) => { menuOpenRef.current = !!e?.detail?.open; };
    window.addEventListener(MENU_EVT, onMenu);
    return () => window.removeEventListener(MENU_EVT, onMenu);
  }, []);

  // ----- initial zoom target from data count -----
  const count = useMemo(() => (typeof dataCount === 'number' ? dataCount : 0), [dataCount]);
  const THRESH = isSmallScreen ? thresholds.mobile : (isTabletLike ? thresholds.tablet : thresholds.desktop);
  const near = isSmallScreen ? 120 : 90;
  const far  = maxRadius;

  const K_RATIO = 0.6;
  const K = Math.max(1, (THRESH || 70) * K_RATIO);
  const BETA = 1.4;
  const smooth = (s) => (s * s) * (3 - 2 * s);
  const rawFill = count / (count + K);
  const curved  = Math.pow(rawFill, BETA);
  const fill    = smooth(Math.min(1, Math.max(0, curved)));
  const initialTargetComputed = Math.max(minRadius, Math.min(far, near + (far - near) * fill));

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

  // === Desktop edge bands ===
  const edgeHotzoneRef = useRef(false);
  const edgeDriveRef = useRef({ active: false, nx: 0, ny: 0, strength: 0 });

  // HUD state we expose/broadcast
  const edgeCueRef = useRef({ visible: false, mode: 'off', insetX: 0, insetY: 0, pinned: false });

  // Pinning
  const edgeCuePinnedRef = useRef(false);
  const edgeCueLastModeRef = useRef('off');

  // last desktop mode (for rising-edge)
  const lastDesktopModeRef = useRef('off');

  // Gating for unwanted first flip:
  const firstPointerSeenRef = useRef(false);
  const hasSeenNonEdgeRef = useRef(false);

  // --- canonical latched state broadcaster ---
  const lastBroadcastRef = useRef(edgeCueRef.current);
  const broadcastEdgeCue = (next) => {
    const prev = lastBroadcastRef.current;
    if (
      !prev ||
      prev.visible !== next.visible ||
      prev.mode !== next.mode ||
      prev.insetX !== next.insetX ||
      prev.insetY !== next.insetY ||
      prev.pinned  !== next.pinned
    ) {
      lastBroadcastRef.current = next;
      window.dispatchEvent(new CustomEvent('gp:edge-cue', { detail: next }));
    }
  };

  const broadcastLatchedState = (latched) => {
    window.__gpEdgeLatched = !!latched;
    window.dispatchEvent(new CustomEvent('gp:edge-cue-state', { detail: { latched: !!latched } }));
  };

  // Initialize canonical latched once (SSR-safe default true if unset)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__gpEdgeLatched == null) {
      window.__gpEdgeLatched = true; // LIGHT by default
    }
    broadcastLatchedState(window.__gpEdgeLatched);
  }, []);

  // Toggle pin (from HUD click OR mobile long-press)
  useEffect(() => {
    const onToggle = () => {
      if (menuOpenRef.current) return; // ignore toggles while menu open
      if (!useDesktopLayout) {
        edgeCuePinnedRef.current = !edgeCuePinnedRef.current;
        const next = { visible: edgeCuePinnedRef.current, mode: edgeCuePinnedRef.current ? 'in' : 'off', insetX: 0, insetY: 0, pinned: edgeCuePinnedRef.current };
        edgeCueLastModeRef.current = next.mode;
        edgeCueRef.current = next;
        broadcastEdgeCue(next);
        broadcastLatchedState(!Boolean(window.__gpEdgeLatched));
        hasSeenNonEdgeRef.current = false;
        return;
      }

      const currentlyVisible = edgeCueRef.current?.visible || edgeCuePinnedRef.current;
      if (!currentlyVisible) return;

      edgeCuePinnedRef.current = !edgeCuePinnedRef.current;

      if (!edgeCuePinnedRef.current) {
        const offPinned = { ...edgeCueRef.current, pinned: false };
        edgeCueRef.current = offPinned;
        broadcastEdgeCue(offPinned);
      } else {
        const modeToUse = edgeCueRef.current.mode === 'off'
          ? (edgeCueLastModeRef.current === 'off' ? 'in' : edgeCueLastModeRef.current)
          : edgeCueRef.current.mode;
        const snap = { ...edgeCueRef.current, visible: true, pinned: true, mode: modeToUse };
        edgeCueLastModeRef.current = modeToUse;
        edgeCueRef.current = snap;
        broadcastEdgeCue(snap);
      }
      broadcastLatchedState(!Boolean(window.__gpEdgeLatched));
      hasSeenNonEdgeRef.current = false;
    };

    window.addEventListener('gp:edge-cue-toggle', onToggle);
    return () => window.removeEventListener('gp:edge-cue-toggle', onToggle);
  }, [useDesktopLayout]);

  // Desktop-only pointer bands that drive edge cue live state
  useEffect(() => {
    if (!useDesktopLayout) {
      const off = { visible: false, mode: 'off', insetX: 0, insetY: 0, pinned: false };
      edgeCuePinnedRef.current = false;
      edgeCueRef.current = off;
      broadcastEdgeCue(off);
      return;
    }

    const onPointerMove = (e) => {
      // While info panel is open, force edge-drive off and stop cues
      if (menuOpenRef.current) {
        edgeHotzoneRef.current = false;
        edgeDriveRef.current = { active: false, nx: 0, ny: 0, strength: 0 };
        if (!edgeCuePinnedRef.current) {
          const off = { visible: false, mode: 'off', insetX: 0, insetY: 0, pinned: false };
          edgeCueRef.current = off;
          broadcastEdgeCue(off);
        }
        return;
      }

      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      if (w === 0 || h === 0) {
        edgeHotzoneRef.current = false;
        edgeDriveRef.current = { active: false, nx: 0, ny: 0, strength: 0 };
        if (!edgeCuePinnedRef.current) {
          const off = { visible: false, mode: 'off', insetX: 0, insetY: 0, pinned: false };
          edgeCueRef.current = off;
          broadcastEdgeCue(off);
        }
        return;
      }

      const x = e.clientX, y = e.clientY;
      const insetX = 240, insetY = 80;
      const NEAR_MARGIN_PX = 40;
      const nearInsetX = insetX + NEAR_MARGIN_PX;
      const nearInsetY = insetY + NEAR_MARGIN_PX;

      const CENTER_GAP_START = w * 0.38;
      const CENTER_GAP_END   = w * 0.62;
      const inCenterGapX = x >= CENTER_GAP_START && x <= CENTER_GAP_END;

      const nx = (x / w) * 2 - 1;
      const ny = -((y / h) * 2 - 1);

      let sx = 0;
      if (x < insetX)                sx = (insetX - x) / insetX;
      else if (x > (w - insetX))     sx = (x - (w - insetX)) / insetX;

      let syTop = 0, syBot = 0;
      if (!inCenterGapX) {
        if (y < insetY)            syTop = (insetY - y) / insetY;
        else if (y > (h - insetY)) syBot = (y - (h - insetY)) / insetY;
      }
      const sy = Math.max(syTop, syBot);

      const strength = Math.max(sx, sy);
      const inEdge = strength > 0;

      const nearTop    = !inCenterGapX && y < nearInsetY;
      const nearBottom = !inCenterGapX && y > (h - nearInsetY);
      const nearLeft   = x < nearInsetX;
      const nearRight  = x > (w - nearInsetX);
      const nearEdge = !inEdge && (nearTop || nearBottom || nearLeft || nearRight);

      edgeHotzoneRef.current = inEdge;
      edgeDriveRef.current = inEdge
        ? { active: true, nx, ny, strength: Math.min(1, Math.max(0, strength)) }
        : { active: false, nx: 0, ny: 0, strength: 0 };

      const candidate = {
        visible: inEdge || nearEdge,
        mode: inEdge ? 'in' : (nearEdge ? 'near' : 'off'),
        insetX, insetY, pinned: edgeCuePinnedRef.current,
      };

      let finalCue = candidate;
      if (edgeCuePinnedRef.current) {
        const modeToUse = candidate.mode === 'off'
          ? (edgeCueLastModeRef.current || 'in')
          : candidate.mode;
        edgeCueLastModeRef.current = modeToUse;
        finalCue = { ...candidate, visible: true, mode: 'in', pinned: true };
      } else {
        edgeCueLastModeRef.current = candidate.mode;
      }

      if (!firstPointerSeenRef.current) {
        firstPointerSeenRef.current = true;
        lastDesktopModeRef.current = finalCue.mode;
        hasSeenNonEdgeRef.current = finalCue.mode !== 'in';
        edgeCueRef.current = finalCue;
        broadcastEdgeCue(finalCue);
        return;
      }

      if (finalCue.mode !== 'in') hasSeenNonEdgeRef.current = true;

      const prevMode = lastDesktopModeRef.current || 'off';
      const risingIn = finalCue.mode === 'in' && prevMode !== 'in' && hasSeenNonEdgeRef.current;

      lastDesktopModeRef.current = finalCue.mode;
      edgeCueRef.current = finalCue;

      if (risingIn) {
        broadcastLatchedState(!Boolean(window.__gpEdgeLatched));
        hasSeenNonEdgeRef.current = false;
      }

      broadcastEdgeCue(finalCue);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [useDesktopLayout]);

  // idle wrapper
  const isIdleWrapped = ({
    userInteracting,
    hasInteractedRef: hiRef = hasInteractedRef,
    lastActivityRef: laRef = lastActivityRef
  }) => {
    if (hoverActiveRef.current) return false;
    if (menuOpenRef.current) return false; // treat as active while panel open
    if (useDesktopLayout && edgeHotzoneRef.current) return false;
    return isIdle({ userInteracting, hasInteractedRef: hiRef, lastActivityRef: laRef });
  };

  // ----- zoom -----
  const { radius, zoomTargetRef, zoomVelRef, setZoomTarget } = useZoom({
    minRadius, maxRadius, initialTarget: initialTargetComputed, markActivity, gestureRef,
  });

  // ----- rotation -----
  const rot = useRotation({
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
    menuOpenRef, // pass the panel gate down
  });

  const isPinchingRef          = rot?.isPinchingRef          ?? { current: false };
  const isTouchRotatingRef     = rot?.isTouchRotatingRef     ?? { current: false };
  const lastMouseMoveTsRef     = rot?.lastMouseMoveTsRef     ?? { current: 0 };
  const effectiveDraggingRef   = rot?.effectiveDraggingRef    ?? { current: false };
  const getDesktopCursorTarget = rot?.getDesktopCursorTarget ?? (() => ({ x: 0, y: 0 }));
  const applyRotationFrame     = rot?.applyRotationFrame     ?? (() => {});
  const notePossibleIdleExit   = rot?.notePossibleIdleExit   ?? (() => {});

  usePixelOffsets({ groupRef, camera, radius, xOffset, yOffset, xOffsetPx, yOffsetPx });
  useIdleDrift({ groupRef, speed, horizontalOnly, isIdle: isIdleWrapped });

  useFrame(() => {
    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
  });

  useFrame((_, delta) => {
    const userInteracting =
      effectiveDraggingRef.current || isTouchRotatingRef.current || isPinchingRef.current;

    const idleActive = isIdleWrapped({ userInteracting, hasInteractedRef, lastActivityRef });
    notePossibleIdleExit(idleActive);
    applyRotationFrame({ idleActive, delta });
  });

  const lastRotEvtRef = useRef({ x: 0, y: 0, t: 0 });
  useFrame(() => {
    if (!groupRef.current) return;
    const now2 = performance.now();
    const rx = groupRef.current.rotation.x;
    const ry = groupRef.current.rotation.y;
    const d  = Math.abs(rx - lastRotEvtRef.current.x) + Math.abs(ry - lastRotEvtRef.current.y);
    if (d > 0.002 && (now2 - lastRotEvtRef.current.t) > 120) {
      lastRotEvtRef.current = { x: rx, y: ry, t: now2 };
      window.dispatchEvent(new CustomEvent(ROTATE_EVT, {
        detail: { rx, ry, source: useDesktopLayout ? 'desktop' : 'touch' },
      }));
    }
  });

  const dynamicOffset = useDynamicOffset();
  const isPortrait = typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
  const offsetBase = isPortrait ? 160 : 120;
  const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius)));
  const nonlinearLerp = (a, b, t) => a + (b - a) * (1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 5));
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
    edgeCueRef,
  };
}
