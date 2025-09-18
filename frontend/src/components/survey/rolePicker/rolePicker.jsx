import React from "react";
import LottieOption from "../../../lottie-for-UI/lottieOption";

const OPTIONS = [
  { val: "student", label: "Student" },
  { val: "staff", label: "Faculty" },
  { val: "visitor", label: "Visitor" },
];

export default function RolePicker({ value, onChange }) {
  return (
    <fieldset className="radio-group" aria-label="I am a…">

      <div role="radiogroup" className="radio-options">
        {OPTIONS.map((opt) => {
          const checked = value === opt.val;
          return (
            <div
              key={opt.val}
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={`input-part-inside radio-option ${checked ? "selected" : ""}`}
              onClick={() => onChange(opt.val)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.val);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <LottieOption selected={checked} />
              <label className="radio-label">
                <p>{opt.label}</p>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
