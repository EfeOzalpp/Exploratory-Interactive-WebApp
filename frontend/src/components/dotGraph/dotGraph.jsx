// src/components/dotGraph/DotGraph.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import GamificationPersonalized from '../gamification/gamificationPersonalized';
import GamificationGeneral from '../gamification/gamificationGeneral';
import CompleteButton from '../completeButton.jsx';
import { useDynamicOffset } from '../../utils/dynamicOffset.ts';
import { useRealMobileViewport } from '../real-mobile.ts';
import { useGraph } from '../../context/graphContext.tsx';
import RingHalo from './ringHalo';

// centralized gradient utils (pure functions; safe to use in loops/effects)
import { sampleStops, rgbString } from '../../utils/hooks.ts';

const DotGraph = ({ isDragging = false, data = [] }) => {
  const [points, setPoints] = useState([]);
  const { section, mySection, myEntryId, observerMode } = useGraph();

  // Delay re-showing the “Complete” UI after observer mode closes
  const [showCompleteUI, setShowCompleteUI] = useState(!observerMode);
  const delayRef = useRef(null);

  useEffect(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (observerMode) {
      setShowCompleteUI(false);
    } else {
      delayRef.current = setTimeout(() => {
        setShowCompleteUI(true);
        delayRef.current = null;
      }, 2000);
    }
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [observerMode]);

  const personalizedEntryId =
    myEntryId || (typeof window !== 'undefined' ? sessionStorage.getItem('gp.myEntryId') : null);

  const isEntryInView = !!(personalizedEntryId && data?.some(d => d._id === personalizedEntryId));
  const showPersonalized = !!(showCompleteUI && !observerMode && isEntryInView);

  // ---------- helpers ----------
  // Centralized color: flip avg (1-avg), then sample brand gradient
  const colorForAverage = (avg /* 0..1 */) => rgbString(sampleStops(1 - avg));

  const groupRef = useRef();
  const [rotationAngles, setRotationAngles] = useState({ x: 0, y: 0 });
  const [lastCursorPosition, setLastCursorPosition] = useState({ x: 0, y: 0 });
  const lastCursorPositionRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragEndRef = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);
  const pinchCooldownRef = useRef(false);
  const pinchTimeoutRef = useRef(null);
  const touchRotationRef = useRef({ x: 0, y: 0 });
  const lastRotationRef = useRef({ x: 0, y: 0 });
  const isTouchRotatingRef = useRef(false);
  const lastTouchPositionRef = useRef({ x: 0, y: 0 });
  const pinchDeltaRef = useRef(0);
  const hoverLockRef = useRef(false);

  const hideTimerRef = useRef(null);
  const lastRotSampleRef = useRef({ x: 0, y: 0 });

  const [hoveredDot, setHoveredDot] = useState(null);
  const hoverCheckInterval = useRef(null);
  const [viewportClass, setViewportClass] = useState('');
  const touchStartDistance = useRef(null);
  const { camera } = useThree();

  // Screen detector
  const isSmallScreen = window.innerWidth < 768;
  const isNotDesktop = window.innerWidth <= 1024;
  const isDesktop2 = window.innerWidth > 1024;

  const isRealMobile = useRealMobileViewport();
  const useMobileLayout = isSmallScreen || isRealMobile;
  const useDesktopLayout = !useMobileLayout;
  const isTabletLike = isRealMobile && window.innerWidth > 768;

  const xOffset = isSmallScreen ? -12 : 0;
  const yOffset = isSmallScreen ? -2 : 0;

  const minRadius = isSmallScreen ? 2 : 20;
  const maxRadius = 400;

  const [radius, setRadius] = useState(20);

  const targetRadius = isSmallScreen ? 450 : 250;
  const scalingFactor = 0.5;
  const dynamicRadius = targetRadius + data.length * scalingFactor;
  const finalRadius = Math.max(minRadius, Math.min(maxRadius, dynamicRadius));

  useEffect(() => {
    let startTime;
    const duration = 1000;

    const animateRadius = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setRadius((prevRadius) => {
        if (isPinchingRef.current || pinchDeltaRef.current !== 0) return prevRadius;
        return 20 + (finalRadius - 20) * easeOut;
      });

      if (progress < 1 && !isPinchingRef.current) {
        requestAnimationFrame(animateRadius);
      }
    };

    requestAnimationFrame(animateRadius);
  }, [finalRadius]);

  const dynamicOffset = useDynamicOffset();

  const nonlinearLerp = (start, end, t) => {
    const easedT = 1 - Math.pow(1 - t, 5);
    const value = start + (end - start) * easedT;
    return Math.min(Math.max(value, Math.min(start, end)), Math.max(start, end));
  };
  const lerp = (start, end, t) => start + (end - start) * t;

  const zoomFactor = (radius - minRadius) / (maxRadius - minRadius);

  const currentWidth = window.innerWidth;
  const currentHeight = window.innerHeight;
  const isPortrait = currentHeight > currentWidth;

  const offsetOne = isPortrait ? 160 : 120;
  const offsetPx = nonlinearLerp(offsetOne, dynamicOffset, zoomFactor);

  const spreadFactor = 75;

  // Generate dot positions
  const generatePositions = (numPoints, minDistance = 24, externalSpread) => {
    const positions = [];
    const maxRetries = 1000;
    const baseSpread = 36;
    const scalingFactor = 0.14;
    const spreadFactor = externalSpread ?? (baseSpread + numPoints * scalingFactor);

    for (let i = 0; i < numPoints; i++) {
      let position;
      let overlapping;
      let retries = 0;

      do {
        if (retries > maxRetries) break;

        position = [
          (Math.random() - 0.5) * spreadFactor,
          (Math.random() - 0.5) * spreadFactor,
          (Math.random() - 0.5) * spreadFactor,
        ];

        overlapping = positions.some((existing) => {
          const distance = Math.sqrt(
            (position[0] - existing[0]) ** 2 +
              (position[1] - existing[1]) ** 2 +
              (position[2] - existing[2]) ** 2
          );
          return distance < minDistance;
        });

        retries++;
      } while (overlapping);

      if (!overlapping) positions.push(position);
    }

    // optional validation (kept)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const distance = Math.sqrt(
          (positions[i][0] - positions[j][0]) ** 2 +
            (positions[i][1] - positions[j][1]) ** 2 +
            (positions[i][2] - positions[j][2]) ** 2
        );
        if (distance < minDistance) {
          console.error(`Points ${i} and ${j} are too close! Distance: ${distance}`);
        }
      }
    }
    return positions;
  };

  // place points + use centralized color
  useEffect(() => {
    const positions = generatePositions(data.length, 2, spreadFactor);

    const newPoints = data.map((response, index) => {
      const weights = Object.values(response.weights || {});
      const averageWeight =
        weights.length ? weights.reduce((sum, w) => sum + w, 0) / weights.length : 0.5;

      return {
        position: positions[index],
        originalPosition: positions[index],
        color: colorForAverage(averageWeight), // ✅ centralized gradient
        averageWeight,
        _id: response._id,
      };
    });

    if (showPersonalized && personalizedEntryId) {
      const mineIdx = newPoints.findIndex((p) => p._id === personalizedEntryId);
      if (mineIdx !== -1) {
        newPoints[mineIdx].position = [0, 0, 0];
        newPoints[mineIdx].originalPosition = [0, 0, 0];
      }
    }

    setPoints(newPoints);
  }, [data, showPersonalized, personalizedEntryId]);

  let targetX = 0;
  let targetY = 0;

  const zoomTargetRef = useRef(null);
  const zoomVelRef = useRef(0);

  useEffect(() => {
    const onHover = (e) => {
      hoverLockRef.current = !!(e?.detail?.hover);
    };
    window.addEventListener("gp:menu-hover", onHover);
    return () => window.removeEventListener("gp:menu-hover", onHover);
  }, []);

  useEffect(() => {
    if (isDragging) {
      lastCursorPositionRef.current = {
        x: lastCursorPositionRef.current.x - dragOffset.current.x,
        y: lastCursorPositionRef.current.y - dragOffset.current.y,
      };
      dragStartRef.current = { ...lastCursorPositionRef.current };
    }
    if (!isDragging) {
      dragEndRef.current = { ...lastCursorPositionRef.current };
      dragOffset.current = {
        x: dragEndRef.current.x - dragStartRef.current.x,
        y: dragEndRef.current.y - dragStartRef.current.y,
      };
      setLastCursorPosition({ ...lastCursorPositionRef.current });
    }

    const handleMouseMove = (event) => {
      if (isNotDesktop && event.type === 'mousemove') return;

      const normalizedX = (event.clientX / currentWidth) * 2 - 1;
      const normalizedY = -(event.clientY / currentHeight) * 2 + 1;

      targetX = normalizedX - dragOffset.current.x;
      targetY = normalizedY - dragOffset.current.y;

      lastCursorPositionRef.current = { x: normalizedX, y: normalizedY };
      setLastCursorPosition({ x: targetX, y: targetY });
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const WHEEL_SENSITIVITY = 0.5;

    const handleScroll = (event) => {
      if (hoverLockRef.current) return;

      if (event.ctrlKey) {
        setRadius((prevRadius) => {
          const newRadius = prevRadius - event.deltaY * 2;
          return Math.max(minRadius, Math.min(maxRadius, newRadius));
        });
      } else {
        const delta = -event.deltaY * WHEEL_SENSITIVITY;
        const current = zoomTargetRef.current ?? radius;
        zoomTargetRef.current = clamp(current + delta, minRadius, maxRadius);
      }
    };

    const handleTouchStart = (event) => {
      if (event.touches.length === 1) {
        lastRotationRef.current = { ...touchRotationRef.current };
        const touch = event.touches[0];
        lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchMove = (event) => {
      event.preventDefault();
      if (useDesktopLayout && event.type === 'mousemove') return;
      if (isDragging) return;

      if (event.touches.length === 1 && !isPinchingRef.current) {
        isTouchRotatingRef.current = true;
        const touch = event.touches[0];
        const currentTouch = { x: touch.clientX, y: touch.clientY };

        if (lastTouchPositionRef.current) {
          const dx = currentTouch.x - lastTouchPositionRef.current.x;
          const dy = currentTouch.y - lastTouchPositionRef.current.y;

          const length = Math.sqrt(dx * dx + dy * dy) || 1;
          const direction = { x: dx / length, y: dy / length };

          const speedMultiplier = 4.8;
          const rotationX = lastRotationRef.current.x - direction.y * speedMultiplier;
          const rotationY = lastRotationRef.current.y - direction.x * speedMultiplier;

          touchRotationRef.current = { x: rotationX, y: rotationY };
        }

        lastTouchPositionRef.current = currentTouch;
      } else if (event.touches.length === 2) {
        if (pinchCooldownRef.current) return;

        isPinchingRef.current = true;
        isTouchRotatingRef.current = false;

        const [touch1, touch2] = event.touches;
        const x1 = touch1.clientX, y1 = touch1.clientY;
        const x2 = touch2.clientX, y2 = touch2.clientY;
        const newDistance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

        if (touchStartDistance.current !== null) {
          const pinchDelta = newDistance - touchStartDistance.current;

          setRadius((prevRadius) => {
            const zoomFactor = pinchDelta * 0.9;
            let newRadius = prevRadius - zoomFactor;
            return Math.max(minRadius, Math.min(maxRadius, newRadius));
          });
        }

        touchStartDistance.current = newDistance;
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isTouchRotatingRef.current = false;
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
        setTimeout(() => {
          pinchCooldownRef.current = false;
        }, 200);

        touchStartDistance.current = null;
      }
    };

    window.addEventListener('wheel', handleScroll);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [minRadius, maxRadius, isDragging, useDesktopLayout]);

  useFrame((_, delta) => {
    if (isDragging) return;
    if (useDesktopLayout) {
      targetX = (lastCursorPositionRef.current.y - dragOffset.current.y) * Math.PI * 0.25;
      targetY = (lastCursorPositionRef.current.x - dragOffset.current.x) * Math.PI * 0.5;
    } else if (isTabletLike) {
      targetX = -(touchRotationRef.current.x - yOffset) * 0.2;
      targetY = -(touchRotationRef.current.y - xOffset) * 0.35;
    } else {
      targetX = -(touchRotationRef.current.x - yOffset) * 0.1;
      targetY = -(touchRotationRef.current.y - xOffset) * 0.17;
    }

    if (isPinchingRef.current && pinchDeltaRef.current !== 0) {
      const zoomInSensitivity = 2.5;
      const zoomOutSensitivity = 3;
      const isZoomingIn = pinchDeltaRef.current > 0;
      const sensitivity = isZoomingIn ? zoomInSensitivity : zoomOutSensitivity;

      setRadius((prevRadius) => {
        let newRadius = prevRadius - pinchDeltaRef.current * sensitivity;
        return Math.max(minRadius, Math.min(maxRadius, newRadius));
      });

      pinchDeltaRef.current = 0;
    }

    const dampingFactor = isSmallScreen ? 0.15 : 0.03;
    const newRotationAngles = {
      x: lerp(rotationAngles.x, targetX, dampingFactor),
      y: lerp(rotationAngles.y, targetY, dampingFactor),
    };

    setRotationAngles(newRotationAngles);

    if (groupRef.current) {
      groupRef.current.rotation.x = newRotationAngles.x;
      groupRef.current.rotation.y = -newRotationAngles.y;
      groupRef.current.position.set(xOffset, yOffset, 0);
    }

    if (useDesktopLayout && zoomTargetRef.current != null) {
      const omega = 12.0;
      const r = radius;
      const target = Math.max(minRadius, Math.min(maxRadius, zoomTargetRef.current));
      let v = zoomVelRef.current;
      const x = r - target;

      const a = -2 * omega * v - omega * omega * x;
      v += a * delta;
      let next = r + v * delta;

      next = Math.max(minRadius, Math.min(maxRadius, next));

      if (Math.abs(next - r) > 0.0005) {
        setRadius(next);
      } else {
        setRadius(target);
        v = 0;
      }
      zoomVelRef.current = v;
    }

    // Mobile: auto-hide hover after 2s of no rotation movement
    if (!useDesktopLayout && isTouchRotatingRef.current && hoveredDot) {
      const rx = touchRotationRef.current.x;
      const ry = touchRotationRef.current.y;
      const dx = rx - lastRotSampleRef.current.x;
      const dy = ry - lastRotSampleRef.current.y;
      const moved = dx * dx + dy * dy > 0.0001;

      if (moved) {
        lastRotSampleRef.current = { x: rx, y: ry };
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setHoveredDot(null);
        }, 2000);
      }
    }

    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
  });

  const myPoint = points.find((p) => p._id === personalizedEntryId);
  const myEntry = data.find((e) => e._id === personalizedEntryId);

  // percentage only if personalized view is active & my entry is in view
  let percentage = 0;
  if (showPersonalized && myEntry) {
    const latestVals = Object.values(myEntry.weights || {});
    const latestAvg = latestVals.length ? latestVals.reduce((s, w) => s + w, 0) / latestVals.length : 0.5;
    const higher = data.filter((entry) => {
      const v = Object.values(entry.weights || {});
      const avg = v.length ? v.reduce((s, w) => s + w, 0) / v.length : 0.5;
      return avg > latestAvg;
    });
    percentage = Math.round((higher.length / data.length) * 100);
  }

  const calculatePercentage = (averageWeight) => {
    const usersWithHigherWeight = points.filter((p) => p.averageWeight > averageWeight);
    return Math.round((usersWithHigherWeight.length / points.length) * 100);
  };

  const calculateViewportProximity = (x, y) => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const verticalEdgeThreshold = isSmallScreen ? 100 : 150;
    const useMobile = useMobileLayout;

    const LEFT_PCT_DESKTOP = 0.4;
    const RIGHT_PCT_DESKTOP = 0.6;

    const LEFT_PCT_MOBILE = 0.6;

    const isTop = y < verticalEdgeThreshold;
    const isBottom = y > height - verticalEdgeThreshold;

    let newClass = '';
    if (isTop) newClass += ' is-top';
    if (isBottom) newClass += ' is-bottom';

    if (useMobile) {
      const leftThreshold = width * LEFT_PCT_MOBILE;
      if (x < leftThreshold) newClass += ' is-left';
      else newClass += ' is-right';
    } else {
      const leftThreshold = width * LEFT_PCT_DESKTOP;
      const rightThreshold = width * RIGHT_PCT_DESKTOP;
      const inMid = x >= width * 0.4 && x <= width * 0.6;
      const inLeft = x < leftThreshold;
      const inRight = x > rightThreshold;

      if (inMid) newClass += ' is-mid';
      else if (inLeft) newClass += ' is-left';
      else if (inRight) newClass += ' is-right';
    }

    return newClass.trim();
  };

  const handleHoverStart = (dot, event) => {
    if (isTouchRotatingRef.current || isDragging || isPinchingRef.current) return;
    const { clientX, clientY } = event.nativeEvent;

    const proximityClass = calculateViewportProximity(clientX, clientY);
    setViewportClass(proximityClass);

    if (!useDesktopLayout) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    setHoveredDot({
      dotId: dot._id,
      percentage: calculatePercentage(dot.averageWeight),
      color: dot.color,
    });
  };

  const handleHoverEnd = () => {
    if (isTouchRotatingRef.current || isPinchingRef.current || isDragging) return;
    setHoveredDot(null);
    setViewportClass('');
  };

  useEffect(() => {
    return () => {
      if (hoverCheckInterval.current) {
        clearInterval(hoverCheckInterval.current);
        cancelAnimationFrame(hoverCheckInterval.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {showCompleteUI && (
        <Html zIndexRange={[2, 24]} style={{ pointerEvents: 'none' }}>
          <div
            className="z-index-respective"
            style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', height: '100vh', pointerEvents: 'none' }}
          >
            <CompleteButton />
          </div>
        </Html>
      )}

      <group ref={groupRef}>
        {points.map((point, index) => {
          const isMine = point._id === personalizedEntryId;
          const suppressHover = showPersonalized && isMine;

          return (
            <mesh
              key={index}
              position={point.position}
              onPointerOver={(event) => {
                event.stopPropagation();
                if (!suppressHover) handleHoverStart(point, event);
              }}
              onPointerOut={(event) => {
                event.stopPropagation();
                if (!suppressHover) handleHoverEnd(point);
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (isTouchRotatingRef.current || isDragging || isPinchingRef.current) return;
                if (!suppressHover) handleHoverStart(point, event);
              }}
            >
              <sphereGeometry args={[1.4, 48, 48]} />
              <meshStandardMaterial color={point.color} />
            </mesh>
          );
        })}

        {/* PERSONALIZED center panel */}
        {showPersonalized && myPoint && myEntry && (
          <>
            <group position={myPoint.position}>
              <RingHalo
                color={myPoint.color}
                baseRadius={1.4}
                active={true}
                bloomLayer={1}
              />
              <mesh>
                <sphereGeometry args={[1.4, 48, 48]} />
                <meshStandardMaterial color={myPoint.color} />
              </mesh>
            </group>

            <Html
              position={myPoint.position}
              center
              zIndexRange={[110, 130]}
              style={{ pointerEvents: 'none', '--offset-px': `${offsetPx}px` }}
            >
              <div>
                <GamificationPersonalized
                  userData={myEntry}
                  percentage={percentage}
                  color={myPoint.color}
                />
              </div>
            </Html>
          </>
        )}

        {/* General tooltip for hovered dots */}
        {hoveredDot &&
          (() => {
            const hoveredData = points.find((dot) => dot._id === hoveredDot.dotId);
            if (!hoveredData) return null;

            return (
              <Html
                position={hoveredData.position}
                center
                zIndexRange={[120, 180]}
                style={{ pointerEvents: 'none', '--offset-px': `${offsetPx}px` }}
                className={`${viewportClass}`}
              >
                <div>
                  <GamificationGeneral
                    dotId={hoveredDot.dotId}
                    percentage={hoveredDot.percentage}
                    color={hoveredData.color}
                  />
                </div>
              </Html>
            );
          })()}
      </group>
    </>
  );
};

export default DotGraph;
