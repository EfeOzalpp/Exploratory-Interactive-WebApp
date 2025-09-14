// src/components/survey/roleStep.jsx
import React from "react";
import RolePicker from "./rolePicker";

const DISPLAY = {
  student: "Student",
  staff: "Faculty",
  visitor: "Visitor",
};

export default function RoleStep({ value, onChange, onNext, error }) {
  const isSelected = Boolean(value);
  const buttonLabel = isSelected
    ? `I am${value === "staff" ? " " : " a "}${DISPLAY[value]}`
    : "I am…";

  return (
    <div className="surveyStart">
      <h3 className="begin-title1">Welcome</h3>
      <h1 className="begin-title2">Butterfly Effect</h1>

      <RolePicker value={value} onChange={onChange} />

      {/* RoleStep-specific error message */}
      {!isSelected && error && (
        <div className="error-container">
          <h2>Choose the best fitting option</h2>
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
