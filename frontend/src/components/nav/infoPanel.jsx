// InfoPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import RadialBackground from "../static/radialBackground";

const TRANSITION_MS = 240;
const MENU_EVT = "gp:menu-open";

const InfoPanel = ({ open, onClose, children }) => {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  const closeTimer = useRef(null);

  // helper: broadcast hover state
  const sendHover = useCallback((hover) => {
    window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover } }));
  }, []);

  // mount → fade in, close → fade out then unmount
  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      closeTimer.current = setTimeout(() => setMounted(false), TRANSITION_MS);
      // ensure hover is cleared when panel closes
      sendHover(false);
    }
    return () => closeTimer.current && clearTimeout(closeTimer.current);
  }, [open, sendHover]);

  // announce open/close to lock orbit (useOrbit listens to "gp:menu-open")
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MENU_EVT, { detail: { open: !!visible } }));
    return () => {
      // on unmount or effect re-run, make sure we don't leave it locked
      window.dispatchEvent(new CustomEvent(MENU_EVT, { detail: { open: false } }));
    };
  }, [visible]);

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

  // pointer enter/leave → broadcast hover (only while visible)
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onEnter = () => visible && sendHover(true);
    const onLeave = () => sendHover(false);

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    if (!visible) sendHover(false);

    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [visible, sendHover]);

  // stop wheel/pinch/touch from bubbling to window (extra safety)
  useEffect(() => {
    if (!visible) return;
    const el = overlayRef.current;
    if (!el) return;

    const stopProp = (e) => e.stopPropagation();
    el.addEventListener("wheel", stopProp, { passive: true });
    el.addEventListener("touchstart", stopProp, { passive: true });
    el.addEventListener("touchmove", stopProp, { passive: true });
    // older Safari pinch events
    el.addEventListener("gesturestart", stopProp);
    el.addEventListener("gesturechange", stopProp);
    el.addEventListener("gestureend", stopProp);

    return () => {
      el.removeEventListener("wheel", stopProp, { passive: true });
      el.removeEventListener("touchstart", stopProp, { passive: true });
      el.removeEventListener("touchmove", stopProp, { passive: true });
      el.removeEventListener("gesturestart", stopProp);
      el.removeEventListener("gesturechange", stopProp);
      el.removeEventListener("gestureend", stopProp);
    };
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      ref={overlayRef}
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
