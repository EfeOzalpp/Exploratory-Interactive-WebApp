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
  const [burgerOpen, setBurgerOpen] = useState(true); // small +/- toggle

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
    if (hasCompletedSurvey && observerMode) {
      setObserverMode(false);
    }
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

  // Shared inline style when observerMode is active
  const darkActiveStyle = observerMode
    ? { backgroundColor: "#292929", color: "#ffffff" }
    : undefined;

  return (
    <>
      <nav className="navigation">
        <div className="left">
          <Logo />
          {showPicker && (
            <div className="graph-picker">
              <GraphPicker value={section} onChange={setSection} />
            </div>
          )}
        </div>

        <div className="nav-right">
          {/* LEVEL ONE — collapsible */}
          <div className={`level-one ${burgerOpen ? "burger-closed" : ""}`}>
            <button
              className={`nav-toggle ${open ? "active" : ""}`}
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-controls="info-overlay"
              style={darkActiveStyle} // <-- dark style when active
            >
              {open ? "< Close This Tab" : "What's the Idea?"}
            </button>

            <button
              className="feedback"
              onClick={handleFeedbackClick}
              style={darkActiveStyle} // <-- dark style when active
            >
              Leave Your Thoughts
            </button>
          </div>

          {/* LEVEL TWO — observer CTA + burger toggle */}
          <div className="level-two">
            {showObserverButton && (
              <button
                className={`observe-results ${observerMode ? "active" : ""}`}
                onClick={toggleObserverMode}
                aria-pressed={observerMode}
                style={darkActiveStyle} // <-- dark style when active
              >
                {observerMode ? "Back" : "Observe All Results"}
              </button>
            )}

            <button
              type="button"
              className={`burger-toggle ${burgerOpen ? "open" : ""}`}
              onClick={() => setBurgerOpen((v) => !v)}
              aria-pressed={burgerOpen}
              aria-controls="nav-tools"
              aria-label={burgerOpen ? "Hide options" : "Show options"}
              style={darkActiveStyle} // <-- dark style when active
            >
              <p style={{ margin: 0, lineHeight: 1, fontSize: 18 }}>
                {burgerOpen ? "+" : "-"}
              </p>
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
