// src/components/nav-bottom/ModeToggle.jsx
import React from "react";
import { useGraph } from "../../context/graphContext.tsx";

const tabStyle = (active) => ({
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 12,
  lineHeight: 1,
  border: "1px solid rgba(0,0,0,0.08)",
  background: active ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.9)",
  color: active ? "#fff" : "#111",
  boxShadow: active
    ? "0 4px 14px rgba(0,0,0,0.25)"
    : "0 2px 10px rgba(0,0,0,0.12)",
  cursor: "pointer",
  transition: "all 120ms ease",
});

export default function ModeToggle() {
  const { mode, setMode } = useGraph();

  return (
    <div
      className="mode-toggle"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        zIndex: 40,
        userSelect: "none",
        backdropFilter: "blur(8px)",
      }}
      role="tablist"
      aria-label="Visualization mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "relative"}
        onClick={() => setMode("relative")}
        style={tabStyle(mode === "relative")}
        title="Compare to others (rank/position)"
      >
        Relative
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "absolute"}
        onClick={() => setMode("absolute")}
        style={tabStyle(mode === "absolute")}
        title="Your own score (0–100)"
      >
        Absolute
      </button>
    </div>
  );
}
