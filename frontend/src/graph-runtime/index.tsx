// ─────────────────────────────────────────────────────────────
// src/graph-runtime/VisualizationPage.tsx
// Graph page: loads DotGraph + draggable BarGraph overlay
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';

import { useAppState } from '../app-context/appStateContext.tsx';

import '../static-assets/styles/graph.css';

const Graph = React.lazy(() => import(/* webpackChunkName: "graph" */ './dotgraph/index.tsx'));

const BarGraph = React.lazy(
  () => import(/* webpackChunkName: "bar-graph" */ './bargraph/BarGraph.tsx')
);

type XY = { x: number; y: number };

function getPositionByViewport(customX: number | null = null, customY: number | null = null): XY {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const h = typeof window !== 'undefined' ? window.innerHeight : 768;

  let base: XY = { x: 0, y: 0 };
  if (w < 768) {
    base = { x: w * 0.02, y: h * 0.17 };
  } else if (w >= 768 && w <= 1024) {
    base = { x: w * 0.05, y: h * 0.17 };
  } else {
    base = { x: w * 0.03, y: h * 0.14 };
  }

  return {
    x: customX !== null ? customX : base.x,
    y: customY !== null ? customY : base.y,
  };
}

type Pointerish =
  | React.MouseEvent<HTMLDivElement>
  | React.TouchEvent<HTMLDivElement>
  | MouseEvent
  | TouchEvent;

function getClientXY(e: Pointerish): XY {
  // React synthetic events keep the native event shape for touches.
  const anyE = e as any;

  if (anyE?.touches && anyE.touches.length) {
    return { x: anyE.touches[0].clientX, y: anyE.touches[0].clientY };
  }
  if (anyE?.changedTouches && anyE.changedTouches.length) {
    return { x: anyE.changedTouches[0].clientX, y: anyE.changedTouches[0].clientY };
  }
  return { x: anyE.clientX as number, y: anyE.clientY as number };
}

export default function VisualizationPage() {
  const { darkMode, observerMode } = useAppState() as any;

  const [isBarGraphVisible, setIsBarGraphVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Seed a sensible initial pos immediately to avoid (0,0) during SSR/hydration.
  const seedPos: XY = typeof window !== 'undefined' ? getPositionByViewport() : { x: 160, y: 120 };
  const [position, setPosition] = useState<XY>(seedPos);

  // Hide draggable until we do our pre-paint init (prevents any flash)
  const [ready, setReady] = useState<boolean>(typeof window === 'undefined' ? false : true);

  // Remember if the user explicitly toggled (don’t auto-flip after that)
  const userToggledRef = useRef(false);

  // Drag state
  const dragRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<XY>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const dragAnimationRef = useRef<number | null>(null);

  // Pre-paint init: compute position and visibility atomically before first paint,
  // and also when observerMode flips on (so mobile can auto-open without flashing).
  useLayoutEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const isDesktopOrTablet = w >= 768;

    // Set position synchronously
    setPosition(getPositionByViewport());

    // Initial visibility rules:
    // - ≥768px: always open
    // - <768px: closed by default, open if observerMode is true
    if (isDesktopOrTablet) {
      setIsBarGraphVisible(true);
    } else {
      setIsBarGraphVisible(observerMode ? true : false);
    }

    setReady(true);
  }, [observerMode]);

  // Keep position responsive after mount
  useEffect(() => {
    const handleResize = () => setPosition(getPositionByViewport());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // If observer mode turns on later, auto-open unless the user already toggled.
  useEffect(() => {
    if (!ready) return;
    if (!userToggledRef.current && observerMode) {
      setIsBarGraphVisible(true);
    }
  }, [observerMode, ready]);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const rect = dragRef.current.getBoundingClientRect();
    const { x: clientX, y: clientY } = getClientXY(e);

    dragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !buttonRef.current) return;

    // Important: touchmove listener is { passive:false } so we can prevent scrolling.
    try {
      (e as TouchEvent).preventDefault?.();
    } catch {}

    const { x: clientX, y: clientY } = getClientXY(e as any);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const buttonRect = buttonRef.current.getBoundingClientRect();

    let newX = clientX - dragOffsetRef.current.x;
    let newY = clientY - dragOffsetRef.current.y;

    if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
      hasMovedRef.current = true;
    }

    const horizontalOffset = 24;
    newX = Math.max(
      -horizontalOffset,
      Math.min(newX, viewportWidth - buttonRect.width - horizontalOffset)
    );
    newY = Math.max(0, Math.min(newY, viewportHeight - buttonRect.height));

    if (dragAnimationRef.current) cancelAnimationFrame(dragAnimationRef.current);
    dragAnimationRef.current = requestAnimationFrame(() => {
      setPosition({ x: newX, y: newY });
    });
  };

  const handleDragEnd = () => setIsDragging(false);

  // Global listeners while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => handleDrag(e);
    const handleUp = () => handleDragEnd();
    const preventTextSelection = (event: Event) => event.preventDefault();

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);

    document.addEventListener('selectstart', preventTextSelection);
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);

      document.removeEventListener('selectstart', preventTextSelection);
      document.body.style.userSelect = 'auto';
    };
    // NOTE: handleDrag is stable enough here because it only depends on isDragging/position,
    // and we're already gated by isDragging. If you see stale position while dragging, move
    // position into a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  const pageLoadingFallback = useMemo(
    () => (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
          pointerEvents: 'none',
          height: '100vh',
        }}
        aria-busy="true"
        aria-live="polite"
      >
        <h4 style={{ opacity: 0.85 }}>Loading…</h4>
      </div>
    ),
    []
  );

  const barLoadingFallback = useMemo(
    () => (
      <div
        style={{
          width: 240,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-busy="true"
        aria-live="polite"
      >
        <h4 style={{ opacity: 0.85 }}>Loading…</h4>
      </div>
    ),
    []
  );

  return (
    <div>
      <Suspense fallback={pageLoadingFallback}>
        <Graph isDragging={isDragging} />
      </Suspense>

      {/* Draggable + toggle (hidden until pre-paint init completes) */}
      <div
        ref={dragRef}
        className="draggable-container"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 20,
          cursor: isDragging ? 'grabbing' : 'grab',
          visibility: ready ? 'visible' : 'hidden', // prevent (0,0) flash on first paint
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div
          ref={buttonRef}
          className="toggle-button"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            left: '24px',
            position: 'relative',
          }}
          onClick={(e) => {
            if (hasMovedRef.current) {
              e.preventDefault();
              e.stopPropagation();
              hasMovedRef.current = false;
              return;
            }
            userToggledRef.current = true; // remember user intent
            setIsBarGraphVisible((prev) => !prev);
          }}
        >
          <span className={`toggle-icon ${isBarGraphVisible ? 'open' : 'closed'}`} aria-hidden>
            {isBarGraphVisible ? (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                style={{ transition: 'transform 0.15s ease-out' }}
              >
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                style={{ transition: 'transform 0.15s ease-out' }}
              >
                <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
              </svg>
            )}
          </span>
        </div>

        {isBarGraphVisible && (
          <div
            className="draggable-bar-graph"
            style={{
              background: darkMode
                ? 'linear-gradient(to bottom, rgba(45, 45, 45, 0.9) 10%, rgba(255, 255, 255, 0.85) 100%)'
                : 'rgba(255, 255, 255, 0.4)',
              transition: 'background 200ms ease',
            }}
          >
            <Suspense fallback={barLoadingFallback}>
              {/* Preserve existing prop even if unused */}
              <BarGraph isVisible />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
