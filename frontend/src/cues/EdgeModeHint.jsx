// src/components/ui/EdgeModeHint.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HintBubble from "../tooltip/hintBubble";

const ROOT_ID = "gp-edge-cue-hint-root";

export default function EdgeModeHint() {
  const [mount, setMount] = useState(null);

  // latched = true → LIGHT
  const getInitial = () => {
    if (typeof window === "undefined") return true;
    return window.__gpEdgeLatched == null ? true : !!window.__gpEdgeLatched;
  };
  const [latchedOn, setLatchedOn] = useState(getInitial);

  // ephemeral visibility for the bubble
  const [show, setShow] = useState(false);
  const [text, setText] = useState(latchedOn ? "Light mode" : "Dark mode");
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    setMount(root);
  }, []);

  const flash = (nextLatched) => {
    setText(nextLatched ? "Light mode" : "Dark mode");
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // keep it visible long enough to notice; tweak as you like
    timerRef.current = setTimeout(() => setShow(false), 1800);
  };

  useEffect(() => {
    // Canonical: reflect state
    const onState = (e) => {
      const { latched } = (e && e.detail) || {};
      if (typeof latched === "boolean") {
        setLatchedOn(!!latched);
        flash(!!latched);
      }
    };

    // Allow the explicit toggle to also flash the hint (state publisher will follow)
    const onToggle = () => {
      // no local toggling here — state publisher will emit gp:edge-cue-state
      setShow(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShow(false), 1800);
    };

    window.addEventListener("gp:edge-cue-state", onState);
    window.addEventListener("gp:edge-cue-toggle", onToggle);
    return () => {
      window.removeEventListener("gp:edge-cue-state", onState);
      window.removeEventListener("gp:edge-cue-toggle", onToggle);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!mount) return null;

  return createPortal(
    <div
      className="cue-bubble"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 4,
        pointerEvents: "none",
      }}
    >
      <HintBubble
        show={show}
        placement="top"
        className={`edge-mode-hint ${latchedOn ? "is-light" : "is-dark"}`}
      >
        <h4 style={{ margin: 0 }}>{text}</h4>
      </HintBubble>
    </div>,
    mount
  );
}
