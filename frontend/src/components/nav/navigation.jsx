import React, { useState, useEffect } from "react";
import Logo from "../static/left";
import InfoPanel from "./infoPanel.jsx";
import InfoGraph from "./infoGraph.jsx";
import GraphPicker from "./graphPicker";
import { useAppState } from "../../context/appStateContext.tsx";
import DarkModeButton from "./darkmodeToggle.jsx";
import "../../styles/navigation.css";
import "../../styles/info-graph.css";

const DEFAULT_SECTION = "fine-arts";

const Navigation = () => {
  const [open, setOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);

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
    darkMode,
  } = useAppState();

  useEffect(() => {
    setNavPanelOpen?.(open);
  }, [open, setNavPanelOpen]);

  const navClassName = [
    "navigation",
    isPhone && pickerOpen && !open ? "picker-open-mobile" : "",
    !navVisible ? "nav-hidden-mobile" : "",
    open ? "info-open" : "",
  ]
    .join(" ")
    .trim();

  useEffect(() => {
    if (isPhone && !navVisible) setOpen(false);
  }, [isPhone, navVisible]);

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

  const themeDark = !!darkMode;
  const navChromeDark = open ? false : themeDark;
  const xButtonDark = themeDark;

  const postCompleteOnly = hasCompletedSurvey && !observerMode;

  return (
    <>
      <nav className={navClassName}>
        <div className="left">
          <Logo />
        </div>

        <div className="nav-right">
          {open ? (
            <div
              className={["level-two", xButtonDark ? "is-dark" : ""]
                .join(" ")
                .trim()}
            >
              <button
                className={["info-close", xButtonDark ? "is-dark" : ""]
                  .join(" ")
                  .trim()}
                onClick={() => setOpen(false)}
                aria-label="Close info panel"
              >
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
              {/* LEVEL ONE — top stack (only when info is CLOSED) */}
              <div
                className={[
                  "level-one",
                  !burgerOpen ? "burger-closed" : "",
                  navChromeDark ? "is-dark" : "",
                ]
                  .join(" ")
                  .trim()}
              >
                {/* Primary button */}
                <button
                  className={["nav-toggle", navChromeDark ? "is-dark" : ""]
                    .join(" ")
                    .trim()}
                  onClick={() => setOpen(true)}
                  aria-expanded={false}
                  aria-controls="info-overlay"
                >
                  {"What's the Idea?"}
                </button>

                {/* Theme toggle — same button style as nav-toggle, no wrapper */}
                {<DarkModeButton />}
              </div>

              {/* LEVEL TWO — vertical stack (only when info is CLOSED) */}
              <div
                className={[
                  "level-two",
                  navChromeDark ? "is-dark" : "",
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
                        navChromeDark ? "is-dark" : "",
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
                    navChromeDark ? "is-dark" : "",
                  ]
                    .join(" ")
                    .trim()}
                  onClick={() => setBurgerOpen((v) => !v)}
                  aria-pressed={burgerOpen}
                  aria-controls="nav-tools"
                  aria-label={burgerOpen ? "Hide options" : "Show options"}
                >
                  {!burgerOpen ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
                      <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      <InfoPanel open={open} onClose={() => setOpen(false)}>
        <InfoGraph />
      </InfoPanel>
    </>
  );
};

export default Navigation;
