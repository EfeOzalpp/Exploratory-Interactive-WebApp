// src/components/dotGraph/hooks/useHoverBubble.js
import { useCallback, useRef, useState } from 'react';

export default function useHoverBubble({
  useDesktopLayout,
  isDragging,
  isPinchingRef,
  isTouchRotatingRef,
  calcPercentForAvg, // function(avg) -> percentage
}) {
  const [hoveredDot, setHoveredDot] = useState(null);
  const [viewportClass, setViewportClass] = useState('');
  const hideTimerRef = useRef(null);

  const calculateViewportProximity = (x, y) => {
    const w = window.innerWidth, h = window.innerHeight;
    const isSmallScreen = w < 768;
    const vEdge = isSmallScreen ? 100 : 150;

    const LEFT_PCT_DESKTOP = 0.4;
    const RIGHT_PCT_DESKTOP = 0.6;
    const LEFT_PCT_MOBILE = 0.6;

    const isTop = y < vEdge;
    const isBottom = y > h - vEdge;

    let cls = '';
    if (isTop) cls += ' is-top';
    if (isBottom) cls += ' is-bottom';

    if (isSmallScreen || !useDesktopLayout) {
      cls += x < w * LEFT_PCT_MOBILE ? ' is-left' : ' is-right';
    } else {
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

      // support R3F events (nativeEvent) and plain DOM events
      const native = e?.nativeEvent ?? e;
      const { clientX, clientY } = native || {};
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        setViewportClass(calculateViewportProximity(clientX, clientY));
      }

      if (!useDesktopLayout && hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setHoveredDot({
        dotId: dot._id,
        percentage: typeof calcPercentForAvg === 'function'
          ? calcPercentForAvg(dot.averageWeight)
          : 0,
        color: dot.color,
      });
    },
    [useDesktopLayout, isDragging, isPinchingRef, isTouchRotatingRef, calcPercentForAvg]
  );

  const onHoverEnd = useCallback(() => {
    if (isDragging || isPinchingRef?.current) return;
    setHoveredDot(null);
    setViewportClass('');
  }, [isDragging, isPinchingRef]);

  // keep backward-compat in case some call sites still import handle*
  return { hoveredDot, viewportClass, onHoverStart, onHoverEnd, handleHoverStart: onHoverStart, handleHoverEnd: onHoverEnd };
}
