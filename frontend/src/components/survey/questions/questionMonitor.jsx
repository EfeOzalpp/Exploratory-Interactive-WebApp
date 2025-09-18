// src/components/survey/QuestionMonitor.jsx
import React, { useMemo } from 'react';
import { getAnswerOpacities, getScaleActivations } from '../../survey/answerBlend.ts';

export default function QuestionMonitor({ prompt, options, t, index, qIndex, qTotal }) {
  // NEW: separate drivers
  const opacities = useMemo(() => getAnswerOpacities(t, index), [t, index]);
  const scales    = useMemo(() => getScaleActivations(t, index), [t, index]);

  const clampedT = Math.max(0, Math.min(3, t ?? 0));
  const i = Math.floor(clampedT);                         // left neighbor
  const f = clampedT - i;                                 // [0..1] toward right neighbor
  const j = Math.min(i + 1, options.length - 1);          // right neighbor

  // ---- tunables ----
  const BASE_SCALE = 0.96;
  const GROW       = 0.48;   // fully active ≈ 1.28x
  const Y_OFFSET   = 26;     // spread at the midpoint
  const CURVE_EXP  = 1.0;    // 1 = linear tent; >1 = tighter to the middle

  const tent = (x) => {
    const v = 4 * x * (1 - x);         // classic tent (0 at 0/1, peak at 0.5)
    return Math.max(0, v) ** CURVE_EXP;
  };

  const scaleFromActivation = (a) => BASE_SCALE + GROW * a;

  // Only the two neighbors move vertically, and only between checkpoints:
  const transformFor = (idx, activation) => {
    let dy = 0;
    if (idx === i && idx !== j) {
      dy = +Y_OFFSET * tent(f);        // left item goes down
    } else if (idx === j && idx !== i) {
      dy = -Y_OFFSET * tent(f);        // right item goes up
    }
    const sc = scaleFromActivation(activation);
    return `translate(-50%, calc(-50% + ${dy}px)) scale(${sc})`;
  };

  const zFor = (activation) => (activation >= 0.5 ? 2 : 1);

  return (
    <div className="qm-wrap">
      <div className="qm-card">
        <div className="qm-header">
          <div className={`qm-title ${Number.isInteger(index) ? 'is-snapped' : 'is-between'}`}>
            {Number.isFinite(qIndex) && Number.isFinite(qTotal) && (
              <span className="qm-count">{qIndex + 1}/{qTotal} — </span>
            )}
            {prompt}
          </div>
        </div>

        <div className="qm-stage">
          {options.map((o, k) => {
            const opacity = opacities[k] ?? 0;     // NEW opacity logic
            const act     = scales[k] ?? 0;        // OLD scale behavior

            const snapped = index === k;
            return (
              <div
                key={k}
                className={`qm-answer-abs ${snapped ? 'is-selected' : ''}`}
                style={{
                  opacity,                               // ← new rule
                  transform: transformFor(k, act),       // ← same scale behavior
                  zIndex: zFor(act),                     // ← stack like before
                }}
              >
                <h3 className="qm-answer-chip">{o.label}</h3>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
