import React from "react";

import LottieOption from "../../static-assets/lottie/lottieOption";

const OPTIONS = [
  { val: "visitor", label: "Visitor" },
  {
    group: "MassArt",
    options: [
      { val: "student", label: "Student" },
      { val: "staff", label: "Staff / Faculty" },
    ],
  },
];

export default function RolePicker({ value, onChange }) {
  return (
    <fieldset className="radio-group" aria-label="I am a…">
      <div role="radiogroup" className="radio-options">
        {/* Visitor section (own bordered box) */}
        <fieldset className="role-group visitor-group">
          <legend className="role-legend">Explorer</legend>
          <div
            key={OPTIONS[0].val}
            role="radio"
            aria-checked={value === OPTIONS[0].val}
            tabIndex={value === OPTIONS[0].val ? 0 : -1}
            className={`input-part-inside radio-option ${
              value === OPTIONS[0].val ? "selected" : ""
            }`}
            onClick={() => onChange(OPTIONS[0].val)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(OPTIONS[0].val);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <LottieOption selected={value === OPTIONS[0].val} />
            <label className="radio-label">
              <h4>{OPTIONS[0].label}</h4>
            </label>
          </div>
        </fieldset>

        {/* MassArt group */}
        <fieldset className="role-group massart-group">
          <legend className="role-legend">MassArt</legend>
          {OPTIONS[1].options.map((opt) => {
            const checked = value === opt.val;
            return (
              <div
                key={opt.val}
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={`input-part-inside radio-option ${
                  checked ? "selected" : ""
                }`}
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
              <label className="radio-label" style={{ textAlign: "left" }}>
                {opt.val === "staff" ? (
                  <>
                    <h4>Staff</h4>
                    <h4>Faculty</h4>
                  </>
                ) : (
                  <h4>{opt.label}</h4>
                )}
              </label>
              </div>
            );
          })}
        </fieldset>
      </div>
    </fieldset>
  );
}
