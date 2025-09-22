// src/components/dataVisualization.jsx
import React, { useState, useRef, useEffect, Suspense } from 'react';
import '../styles/global-styles.css';
import '../styles/graph.css';

const Graph = React.lazy(() =>
  import(/* webpackChunkName: "graph" */ './dotGraph/graph')
);
const BarGraph = React.lazy(() =>
  import(/* webpackChunkName: "bar-graph" */ './dragGraph/barGraph')
);

const getPositionByViewport = (customX = null, customY = null) => {
  const width = window.innerWidth;
  let bar1Position = { x: 0, y: 0 };

  if (width < 768) {
    bar1Position = { x: window.innerWidth * 0, y: window.innerHeight * 0.35 };
  } else if (width >= 768 && width <= 1024) {
    bar1Position = { x: window.innerWidth * 0.05, y: window.innerHeight * 0.2 };
  } else {
    bar1Position = { x: window.innerWidth * 0.24, y: window.innerHeight * 0.1 };
  }

  return {
    x: customX !== null ? customX : bar1Position.x,
    y: customY !== null ? customY : bar1Position.y,
  };
};

const VisualizationPage = () => {
  const [isBarGraphVisible, setIsBarGraphVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 🔒 HUD latch state (sync with canonical state)
  const [hudLatched, setHudLatched] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.__gpEdgeLatched == null ? true : !!window.__gpEdgeLatched;
  });

  useEffect(() => {
    const onState = (e) => {
      const { latched } = e.detail || {};
      if (typeof latched === 'boolean') setHudLatched(!!latched);
    };
    window.addEventListener('gp:edge-cue-state', onState);
    return () => {
      window.removeEventListener('gp:edge-cue-state', onState);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPosition(getPositionByViewport()), 0);
    const handleResize = () => setPosition(getPositionByViewport());
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const dragRef = useRef(null);
  const buttonRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const dragAnimationRef = useRef(null);

  const handleDragStart = (e) => {
    const rect = dragRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    hasMoved.current = false;
    setIsDragging(true);
  };

  const handleDrag = (e) => {
    if (!isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const buttonRect = buttonRef.current.getBoundingClientRect();

    let newX = clientX - dragOffset.current.x;
    let newY = clientY - dragOffset.current.y;

    if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
      hasMoved.current = true;
    }

    const horizontalOffset = 24;
    newX = Math.max(-horizontalOffset, Math.min(newX, viewportWidth - buttonRect.width - horizontalOffset));
    newY = Math.max(0, Math.min(newY, viewportHeight - buttonRect.height));

    if (dragAnimationRef.current) cancelAnimationFrame(dragAnimationRef.current);
    dragAnimationRef.current = requestAnimationFrame(() => {
      setPosition({ x: newX, y: newY });
    });
  };

  const handleDragEnd = () => setIsDragging(false);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => handleDrag(e);
    const handleUp = () => handleDragEnd();
    const preventTextSelection = (event) => event.preventDefault();

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
  }, [isDragging]);

  return (
    <div>
      <Suspense fallback={<div className="graph-loading" style={{ height: '100svh' }}>Loading graph…</div>}>
        <Graph isDragging={isDragging} />
      </Suspense>

      {/* Draggable + toggle */}
      <div
        ref={dragRef}
        className="draggable-container"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 20,
          cursor: isDragging ? 'grabbing' : 'grab',
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
            if (hasMoved.current) {
              e.preventDefault();
              e.stopPropagation();
              hasMoved.current = false;
              return;
            }
            setIsBarGraphVisible((prev) => !prev);
          }}
        >
          <span
            className={`toggle-icon ${isBarGraphVisible ? 'open' : 'closed'}`}
            aria-hidden
          >
            {isBarGraphVisible ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" style={{ transition: 'transform 0.15s ease-out' }}>
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" style={{ transition: 'transform 0.15s ease-out' }}>
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
              background: hudLatched
                ? 'rgba(255,255,255,0.5)'
                : 'linear-gradient(to bottom, rgba(45, 45, 45, 0.9) 10%, rgba(255, 255, 255, 0.67) 100%)',
              transition: 'background 200ms ease',
            }}
          >
            <Suspense fallback={<div style={{ width: 240, height: 120 }}><h3>Loading…</h3></div>}>
              <BarGraph isVisible />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizationPage;
