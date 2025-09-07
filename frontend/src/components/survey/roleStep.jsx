import React from 'react';
import RolePicker from './rolePicker';

export default function RoleStep({ value, onChange, onNext, error }) {
  return (
    <div className="surveyStart">
      <h3 className="begin-title1">Welcome</h3>
      <h1 className="begin-title2">Butterfly Effect</h1>

      <RolePicker value={value} onChange={onChange} />

      {error && (
        <div className="error-container" style={{ marginTop: '0.75rem' }}>
          <h2>{error}</h2>
        </div>
      )}

      <button className="begin-button" onClick={onNext} style={{ marginTop: '1rem' }}>
        <h4>Next</h4>
      </button>
    </div>
  );
}
