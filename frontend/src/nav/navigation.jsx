// nav/Navigation.jsx
import React, { useState, useEffect } from "react";
import Logo from "../components/static/right";
import InfoPanel from "./InfoPanel";
import InfoGraph from "../components/dragGraphs/infoGraph";
import GraphPicker from "./graphPicker";
import { useGraph } from "../context/graphContext.tsx";  
import "../styles/navigation.css";

const Navigation = () => {
  const [open, setOpen] = useState(false);

  // read/write the global section used by Graph/BarGraph
  const { section, setSection } = useGraph();

  const handleFeedbackClick = () => {
    window.open(
      "https://docs.google.com/document/d/1lBKllYBu-OS34sMtGmJuJjTZlcN09QRPo5EdhCTQueM/edit?usp=sharing",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <>
      <nav className="navigation">
        <div className="left">
          <Logo />
          <div className="graph-picker">
            <GraphPicker value={section} onChange={setSection} />
          </div>
        </div>

        <div className="nav-left">
          <button
            className={`nav-toggle ${open ? "active" : ""}`}
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="info-overlay"
          >
            {open ? "The Idea -" : "The Idea +"}
          </button>

          <button className="feedback" onClick={handleFeedbackClick}>
            Leave Your Thoughts.
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
