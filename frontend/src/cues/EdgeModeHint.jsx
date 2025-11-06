import React, { useEffect, useRef } from "react";
import { useGraph } from "../context/graphContext.tsx";

/**
 * EdgeModeHint (simplified with icon)
 * - Same styling as .nav-toggle
 * - Shows Sun icon when prompting "Light Mode"
 * - Shows Moon icon when prompting "Dark Mode"
 */

function SunIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Crescent moon: draw via path */}
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
    </svg>
  );
}

export default function EdgeModeHint() {
  const { darkMode, setDarkMode } = useGraph();
  const textRef = useRef(darkMode ? "Dark mode" : "Light mode");

  useEffect(() => {
    textRef.current = darkMode ? "Dark mode" : "Light mode";
  }, [darkMode]);

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDarkMode(!darkMode);
    textRef.current = !darkMode ? "Dark mode" : "Light mode";
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") toggle(e);
  };

  const label = darkMode ? "Light Mode" : "Dark Mode";
  const Icon = darkMode ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className="nav-toggle"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}
