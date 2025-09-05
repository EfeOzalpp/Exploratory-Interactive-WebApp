import React, { useEffect, useState, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import GamificationPersonalized from './gamificationPersonalized'; 
import GamificationGeneral from './gamificationGeneral'; 
import CompleteButton from '../completeButton.jsx'; 
import { useDynamicOffset } from '../../utils/dynamicOffset.ts'; // Dynamic Offset to adjust offset for popups
import { isMobile, isTablet, isDesktop } from 'react-device-detect'; // Device detector library

const DotGraph = ({ isDragging = false, data = [] }) => {
  const [points, setPoints] = useState([]);
  
  // Rotation + pinch ref and states
  const groupRef = useRef();
  const [rotationAngles, setRotationAngles] = useState({ x: 0, y: 0 });
  const [lastCursorPosition, setLastCursorPosition] = useState({ x: 0, y: 0 });
  const lastCursorPositionRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 }); 
  const dragEndRef = useRef({ x: 0, y: 0 }); 
  const dragOffset = useRef({ x: 0, y: 0 }); 
  const isPinchingRef = useRef(false); // Track if pinch is active
  const pinchCooldownRef = useRef(false);
  const pinchTimeoutRef = useRef(null); // Store timeout reference
  const touchRotationRef = useRef({ x: 0, y: 0 }); // Persistent touch rotation
  const lastRotationRef = useRef({ x: 0, y: 0 }); // Stores last rotation before a new touch starts  
  const isTouchRotatingRef = useRef(false); // Track active one-finger rotation
  const lastTouchPositionRef = useRef({ x: 0, y: 0 });
  const pinchDeltaRef = useRef(0); // Store pinch distance changes

  // 🔸 Touch-only auto-hide control for GamificationGeneral
  const hideTimerRef = useRef(null);
  const lastRotSampleRef = useRef({ x: 0, y: 0 });

  // Dot hover states, edge case states
  const [hoveredDot, setHoveredDot] = useState(null);
  const hoverCheckInterval = useRef(null); // Store interval or requestAnimationFrame for periodic checks
  const [viewportClass, setViewportClass] = useState(''); // Track proximity to edges to add class
  const touchStartDistance = useRef(null);
  const { camera } = useThree();

  // Screen Detector
  const isSmallScreen = window.innerWidth < 768;
  const isNotDesktop = window.innerWidth <= 1024;

  // Device Detector
  const IS_MOBILE = isMobile;
  const IS_TABLET = isTablet;
  const IS_DESKTOP = isDesktop;

  const xOffset = isSmallScreen ? -12 : 0;
  const yOffset = isSmallScreen ? 24 : 0;

  const minRadius = isSmallScreen ? 2 : 20; // Calculating zoomed in and out states to adjust dynamic offset
  const maxRadius = 400; // Maximum allowed zoomed out

  // First load zoom position for a planned initial appearance 
  const [radius, setRadius] = useState(150); // Start small 
  const radiusRef = useRef(radius);
  useEffect(() => { radiusRef.current = radius; }, [radius]);

  // Smooth desktop wheel zoom only
  const zoomTargetRef = useRef(radius);
  const zoomVelRef = useRef(0);

  // Target values based on screen size
  const targetRadius = isSmallScreen ? 300 : 600;
  const scalingFactor = 0.5;
  const dynamicRadius = targetRadius + data.length * scalingFactor;
  const finalRadius = Math.max(minRadius, Math.min(maxRadius, dynamicRadius));

  useEffect(() => {
    let startTime;
    const duration = 1000; // Animation duration in ms (1s)

    const animateRadius = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1); // Normalize [0,1]
      
      // Apply easing for smooth acceleration and deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // **Only animate if the user hasn't zoomed yet**
      setRadius((prevRadius) => {
        // If user already zoomed, stop the animation early
        if (isPinchingRef.current || pinchDeltaRef.current !== 0) return prevRadius;
        return 20 + (finalRadius- 20) * easeOut;
      });

      if (progress < 1 && !isPinchingRef.current) {
        requestAnimationFrame(animateRadius);
      }
    };

    requestAnimationFrame(animateRadius);
  }, [finalRadius]);


  // Get dynamicOffset.ts caluclated value. 
  const dynamicOffset = useDynamicOffset();

  /* Nonlinear interpolation is necessary to create a tailored value that adapts to different viewport sizes
  and Three.js DOM environment's x,y,z positions + movement to work with 2D elements */
  const nonlinearLerp = (start, end, t) => {
    // Apply an easing function (ease-in)
    const easedT = 1 - Math.pow(1 - t, 5); // Adjust this function for different skew effects

    // Perform the interpolation
    const value = start + (end - start) * easedT;

    // Clamp the result to stay within [start, end]
    return Math.min(Math.max(value, Math.min(start, end)), Math.max(start, end));
  };
  // Linear interpolation function
  const lerp = (start, end, t) => start + (end - start) * t;

  // Map radius to a 0..1 range for gamification offset
  const zoomFactor = (radius - minRadius) / (maxRadius - minRadius);

  const currentWidth = window.innerWidth;
  const currentHeight = window.innerHeight;
  const isPortrait = currentHeight > currentWidth;

  let offsetOne;
  // Fully zoomed in offset value for Dynamic Offset variable for device type
  if (isPortrait) {offsetOne = 160;} else {offsetOne = 120;}

  // Use the dynamicOffset in the lerp function
  const offsetPx = nonlinearLerp(offsetOne, dynamicOffset, zoomFactor);

  // Generating red-yellow-green gradient to apply based on data weight 
  const interpolateColor = (weight) => {
      // Flip weight first to match the original logic
      const flippedWeight = 1 - weight; 
    
      // Define color stops (Red → Orange → Yellow → Lime-Yellow → Green)
      const colorStops = [
        { stop: 0.0, color: { r: 249, g: 14, b: 33 } },      // Red
        { stop: 0.46, color: { r: 252, g: 159, b: 29 } },   // Orange
        { stop: 0.64, color: { r: 245, g: 252, b: 95 } },    // Yellow
        { stop: 0.8, color: { r: 0, g: 253, b: 156 } },   // Lime-Yellow
        { stop: 1, color: { r: 1, g: 238, b: 0 } }       // Green
      ];
    
      // Find two closest color stops
      let lower = colorStops[0], upper = colorStops[colorStops.length - 1];
    
      for (let i = 0; i < colorStops.length - 1; i++) {
        if (flippedWeight >= colorStops[i].stop && flippedWeight <= colorStops[i + 1].stop) {
          lower = colorStops[i];
          upper = colorStops[i + 1];
          break;
        }
      }
    
      // Normalize weight between lower and upper stops
      const range = upper.stop - lower.stop;
      const normalizedWeight = range === 0 ? 0 : (flippedWeight - lower.stop) / range;
    
      // Interpolate RGB values linearly
      const r = Math.round(lower.color.r + (upper.color.r - lower.color.r) * normalizedWeight);
      const g = Math.round(lower.color.g + (upper.color.g - lower.color.g) * normalizedWeight);
      const b = Math.round(lower.color.b + (upper.color.b - lower.color.b) * normalizedWeight);
    
      return `rgb(${r}, ${g}, ${b})`;
  };  
    
  const spreadFactor = 75; // Default spread factor for dots
  // Generate dot positions, spread them as numbers increase
  const generatePositions = (numPoints, minDistance = 24) => {
    const positions = [];
    const maxRetries = 1000;

    // Dynamically adjust spreadFactor based on number of points
    const baseSpread = 76; // Minimum spread
    const scalingFactor = 0.26; // Spread increases by 0.26 per point
    const spreadFactor = baseSpread + numPoints * scalingFactor;
    
    for (let i = 0; i < numPoints; i++) {
      let position;
      let overlapping;
      let retries = 0;

      do {
        if (retries > maxRetries) {
          console.warn(`Failed to place point ${i} after ${maxRetries} retries.`);
          break;
        }

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

      if (!overlapping) {
        positions.push(position);
      }
    }

    // Validation step
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

  // Center personalized dot
  useEffect(() => {
    const calculatePoints = () => {
      const positions = generatePositions(data.length, 2, spreadFactor);

      // Map data to points
      const newPoints = data.map((response, index) => {
        const weights = Object.values(response.weights);
        const averageWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;

        return {
          position: positions[index],
          originalPosition: positions[index],
          color: interpolateColor(averageWeight),
          averageWeight,
          _id: response._id,
        };
      });
      
      // Ensure latest point is at the center
      const latestEntryId = data[0]?._id;
      if (latestEntryId) {
        const latestPointIndex = newPoints.findIndex((point) => point._id === latestEntryId);
        if (latestPointIndex !== -1) {
          if (isNotDesktop) {
            newPoints[latestPointIndex].position = [0, 0, 0]; // Adjusted center for mobile
            newPoints[latestPointIndex].originalPosition = [0, 0, 0]; // Update original position as well
          } else {
            newPoints[latestPointIndex].position = [0, 0, 0]; // Adjusted center for desktop
            newPoints[latestPointIndex].originalPosition = [0, 0, 0]; // Update original position as well
          }
        }
      }

      setPoints(newPoints);
    };
    
    calculatePoints();
  }, [data]);

  let targetX = 0; // Default value for x and y
  let targetY = 0;

  // Event listeners and special cases
  useEffect(() => {
    // Dragging Bar graph initial coordinate and final coordinate storing
    if (isDragging) {
      // Ensure cursor starts from the last adjusted position
      lastCursorPositionRef.current = {
        x: lastCursorPositionRef.current.x - dragOffset.current.x,
        y: lastCursorPositionRef.current.y - dragOffset.current.y,
      };

      // Now correctly set drag start position
      dragStartRef.current = { ...lastCursorPositionRef.current };
    }
    // Calculating offset between initial and final to undo drag at the end of freeze to avoid jitter
    if (!isDragging) {
      // Dragging ended: Capture the end position
      dragEndRef.current = { ...lastCursorPositionRef.current };

      // Calculate offset
      dragOffset.current = {
        x: dragEndRef.current.x - dragStartRef.current.x,
        y: dragEndRef.current.y - dragStartRef.current.y,
      };
      setLastCursorPosition({ ...lastCursorPositionRef.current });
    }

    // Rotate with cursor position for desktop
    const handleMouseMove = (event) => {
      if (isNotDesktop && event.type === "mousemove") return;

      const normalizedX = (event.clientX / currentWidth) * 2 - 1;
      const normalizedY = -(event.clientY / currentHeight) * 2 + 1;
    
      // If dragging, don't update targetX/targetY to avoid jitter
      targetX = normalizedX - dragOffset.current.x;
      targetY = normalizedY - dragOffset.current.y;
    
      // Always track cursor position
      lastCursorPositionRef.current = { x: normalizedX, y: normalizedY };
      setLastCursorPosition({ x: targetX, y: targetY });
    };

    // Mouse scroll and touch pad scroll for desktop
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const WHEEL_SENSITIVITY = 0.5;

    const handleScroll = (event) => {
      if (event.ctrlKey) {
        // Likely a touch pad pinch (desktop) — keep IMMEDIATE behavior
        setRadius((prevRadius) => {
          const newRadius = prevRadius - event.deltaY * 2; // Adjust for pinch sensitivity
          return Math.max(minRadius, Math.min(maxRadius, newRadius));
        });
      } else {
        // Regular scroll wheel — SMOOTH via target (desktop only)
        const delta = -event.deltaY * WHEEL_SENSITIVITY;
        zoomTargetRef.current = clamp(
          (zoomTargetRef.current ?? radiusRef.current) + delta,
          minRadius,
          maxRadius
        );
      }
    };    

    const handleTouchStart = (event) => {
      if (event.touches.length === 1) {
        // Store the last known rotation BEFORE starting a new drag
        lastRotationRef.current = { ...touchRotationRef.current };

        // Store initial touch position
        const touch = event.touches[0];
        lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    // Rotate one finger, two finger pinch for mobile  (UNCHANGED)    
    const handleTouchMove = (event) => {
      event.preventDefault();
      if (IS_DESKTOP && !IS_TABLET && event.type === "mousemove") return;
      if (isDragging) return;
      if (event.touches.length === 1 && !isPinchingRef.current) {
        isTouchRotatingRef.current = true;
        const touch = event.touches[0];
        const currentTouch = { x: touch.clientX, y: touch.clientY };

        if (lastTouchPositionRef.current) {
          // Calculate movement direction **only**
          const dx = currentTouch.x - lastTouchPositionRef.current.x;
          const dy = currentTouch.y - lastTouchPositionRef.current.y;

          // Normalize movement vector (ensures smooth scaling)
          const length = Math.sqrt(dx * dx + dy * dy) || 1;
          const direction = { x: dx / length, y: dy / length };

          // Scale rotation based on movement **only**
          const speedMultiplier = 4.8; // Sensitivity
          const rotationX = lastRotationRef.current.x - direction.y * speedMultiplier;
          const rotationY = lastRotationRef.current.y - direction.x * speedMultiplier;

          touchRotationRef.current = {
            x: rotationX,
            y: rotationY
          };
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
        
            // Adjust radius IMMEDIATELY (UNCHANGED)
            setRadius((prevRadius) => {
              const zoomFactor = pinchDelta * 0.9; // Increase this for more responsiveness
              let newRadius = prevRadius - zoomFactor;
        
              return Math.max(minRadius, Math.min(maxRadius, newRadius));
            });
          }
        
          touchStartDistance.current = newDistance; // Update for next frame
        }
    };

    // Add delay between pinch gestures to stop rotation and fast-paced pinching (UNCHANGED)
    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isTouchRotatingRef.current = false; // Reset rotation tracking when touch ends
      }
      if (e.touches.length < 2) { 
        if (isPinchingRef.current) {
          clearTimeout(pinchTimeoutRef.current);
          pinchTimeoutRef.current = setTimeout(() => {
            isPinchingRef.current = false;
            touchStartDistance.current = null; // Reset stored distance
          }, 150); // Shorter timeout for faster pinch reset
        }

        pinchCooldownRef.current = true; 
        setTimeout(() => {
          pinchCooldownRef.current = false;
        }, 200); // Lower cooldown threshold

        touchStartDistance.current = null; 
      }
    };
      
    // Add event listeners
    window.addEventListener("wheel", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      // Cleanup event listeners
      window.removeEventListener("wheel", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [minRadius, maxRadius, isDragging, isNotDesktop, IS_DESKTOP, IS_TABLET, currentWidth, currentHeight]);

  useFrame((_, delta) => {
    if (isDragging) return; // Stop updating during drag
    if (IS_DESKTOP && !IS_TABLET) {
      // DESKTOP: Cursor-based movement
      targetX = (lastCursorPositionRef.current.y - dragOffset.current.y) * Math.PI * 0.25;
      targetY = (lastCursorPositionRef.current.x - dragOffset.current.x) * Math.PI * 0.5;
    } else if (IS_TABLET && !IS_DESKTOP) {
      // MOBILE: Use touch velocity-based rotation
      targetX = -(touchRotationRef.current.x - yOffset) * 0.20;  // Adjust Y rotation for offset
      targetY = -(touchRotationRef.current.y - xOffset) * 0.35;  // Adjust X rotation for offset  
    } else {
      // MOBILE: Use touch velocity-based rotation
      targetX = -(touchRotationRef.current.x - yOffset) * 0.10;  // Adjust Y rotation for offset
      targetY = -(touchRotationRef.current.y - xOffset) * 0.17;  // Adjust X rotation for offset  
    }

    // **Improve damping for snappier response**
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

    // 🔹 Smooth desktop wheel zoom via spring → only on desktop
    if (IS_DESKTOP && !IS_TABLET) {
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      const omega = 12.0; // spring stiffness

      const r = radiusRef.current;
      const target = zoomTargetRef.current ?? r;
      let v = zoomVelRef.current;
      const x = r - target;

      // critically-damped
      const a = -2 * omega * v - (omega * omega) * x;
      v += a * delta;
      let next = r + v * delta;

      next = clamp(next, minRadius, maxRadius);

      if (Math.abs(next - radiusRef.current) > 0.001) {
        radiusRef.current = next;
        setRadius(next);
      }
      zoomVelRef.current = v;
    }

    // 🔸 Touch-only: if rotating and a dot tooltip is open, auto-hide in ~2s unless tapped again
    if (!IS_DESKTOP && isTouchRotatingRef.current && hoveredDot) {
      const rx = touchRotationRef.current.x;
      const ry = touchRotationRef.current.y;
      const dx = rx - lastRotSampleRef.current.x;
      const dy = ry - lastRotSampleRef.current.y;
      const moved = (dx * dx + dy * dy) > 0.0001;

      if (moved) {
        lastRotSampleRef.current = { x: rx, y: ry };
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setHoveredDot(null); // hide GamificationGeneral
        }, 2000);
      }
    }

    camera.position.set(0, 0, radiusRef.current);
    camera.lookAt(0, 0, 0);
  });

  const latestEntryId = data[0]?._id;
  const latestPoint = points.find((point) => point._id === latestEntryId);
  const latestEntry = data.find((entry) => entry._id === latestEntryId);

  let percentage = 0;
  // Did better than % of users calculation
  const latestWeight =
    latestEntry
      ? Object.values(latestEntry.weights).reduce((sum, w) => sum + w, 0) /
        Object.keys(latestEntry.weights).length
      : 0;

  // Calculate amount of user with higher weight  
  const usersWithHigherWeight = data.filter((entry) => {
    const averageWeight =
      Object.values(entry.weights).reduce((sum, w) => sum + w, 0) /
      Object.keys(entry.weights).length;
    return averageWeight > latestWeight;
  });

  if (data.length > 0) {
    percentage = Math.round(
      (usersWithHigherWeight.length / data.length) * 100
    );
  }

  const calculatePercentage = (averageWeight) => {
    const usersWithHigherWeight = points.filter(
      (point) => point.averageWeight > averageWeight
    );
    return Math.round((usersWithHigherWeight.length / points.length) * 100);
  };
      
  // Determine proximity to viewport edges
  const calculateViewportProximity = (x, y) => {
    const width  = window.innerWidth;
    const height = window.innerHeight;

    // Vertical thresholds (unchanged)
    const verticalEdgeThreshold   = isSmallScreen ? 100 : 150;
    const horizontalEdgeThreshold = 300;

    // 🔹 Left threshold: wider on mobile (e.g., 60% of width vs 40% on desktop)
    const LEFT_PCT_MOBILE  = 0.60; // feel free to tweak 0.55–0.70
    const LEFT_PCT_DESKTOP = 0.40;

    const leftThreshold = width * (IS_MOBILE ? LEFT_PCT_MOBILE : LEFT_PCT_DESKTOP);

    // Mid band (unchanged)
    const midLeftThreshold  = width * 0.4;
    const midRightThreshold = width * 0.6;

    // Edges
    const isTop    = y < verticalEdgeThreshold;
    const isBottom = y > height - verticalEdgeThreshold;
    const isLeft   = x < leftThreshold; // uses device-aware threshold
    const isRight  = x > width - horizontalEdgeThreshold;
    const isMidHorizontal = x >= midLeftThreshold && x <= midRightThreshold;

    let newClass = '';
    if (isTop) newClass += ' is-top';
    if (isBottom) newClass += ' is-bottom';
    if (isLeft) newClass += ' is-left';
    if (isRight) newClass += ' is-right';
    if (isMidHorizontal) newClass += ' is-mid';

    return newClass.trim();
  };

  const handleHoverStart = (dot, event) => {
    if (isTouchRotatingRef.current || isDragging || isPinchingRef.current) return; // Prevent hover if dragging or pinching
    const { clientX, clientY } = event.nativeEvent;
    
    const proximityClass = calculateViewportProximity(clientX, clientY);
    setViewportClass(proximityClass);

    // 🔸 If user explicitly opened by tap on touch, cancel any pending auto-hide
    if (!IS_DESKTOP) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    // Ensure we store full dot details (including dotId)
    setHoveredDot({
      dotId: dot._id, // Store unique dot identifier
      percentage: calculatePercentage(dot.averageWeight),
      color: dot.color,
    });
  };
      
  const handleHoverEnd = () => {
    if (isTouchRotatingRef.current || isDragging || isPinchingRef.current) return;
    setHoveredDot(null);
    setViewportClass(''); // Reset the class on hover end
  };
            
  useEffect(() => {
    return () => {
      if (hoverCheckInterval.current) {
        clearInterval(hoverCheckInterval.current);
        cancelAnimationFrame(hoverCheckInterval.current);
      }
      // clear any pending touch auto-hide timer
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);
   
  return (
      <>
      <Html zIndexRange={[2, 24]} style={{
        pointerEvents: 'none', 
            }}>
          <div className="z-index-respective" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', height: '100vh', pointerEvents: 'none'}}>
          <CompleteButton/>
          </div>
        </Html>
      <group ref={groupRef}>
        {points.map((point, index) => {
          const isLatestPoint = point._id === latestEntryId;
    
          return (
            <mesh
              key={index}
              position={point.position}
              onPointerOver={(event) => {
                event.stopPropagation();
            
                // Trigger hover start logic only if it is not the latest point
                if (!isLatestPoint) {
                  handleHoverStart(point, event);
                }
              }}
              onPointerOut={(event) => {
                event.stopPropagation();
            
                // Trigger hover end logic only if it is not the latest point
                if (!isLatestPoint) {
                  handleHoverEnd(point);
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (isTouchRotatingRef.current || isDragging || isPinchingRef.current) return; // Prevent hover if dragging or pinching
                
                // Simulate hover start logic on click for touch-based devices
                if (!isLatestPoint) {
                  handleHoverStart(point, event);
                }
              }}
            >
              <sphereGeometry args={[1.4, 48, 48]} />
              <meshStandardMaterial color={point.color} />
            </mesh>
          );
        })}
    
        {latestPoint && (
          <Html
            position={latestPoint.position}
            center
            zIndexRange={[110, 130]} // fixed z-index for components
            style={{
              pointerEvents: 'none',
              '--offset-px': `${offsetPx}px`,
            }}
          >
            <div>
              <GamificationPersonalized userData={latestEntry} percentage={percentage} color={latestPoint.color}/>
            </div>
          </Html>
        )}
    
            {hoveredDot && (() => {
            const hoveredData = points.find(dot => dot._id === hoveredDot.dotId);
            if (!hoveredData) return null;

            return (
              <Html
                position={hoveredData.position}
                center
                zIndexRange={[120, 180]}
                style={{
                  pointerEvents: "none",
                  '--offset-px': `${offsetPx}px`,
                }}
                className={`${viewportClass}`}
              >
                <div>
                  <GamificationGeneral 
                    dotId={hoveredDot.dotId} // Pass dotId for unique caching
                    percentage={hoveredDot.percentage} 
                    color={hoveredDot.color} 
                  />
                </div>
              </Html>
            );
          })()}
      </group></>
    );
};

export default DotGraph;
