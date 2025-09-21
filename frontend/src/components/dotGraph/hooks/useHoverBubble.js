// src/components/dotGraph/hooks/useHoverBubble.js
import { useCallback, useRef, useState } from 'react';

export default function useHoverBubble({
  useDesktopLayout,
  isDragging,
  isPinchingRef,
  isTouchRotatingRef,
  calcPercentForAvg,
}) {
  const [hoveredDot, setHoveredDot] = useState(null);
  const [viewportClass, setViewportClass] = useState('');
  const hideTimerRef = useRef(null);

  // Tuning:
  // - Desktop: keep left at 40%, push right start to 72% so it's not too close to center.
  // - Mobile: unchanged (right starts at 60%).
  const LEFT_PCT_DESKTOP = 0.80;
  const RIGHT_PCT_DESKTOP = 0.2; // was 0.60; higher = closer to the right edge
  const LEFT_PCT_MOBILE = 0.60;

  const calculateViewportProximity = (x, y) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isSmallScreen = w < 768;

    // Nudge the vertical edge padding so bubbles don’t collide with top/bottom UI.
    const vEdge = isSmallScreen ? 100 : 150;

    const isTop = y < vEdge;
    const isBottom = y > h - vEdge;

    let cls = '';
    if (isTop) cls += ' is-top';
    if (isBottom) cls += ' is-bottom';

    if (isSmallScreen || !useDesktopLayout) {
      // Mobile / non-desktop layout: unchanged behavior
      cls += x < w * LEFT_PCT_MOBILE ? ' is-left' : ' is-right';
    } else {
      // Desktop layout: widen the middle band so right starts closer to the edge
      const inMid = x >= w * LEFT_PCT_DESKTOP && x <= w * RIGHT_PCT_DESKTOP;
      if (inMid) cls += ' is-mid';
      else if (x < w * LEFT_PCT_DESKTOP) cls += ' is-left';
      else cls += ' is-right';
    }

    return cls.trim();
  };

  const onHoverStart = useCallback(
    (dot, e) => {
      if (isDragging || isPinchingRef?.current || isTouchRotatingRef?.current) return;

      const native = e?.nativeEvent ?? e;
      const { clientX, clientY } = native || {};
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        setViewportClass(calculateViewportProximity(clientX, clientY));
      }

      // On touch layouts we may have a hide timer elsewhere; clear it on hover open.
      if (!useDesktopLayout && hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setHoveredDot({
        dotId: dot._id,
        percentage:
          typeof calcPercentForAvg === 'function'
            ? calcPercentForAvg(dot.averageWeight)
            : 0,
        color: dot.color,
      });

      // announce hover-open (blocks idle drift)
      window.dispatchEvent(new CustomEvent('gp:hover-open', { detail: { id: dot._id } }));
    },
    [useDesktopLayout, isDragging, isPinchingRef, isTouchRotatingRef, calcPercentForAvg]
  );

  const onHoverEnd = useCallback(() => {
    if (isDragging || isPinchingRef?.current) return;
    setHoveredDot(null);
    setViewportClass('');
    // announce hover-close (allows idle drift)
    window.dispatchEvent(new CustomEvent('gp:hover-close'));
  }, [isDragging, isPinchingRef]);

  return {
    hoveredDot,
    viewportClass,
    onHoverStart,
    onHoverEnd,
    handleHoverStart: onHoverStart,
    handleHoverEnd: onHoverEnd,
  };
}
