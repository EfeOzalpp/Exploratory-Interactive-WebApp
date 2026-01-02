// src/components/nav-bottom/ModeToggle.jsx
import React, { useMemo } from "react";

import { useAppState } from '../../app-context/appStateContext.tsx';
import { avgWeightOf } from '../../utils-hooks/useRelativePercentiles.ts';
import { useAbsoluteScore } from '../../utils-hooks/useAbsoluteScore.ts';
import '../../static-assets/styles/nav-bottom.css';

export default function ModeToggle() {
  const { mode, setMode, data, myEntryId, observerMode } = useAppState();

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

  const flipModeAndMaybeSpotlight = (nextMode) => {
    setMode(nextMode);

    if (!observerMode) {
      // keep opening the personalized panel as before
      if (canPersonalize) {
        window.dispatchEvent(new CustomEvent('gp:open-personalized'));
      }
      return;
    }

    // OBSERVER: Defer spotlight dispatch until DotGraph has re-rendered & Html mounted
    // Double rAF pushes us past layout/paint of the new mode so points exist.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('gp:observer-spotlight-request', {
          detail: {
            durationMs: 3000,      // keep GamificationGeneral open ~3s
            fakeMouseXRatio: 0.25, // 25% from left to bias left/center
            fakeMouseYRatio: 0.5   // vertically centered
          }
        }));
      });
    });
  };

  const onToggle = () => flipModeAndMaybeSpotlight(isAbsolute ? "relative" : "absolute");

  // Context-aware title
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
        <div className={`mode-toggle-label ${!isAbsolute ? "active" : ""}`}>Versus</div>
        <div className={`mode-toggle-label ${isAbsolute ? "active" : ""}`}>Solo</div>
      </div>
    </div>
  );
}
