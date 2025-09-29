// src/components/survey/roleStep.jsx
import React from "react";
import RolePicker from "./rolePicker";

const DISPLAY = {
  student: "student",
  staff: "faculty",
  visitor: "visitor",
};

export default function RoleStep({ value, onChange, onNext, error }) {
  const isSelected = Boolean(value);
  const buttonLabel = isSelected
    ? `I am${value === "staff" ? " " : " a "}${DISPLAY[value]}`
    : "I am…";

  return (
    <div className="surveyStart">
      <h3 className="begin-title1">Let's get started</h3>
      <h1 className="begin-title2">Butterfly Effect</h1>

      <RolePicker value={value} onChange={onChange} />

      {/* RoleStep-specific error message */}
      {!isSelected && error && (
        <div className="error-container">
          <h2>What option fits best?</h2>
        </div>
      )}

      <button
        type="button"
        className={`begin-button ${!isSelected ? "is-disabled" : ""}`}
        aria-disabled={!isSelected}
        onClick={onNext}
        style={{ marginTop: "1rem" }}
      >
        <span>{buttonLabel}</span>
      </button>
    </div>
  );
}
