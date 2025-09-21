// src/components/nav-bottom/ModeToggle.jsx
import React, { useMemo } from "react";
import { useGraph } from "../../context/graphContext.tsx";
import { avgWeightOf } from "../../utils/useRelativePercentiles.ts";
import { useAbsoluteScore } from "../../utils/useAbsoluteScore.ts";
import '../../styles/nav-bottom.css';

export default function ModeToggle() {
  const { mode, setMode, data, myEntryId } = useGraph();

  const poolValues = useMemo(() => (Array.isArray(data) ? data.map(avgWeightOf) : []), [data]);
  const myIndex = useMemo(() => (myEntryId ? data.findIndex(d => d._id === myEntryId) : -1), [data, myEntryId]);
  const myValue = myIndex >= 0 ? avgWeightOf(data[myIndex]) : undefined;

  const relFeedback = useMemo(() => {
    if (!poolValues.length || !Number.isFinite(myValue)) return "Ranking mode";
    const pool = poolValues.length - 1;
    const countBelow = poolValues.reduce((acc, v, i) => (i === myIndex ? acc : acc + (v < myValue ? 1 : 0)), 0);
    return `Ahead of ${countBelow} of ${Math.max(0, pool)}`;
  }, [poolValues, myIndex, myValue]);

  const { getForId: getAbsForId } = useAbsoluteScore(data, { decimals: 0 });
  const absFeedback = useMemo(() => {
    if (myIndex < 0) return "Score: —/100";
    const score = getAbsForId(myEntryId);
    return `Score: ${score}/100`;
  }, [getAbsForId, myEntryId, myIndex]);

  const isAbsolute = mode === "absolute";

  const flipModeAndOpenPanel = (nextMode) => {
    setMode(nextMode);
    // Nudge the personalized panel to open
    window.dispatchEvent(new CustomEvent('gp:open-personalized'));
  };

  const onToggle = () => flipModeAndOpenPanel(isAbsolute ? "relative" : "absolute");

  return (
    <div className="mode-toggle-wrap">
      <div
        role="switch"
        aria-checked={isAbsolute}
        tabIndex={0}
        className="mode-toggle-switch"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
          if (e.key === "ArrowLeft")  flipModeAndOpenPanel("relative");
          if (e.key === "ArrowRight") flipModeAndOpenPanel("absolute");
        }}
        title={isAbsolute ? "Switch to Relative" : "Switch to Absolute"}
      >
        <div className={`mode-toggle-thumb ${isAbsolute ? "absolute" : "relative"}`} />
        <div className={`mode-toggle-label ${!isAbsolute ? "active" : ""}`}>Rankings</div>
        <div className={`mode-toggle-label ${isAbsolute ? "active" : ""}`}>Scores</div>
      </div>
    </div>
  );
}
