// nav/Navigation.jsx
import React, { useState } from "react";
import Logo from "../components/static/left";
import InfoPanel from "./infoPanel.jsx";
import InfoGraph from "./infoGraph.jsx";
import GraphPicker from "./graphPicker";
import { useGraph } from "../context/graphContext.tsx";

import "../styles/navigation.css";
import '../styles/info-graph.css';

const Navigation = () => {
  const [open, setOpen] = useState(false);

  // global graph state
  const {
    section,
    setSection,
    isSurveyActive,
    hasCompletedSurvey,
  } = useGraph();

  const handleFeedbackClick = () => {
    window.open(
      "https://docs.google.com/document/d/1lBKllYBu-OS34sMtGmJuJjTZlcN09QRPo5EdhCTQueM/edit?usp=sharing",
      "_blank",
      "noopener,noreferrer"
    );
  };

  // only mount picker after user has completed a survey at least once,
  // and keep it unmounted while any survey is active
  const showPicker = hasCompletedSurvey && !isSurveyActive;

  return (
    <>
      <nav className="navigation">
        <div className="left">
          <Logo />

          {showPicker && (
            <div className="graph-picker">
              <GraphPicker
                value={section}
                onChange={setSection}
              />
            </div>
          )}
        </div>

        <div className="nav-left">
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
        </div>
      </nav>

      <InfoPanel open={open} onClose={() => setOpen(false)}>
        <InfoGraph />
      </InfoPanel>
    </>
  );
};

export default Navigation;
