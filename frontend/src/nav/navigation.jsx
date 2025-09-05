import React, { useState } from "react";
import Logo from "../components/static/right";
import InfoPanel from "./InfoPanel";
import InfoGraph from "../components/dragGraphs/infoGraph";
import "../styles/navigation.css";

const Navigation = () => {
  const [open, setOpen] = useState(false);

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
        <Logo />

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

      {/* Full-viewport panel below nav */}
      <InfoPanel open={open} onClose={() => setOpen(false)}>
        <InfoGraph />
      </InfoPanel>
    </>
  );
};

export default Navigation;
