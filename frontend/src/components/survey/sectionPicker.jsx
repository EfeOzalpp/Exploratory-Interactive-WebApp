import React from 'react';

const DEFAULT_SECTIONS = [
  { value: 'fine-arts', label: 'Fine Arts' },
  { value: 'digital-media', label: 'Digital / Time-Based' },
  { value: 'design', label: 'Design & Applied' },
  { value: 'foundations', label: 'Foundations & X-Discipline' },
];

export default function SectionPickerIntro({
  value,
  onChange,
  onBegin,
  error,
  sections, 
}) {
  const options = sections && sections.length ? sections : DEFAULT_SECTIONS;

  return (
    <div className="surveyStart">
      <h3 className="begin-title1">Welcome</h3>
      <h1 className="begin-title2">Butterfly Effect</h1>

      <label className="section-picker" style={{ marginTop: '1rem' }}>
        <span className="visually-hidden">Choose your section</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Choose your section"
        >
          <option value="" disabled>Choose your section…</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {error && (
        <div className="error-container" style={{ marginTop: '0.75rem' }}>
          <h2>{error}</h2>
          {!/section/i.test(error) && (
            <p className="email-tag">Mail: eozalp@massart.edu</p>
          )}
        </div>
      )}

      <button className="begin-button" onClick={onBegin} style={{ marginTop: '1rem' }}>
        <h4>BEGIN</h4>
      </button>
    </div>
  );
}
