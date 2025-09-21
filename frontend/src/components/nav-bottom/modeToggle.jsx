// src/components/nav-bottom/ModeToggle.jsx
import React, { useMemo, useEffect, useRef } from "react";
import { useGraph } from "../../context/graphContext.tsx";
import { avgWeightOf } from "../../utils/useRelativePercentiles.ts";
import { useAbsoluteScore } from "../../utils/useAbsoluteScore.ts";
import '../../styles/nav-bottom.css';

export default function ModeToggle() {
  const { mode, setMode, data, myEntryId, observerMode } = useGraph();

  // Pool + personal metrics (used for nicer titles when not observing)
  const poolValues = useMemo(
    () => (Array.isArray(data) ? data.map(avgWeightOf) : []),
    [data]
  );
  const myIndex = useMemo(
    () => (myEntryId ? data.findIndex(d => d._id === myEntryId) : -1),
    [data, myEntryId]
  );
  const myValue = myIndex >= 0 ? avgWeightOf(data[myIndex]) : undefined;

  const relFeedback = useMemo(() => {
    if (!poolValues.length || !Number.isFinite(myValue)) return "Rankings";
    const pool = poolValues.length - 1;
    const countBelow = poolValues.reduce(
      (acc, v, i) => (i === myIndex ? acc : acc + (v < myValue ? 1 : 0)),
      0
    );
    return `Ahead of ${countBelow} of ${Math.max(0, pool)}`;
  }, [poolValues, myIndex, myValue]);

  const { getForId: getAbsForId } = useAbsoluteScore(data, { decimals: 0 });
  const absFeedback = useMemo(() => {
    if (myIndex < 0) return "Scores";
    const score = getAbsForId(myEntryId);
    return `Score: ${score}/100`;
  }, [getAbsForId, myEntryId, myIndex]);

  const isAbsolute = mode === "absolute";
  const canPersonalize = !observerMode && myIndex >= 0;

  // 🔑 Run only once on component mount to force initial mode = "absolute"
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      if (mode !== "absolute") {
        setMode("absolute");
      }
    }
  }, [mode, setMode]);

  const flipModeAndMaybeSpotlight = (nextMode) => {
    setMode(nextMode);

    if (canPersonalize) {
      window.dispatchEvent(new CustomEvent('gp:open-personalized'));
    }

    if (observerMode) {
      window.dispatchEvent(new CustomEvent('gp:observer-spotlight-request', {
        detail: {
          durationMs: 3000,
          fakeMouseXRatio: 0.25,
          fakeMouseYRatio: 0.5
        }
      }));
    }
  };

  const onToggle = () => flipModeAndMaybeSpotlight(isAbsolute ? "relative" : "absolute");

  const titleWhenRelative = observerMode ? "Switch to Rankings" : relFeedback;
  const titleWhenAbsolute = observerMode ? "Switch to Scores"   : absFeedback;
  const title = isAbsolute ? titleWhenRelative : titleWhenAbsolute;

  return (
    <div className="mode-toggle-wrap">
      <div
        role="switch"
        aria-checked={isAbsolute}
        aria-label="Toggle visualization mode"
        tabIndex={0}
        className={`mode-toggle-switch${observerMode ? " is-observing" : ""}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
          if (e.key === "ArrowLeft")  flipModeAndMaybeSpotlight("relative");
          if (e.key === "ArrowRight") flipModeAndMaybeSpotlight("absolute");
        }}
        title={title}
      >
        <div className={`mode-toggle-thumb ${isAbsolute ? "absolute" : "relative"}`} />
        <div className={`mode-toggle-label ${!isAbsolute ? "active" : ""}`}>Rankings</div>
        <div className={`mode-toggle-label ${isAbsolute ? "active" : ""}`}>Scores</div>
      </div>
    </div>
  );
}
