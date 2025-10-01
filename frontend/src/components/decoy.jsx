import React, { useEffect, useRef } from "react";
import q5 from "q5";

/**
 * Fullscreen decorative q5 overlay that is 100% "see-through" to input.
 * - Makes the actual <canvas> ignore hit-testing
 * - Guards against React 18 StrictMode double-mount
 * - Resizes on window changes
 */
const Decoy = () => {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight, p.P2D);

        // Make the actual canvas non-interactive and correctly positioned
        if (p.canvas) {
          Object.assign(p.canvas.style, {
            pointerEvents: "none",
            touchAction: "auto",
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
          });
        }

        p.noStroke();
        p.fill("rgba(0, 150, 255, 0.5)");
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        p.clear(); // transparent background
        p.ellipse(p.width / 2, p.height / 2, 50, 50);
      };
    };

    // Singleton guard (prevents ghost canvases in dev StrictMode)
    if (!instanceRef.current && containerRef.current) {
      instanceRef.current = new q5(sketch, containerRef.current);
    }

    return () => {
      try {
        instanceRef.current?.remove();
      } finally {
        instanceRef.current = null;
        if (containerRef.current) {
          // ensure no lingering DOM nodes
          containerRef.current.innerHTML = "";
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="decoy-container"
      style={{
        position: "absolute",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none", // parent ignores input
        touchAction: "auto",
        zIndex: 0, // keep low in the stack so real UI can sit above
      }}
      aria-hidden="true"
    />
  );
};

export default Decoy;
