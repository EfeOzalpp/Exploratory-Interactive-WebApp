import React, { useEffect, useRef, useState } from "react";
import RadialBackground from "../components/static/radialBackground";

const TRANSITION_MS = 240; // keep in sync with CSS

const InfoPanel = ({ open, onClose, children }) => {
  const [mounted, setMounted] = useState(open);   // controls render/unrender
  const [visible, setVisible] = useState(false);  // drives CSS animation
  const panelRef = useRef(null);
  const closeTimer = useRef(null);

  // mount → fade in, close → fade out then unmount
  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true)); // allow initial paint
    } else {
      setVisible(false);
      closeTimer.current = setTimeout(() => setMounted(false), TRANSITION_MS);
    }
    return () => closeTimer.current && clearTimeout(closeTimer.current);
  }, [open]);

  // lock body scroll only while visible
  useEffect(() => {
    if (!mounted || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted, visible]);

  // Esc to close
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`info-overlay ${visible ? "is-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!visible}
      aria-labelledby="info-title"
      onClick={onClose}
    >
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
