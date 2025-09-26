// nav/Navigation.jsx
import React, { useState, useEffect } from "react";
import Logo from "../static/left";
import InfoPanel from "./infoPanel.jsx";
import InfoGraph from "./infoGraph.jsx";
import GraphPicker from "./graphPicker";
import { useGraph } from "../../context/graphContext.tsx";
import "../../styles/navigation.css";
import "../../styles/info-graph.css";

const DEFAULT_SECTION = "fine-arts";

const Navigation = () => {
  const [open, setOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(true);

  // Track GraphPicker open + whether we’re on phone (<=768px)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(
    typeof window !== "undefined"
      ? window.matchMedia?.("(max-width: 768px)")?.matches
      : false
  );

  useEffect(() => {
    const onMenuOpen = (e) => setPickerOpen(!!e?.detail?.open);
    window.addEventListener("gp:menu-open", onMenuOpen);
    return () => window.removeEventListener("gp:menu-open", onMenuOpen);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = (ev) => setIsPhone(ev.matches);
    setIsPhone(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, []);

  const {
    section,
    setSection,
    isSurveyActive,
    hasCompletedSurvey,
    observerMode,
    setObserverMode,
    setSurveyActive,
    openGraph,
    closeGraph,
  } = useGraph();

  useEffect(() => {
    if (hasCompletedSurvey && observerMode) setObserverMode(false);
  }, [hasCompletedSurvey, observerMode, setObserverMode]);

  const handleFeedbackClick = () => {
    window.open(
      "https://docs.google.com/document/d/1lBKllYBu-OS34sMtGmJuJjTZlcN09QRPo5EdhCTQueM/edit?usp=sharing",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const showPicker = (observerMode || hasCompletedSurvey) && !isSurveyActive;

  const toggleObserverMode = () => {
    const next = !observerMode;
    setObserverMode(next);
    if (next) {
      if (!section) setSection(DEFAULT_SECTION);
      setSurveyActive(false);
      openGraph();
    } else {
      if (!hasCompletedSurvey) closeGraph();
    }
  };

  const showObserverButton = !hasCompletedSurvey || observerMode;

  // class modifiers
  const isDark = observerMode || hasCompletedSurvey;
  const postCompleteOnly = hasCompletedSurvey && !observerMode;

  // IMPORTANT: fade only when picker is open on phone AND the info panel is NOT open
  const navClassName = [
    "navigation",
    isPhone && pickerOpen && !open ? "picker-open-mobile" : "",
  ]
    .join(" ")
    .trim();

  return (
    <>
      <nav className={navClassName}>
        <div className="left">
          <Logo />
        </div>

        <div className="nav-right">
          {/* LEVEL ONE — collapsible */}
          <div
            className={[
              "level-one",
              burgerOpen ? "burger-closed" : "",
              isDark ? "is-dark" : "",
            ]
              .join(" ")
              .trim()}
          >
            <button
              className={[
                "nav-toggle",
                open ? "active" : "",
                isDark ? "is-dark" : "",
              ]
                .join(" ")
                .trim()}
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-controls="info-overlay"
            >
              {open ? (
                <>
                  <span className="nav-toggle-icon" aria-hidden>
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                    >
                      <polyline
                        points="15 18 9 12 15 6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>Return</span>
                </>
              ) : (
                "What's the Idea?"
              )}
            </button>

            <button
              className={["feedback", isDark ? "is-dark" : ""].join(" ").trim()}
              onClick={handleFeedbackClick}
            >
              Leave Your Thoughts
            </button>
          </div>

          {/* LEVEL TWO — vertical stack */}
          <div
            className={[
              "level-two",
              isDark ? "is-dark" : "",
              postCompleteOnly ? "is-post-complete" : "",
            ]
              .join(" ")
              .trim()}
          >
            {/* Nav divider doubles as horizontal container */}
            <div className="nav-divider">
              {showPicker && (
                <div className="graph-picker">
                  <GraphPicker value={section} onChange={setSection} />
                </div>
              )}

              {showObserverButton && (
                <button
                  className={[
                    "observe-results",
                    observerMode ? "active" : "",
                    isDark ? "is-dark" : "",
                  ]
                    .join(" ")
                    .trim()}
                  onClick={toggleObserverMode}
                  aria-pressed={observerMode}
                >
                  {observerMode ? "Back" : "Explore Results"}
                </button>
              )}
            </div>

            {/* Burger toggle at the bottom */}
            <button
              type="button"
              className={[
                "burger-toggle",
                burgerOpen ? "open" : "",
                isDark ? "is-dark" : "",
              ]
                .join(" ")
                .trim()}
              onClick={() => setBurgerOpen((v) => !v)}
              aria-pressed={burgerOpen}
              aria-controls="nav-tools"
              aria-label={burgerOpen ? "Hide options" : "Show options"}
            >
              {burgerOpen ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      <InfoPanel open={open} onClose={() => setOpen(false)}>
        <InfoGraph />
      </InfoPanel>
    </>
  );
};

export default Navigation;
