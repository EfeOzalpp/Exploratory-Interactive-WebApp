import React, { useState } from "react";
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
      // viewing-only mode: ensure a section + show viz, kill survey UI
      if (!section) setSection(DEFAULT_SECTION);
      setSurveyActive(false);
      openGraph();
    } else {
      // leaving viewing-only mode; if user hasn't completed a survey yet,
      // you can hide the viz again (optional)
      if (!hasCompletedSurvey) closeGraph();
      // decide if you want to re-open the survey UI or keep home screen
      // setSurveyActive(true);
    }
  };

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
          <button
            className={`nav-toggle ${open ? "active" : ""}`}
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="info-overlay"
          >
            {open ? "The idea -" : "The idea +"}
          </button>

          <button className="feedback" onClick={handleFeedbackClick}>
            Leave your thoughts.
          </button>

          <button
            className={`observe-results ${observerMode ? "active" : ""}`}
            onClick={toggleObserverMode}
            aria-pressed={observerMode}
          >
            {observerMode ? "Close data view" : "View data"}
          </button>
        </div>
      </nav>

      <InfoPanel open={open} onClose={() => setOpen(false)}>
        <InfoGraph />
      </InfoPanel>
    </>
  );
};

export default Navigation;
