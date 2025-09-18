// src/components/ui/HintBubble.jsx
import React from "react";
import clsx from "clsx";
import '../styles/hint-bubble.css';
/**
 * HintBubble
 * - Parent container should be position: relative (you already have .question-part--rel).
 */
export default function HintBubble({
  show = false,
  placement = "left", // "left" | "right" | "top" | "bottom"
  offsetX = 0,
  offsetY = 0,
  className,
  children,
  ...rest
}) {
  return (
    <div
      aria-hidden={!show}
      className={clsx(
        "question-hint-bubble",
        "hint-bubble",
        `is-${placement}`,
        show ? "show" : "hide",
        className
      )}
      style={{
        // nudge helpers
        "--offset-x": `${offsetX}px`,
        "--offset-y": `${offsetY}px`,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
