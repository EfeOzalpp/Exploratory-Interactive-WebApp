import React, { useEffect, useRef } from "react";
import RadialBackground from "../components/static/radialBackground"; // adjust path if needed

/**
 * Full-viewport overlay panel
 * - Locks body scroll while open
 * - Closes on overlay click or Escape
 */
const InfoPanel = ({ open, onClose, children }) => {
  const panelRef = useRef(null);

  // lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // focus + Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="info-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-title"
      onClick={onClose}
    >
      {/* radial bg lives behind the panel */}
      <RadialBackground />

      <div
        className="info-panel"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="info-body">{children}</div>
      </div>
    </div>
  );
};

export default InfoPanel;
