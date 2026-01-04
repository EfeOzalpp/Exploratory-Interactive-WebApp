// navigation/CityOverlay.jsx
import React from "react";
import { EngineHost } from "../canvas-engine/EngineHost.tsx";

export default function CityOverlay({ open, liveAvg = 0.5, allocAvg }) {
  return (
    <div
      id="city-overlay-root"
      className={`city-overlay ${open ? "open" : ""}`}
      aria-hidden={!open}
    >
      <div id="city-canvas-root" className="city-canvas-host" />

      <EngineHost
        id="city"
        open={open}
        liveAvg={liveAvg}
        allocAvg={allocAvg ?? liveAvg}
      />
    </div>
  );
}
