// src/components/ui/HintBubble.jsx
import React from "react";
import '../styles/hint-bubble.css';

export default function HintBubble({
  show = false,
  placement = "left", // "left" | "right" | "top" | "bottom"
  offsetX = 0,
  offsetY = 0,
  className,
  children,
  ...rest
}) {
  const classes = [
    "question-hint-bubble",
    "hint-bubble",
    `is-${placement}`,
    show ? "show" : "hide",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      aria-hidden={!show}
      className={classes}
      style={{ "--offset-x": `${offsetX}px`, "--offset-y": `${offsetY}px` }}
      {...rest}
    >
      {children}
    </div>
  );
}
