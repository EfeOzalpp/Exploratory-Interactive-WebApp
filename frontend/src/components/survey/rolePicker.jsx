import React from 'react';

export default function RolePicker({ value, onChange }) {
  const Btn = ({ val, label }) => (
    <button
      type="button"
      className={`audience-btn ${value === val ? 'selected' : ''}`}
      aria-pressed={value === val}
      onClick={() => onChange(val)}
    >
      <span className="audience-dot" />
      {label}
    </button>
  );

  return (
    <div className="audience-picker">
      <h4 className="audience-title">I am a…</h4>
      <div className="audience-row">
        <Btn val="student" label="Student" />
        <Btn val="staff" label="Staff" />
      </div>
    </div>
  );
}
