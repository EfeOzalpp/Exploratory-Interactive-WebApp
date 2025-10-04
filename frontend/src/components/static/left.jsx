import React from "react";
import { useGraph } from "../../context/graphContext.tsx";

const Logo = () => {
  const { observerMode, hasCompletedSurvey, darkMode, navPanelOpen } = useGraph();

  // Gate: dark logo only if observerMode or survey ended is true — BUT NOT when the panel is open
  const gate = (observerMode || hasCompletedSurvey) && !navPanelOpen;
  const useDarkLogo = gate && darkMode;

  // Background style
  const background = useDarkLogo
    ? "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.18) 38%, rgba(0,0,0,0) 70%)"
    : "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255, 255, 255, 0.7) 40%, rgba(255,255,255,0) 70%)";

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
    >
      <img
        src={`${process.env.PUBLIC_URL}/${
          useDarkLogo
            ? "Butterfly-habits-logo-dark.svg"
            : "Butterfly-habits-logo.svg"
        }`}
        alt="Butterfly Habits Logo"
        className="logo-image"
        style={{ display: "block" }}
      />
    </div>
  );
};

export default Logo;
