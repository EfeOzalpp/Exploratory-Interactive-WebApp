// src/cues/EdgeModeHint.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HintBubble from "../tooltip/hintBubble";
import { useGraph } from "../context/graphContext.tsx";

const ROOT_ID = "gp-edge-cue-hint-root";

/**
 * EdgeModeHint (JSX)
 * - Listens to 'gp:edge-cue' and 'gp:edge-hint-request'
 * - Shows a clickable bubble for exactly 3s (no reset while visible)
 * - Clicking toggles GraphContext.darkMode
 */
export default function EdgeModeHint() {
  const { darkMode, setDarkMode } = useGraph();

  const [mount, setMount] = useState(null);
  const [show, setShow] = useState(false);
  const [text, setText] = useState(darkMode ? "Dark mode" : "Light mode");

  // Refs for stable behavior
  const timerRef = useRef(null);          // active hide timer
  const showRef = useRef(false);          // mirror of show to avoid stale closure
  const darkModeRef = useRef(darkMode);   // latest theme for reveal text

  // Keep refs in sync
  useEffect(() => { showRef.current = show; }, [show]);
  useEffect(() => {
    darkModeRef.current = darkMode;
    if (showRef.current) setText(darkMode ? "Dark mode" : "Light mode");
  }, [darkMode]);

  // Ensure portal root
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

  // 3s one-shot reveal (ignore if already visible)
  const reveal3s = () => {
    if (showRef.current) return;
    setText(darkModeRef.current ? "Dark mode" : "Light mode");
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShow(false);
      timerRef.current = null;
    }, 3000);
  };

  // Install listeners ONCE (don’t tie to darkMode)
  useEffect(() => {
    const onEdgeCue = () => reveal3s();
    const onHintReq = () => reveal3s();

    window.addEventListener("gp:edge-cue", onEdgeCue);
    window.addEventListener("gp:edge-hint-request", onHintReq);
    return () => {
      window.removeEventListener("gp:edge-cue", onEdgeCue);
      window.removeEventListener("gp:edge-hint-request", onHintReq);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // ← important

  if (!mount || !show) return null;

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !darkModeRef.current;
    setDarkMode(next);
    setText(next ? "Dark mode" : "Light mode");
    // let the existing timer close the bubble; do NOT reset it here
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") toggle(e);
  };

  return createPortal(
    <div
      className="cue-bubble"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 4,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggle}
        onKeyDown={onKeyDown}
        style={{ all: "unset", cursor: "pointer", display: "inline-block" }}
      >
        <HintBubble
          show
          placement="top"
          className={`edge-mode-hint ${darkMode ? "is-dark" : "is-light"}`}
        >
          <h4>{text}</h4>
          <p style={{ margin: 2, opacity: 0.8}}>
            {darkMode ? "Click for light" : "Click for dark"}
          </p>
        </HintBubble>
      </button>
    </div>,
    mount
  );
}
