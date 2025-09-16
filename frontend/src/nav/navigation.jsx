// nav/Navigation.jsx
import React, { useState, useEffect } from "react";
import Logo from "../components/static/left";
import InfoPanel from "./infoPanel.jsx";
import InfoGraph from "./infoGraph.jsx";
import GraphPicker from "./graphPicker";
import { useGraph } from "../context/graphContext.tsx";
import "../styles/navigation.css";
import "../styles/info-graph.css";

const DEFAULT_SECTION = "fine-arts";

const Navigation = () => {
  const [open, setOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(true);

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
  const isDark = observerMode || hasCompletedSurvey; // dark if either is true
  const postCompleteOnly = hasCompletedSurvey && !observerMode; // completed, but not observing

  return (
    <>
      <nav className="navigation">
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
                  <span>Go Back</span>
                </>
              ) : (
                "What's the Idea?"
              )}
            </button>

            <button
              className={["feedback", isDark ? "is-dark" : ""]
                .join(" ")
                .trim()}
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
                  {observerMode ? "Back" : "Observe All Results"}
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
              <span
                className={`burger-icon ${burgerOpen ? "is-closed" : "is-open"}`}
                aria-hidden
              >
                {/* plus */}
                <svg
                  className="icon-plus"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                >
                  <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
                </svg>
                {/* minus */}
                <svg
                  className="icon-minus"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                >
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
                </svg>
              </span>
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
