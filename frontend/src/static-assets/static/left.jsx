// src/components/static/left/index.jsx (a.k.a. Logo.jsx)
import React from "react";
import { useAppState } from "../../app-context/appStateContext.tsx";

const Logo = () => {
  const { observerMode, hasCompletedSurvey, darkMode, navPanelOpen } = useAppState();

  // Dark logo is allowed only when observing or post-complete — AND only if the info panel is NOT open.
  // If navPanelOpen is true (InfoPanel open), we force the light logo.
  const darkGate = (observerMode || hasCompletedSurvey) && !navPanelOpen;
  const useDarkLogo = darkGate && darkMode;

  const background = useDarkLogo
    ? "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.18) 38%, rgba(0,0,0,0) 70%)"
    : "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0) 70%)";

  return (
    <div
      className="logo-divider"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        transition: "background 200ms ease, padding 200ms ease",
      }}
      aria-label="Butterfly Habits"
    >
      <img
        src={`${process.env.PUBLIC_URL}/${useDarkLogo ? "Butterfly-habits-logo-dark.svg" : "Butterfly-habits-logo.svg"}`}
        alt="Butterfly Habits Logo"
        className="logo-image"
        style={{ display: "block" }}
      />
    </div>
  );
};

export default Logo;
