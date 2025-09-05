// graphPicker.jsx
import React from "react";

const defaultSections = [
  { id: "fine-arts", label: "Fine Arts" },
  { id: "digital-media", label: "Digital / Time-Based Media" },
  { id: "design", label: "Design & Applied" },
  { id: "foundations", label: "Foundations & Cross-Discipline" },
];

const GraphPicker = ({ value = "", onChange, sections = defaultSections }) => (
  <label className="section-picker">
    <span className="visually-hidden">Choose a section</span>
    <select value={value} onChange={(e) => onChange?.(e.target.value)} aria-label="Choose a section">
      <option value="" disabled>Choose a section…</option>
      {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  </label>
);

export default GraphPicker;
