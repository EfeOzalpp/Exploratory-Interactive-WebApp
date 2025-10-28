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
    if (typeof window !== "undefined") {
      window.addEventListener("gp:menu-open", onMenuOpen);
      return () => window.removeEventListener("gp:menu-open", onMenuOpen);
    }
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
    setNavPanelOpen,
    navVisible,
    darkMode,            // ← EdgeModeHint controls this
  } = useGraph();

  // keep context in sync with this component's "What's the Idea?" panel
  useEffect(() => {
    setNavPanelOpen?.(open);
  }, [open, setNavPanelOpen]);

  // Hide the entire nav on phones when navVisible=false
  const navClassName = [
    "navigation",
    isPhone && pickerOpen && !open ? "picker-open-mobile" : "",
    !navVisible ? "nav-hidden-mobile" : "",
    open ? "info-open" : "", // used by CSS to hide side menu while info panel is open
  ]
    .join(" ")
    .trim();

  useEffect(() => {
    if (isPhone && !navVisible) setOpen(false);
  }, [isPhone, navVisible]);

  // still collapse observer if survey completed
  useEffect(() => {
    if (hasCompletedSurvey && observerMode) setObserverMode(false);
  }, [hasCompletedSurvey, observerMode, setObserverMode]);

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

  // THEME: use EdgeModeHint-controlled darkMode, but force LIGHT while info panel is open
  const isDark = open ? false : !!darkMode;

  const postCompleteOnly = hasCompletedSurvey && !observerMode;

  return (
    <>
      <nav className={navClassName}>
        <div className="left">
          <Logo />
        </div>

        <div className="nav-right">
          {/* When the info panel is OPEN, render ONLY a single “x” button and nothing else */}
          {open ? (
            <div className={["level-two", isDark ? "is-dark" : ""].join(" ").trim()}>
              <button
                className={["info-close", isDark ? "is-dark" : ""].join(" ").trim()}
                onClick={() => setOpen(false)}
                aria-label="Close info panel"
                aria-pressed="true"
              >
                {/* SVG X icon, same visual weight as + / - */}
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              {/* LEVEL ONE — collapsible (only when info is CLOSED) */}
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
                  className={["nav-toggle", isDark ? "is-dark" : ""].join(" ").trim()}
                  onClick={() => setOpen(true)}
                  aria-expanded={false}
                  aria-controls="info-overlay"
                >
                  {"What's the Idea?"}
                </button>
              </div>

              {/* LEVEL TWO — vertical stack (only when info is CLOSED) */}
              <div
                className={[
                  "level-two",
                  isDark ? "is-dark" : "",
                  postCompleteOnly ? "is-post-complete" : "",
                ]
                  .join(" ")
                  .trim()}
              >
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
                      {observerMode ? "Back" : "Explore Answers"}
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
            </>
          )}
        </div>
      </nav>

      {/* Info panel */}
      <InfoPanel open={open} onClose={() => setOpen(false)}>
        <InfoGraph />
      </InfoPanel>
    </>
  );
};

export default Navigation;
