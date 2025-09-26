import React, { useMemo } from 'react';
import { getAnswerOpacities, getScaleActivations } from '../../survey/answerBlend.ts';

export default function QuestionMonitor({
  prompt,
  options,
  t,
  index,
  qIndex,
  qTotal,
  // NEW
  isDragging = false,
}) {
  // Drivers
  const opacities = useMemo(() => getAnswerOpacities(t, index), [t, index]);
  const scales    = useMemo(() => getScaleActivations(t, index), [t, index]);

  const clampedT = Math.max(0, Math.min(3, t ?? 0));
  const i = Math.floor(clampedT);  // left neighbor
  const f = clampedT - i;          // [0..1] toward right neighbor
  const j = Math.min(i + 1, options.length - 1); // right neighbor

  // ---- tunables ----
  const BASE_SCALE = 0.96;
  const GROW       = 0.50;   // slightly reduced from 0.54 to lessen shimmer
  const Y_OFFSET   = 24;
  const CURVE_EXP  = 1.0;

  const tent = (x) => {
    const v = 4 * x * (1 - x); // 0 at 0/1, peak at 0.5
    return Math.max(0, v) ** CURVE_EXP;
  };

  const scaleFromActivation = (a) => BASE_SCALE + GROW * a;

  // NEW: snap to device pixel to avoid micro-jitter on mobile
  const transformFor = (idx, activation) => {
    let dy = 0;
    if (idx === i && idx !== j) {
      dy = +Y_OFFSET * tent(f); // left goes down
    } else if (idx === j && idx !== i) {
      dy = -Y_OFFSET * tent(f); // right goes up
    }
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const dySnapped = Math.round(dy * dpr) / dpr;

    const sc = scaleFromActivation(activation);
    // Use translate3d to keep it on compositor
    return `translate3d(-50%, calc(-50% + ${dySnapped}px), 0) scale(${sc})`;
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

        <div className={`qm-stage ${isDragging ? 'is-dragging' : ''}`}>
          {options.map((o, k) => {
            const opacity = opacities[k] ?? 0;
            const act     = scales[k] ?? 0;
            const snapped = index === k;
            return (
              <div
                key={k}
                className={`qm-answer-abs ${snapped ? 'is-selected' : ''}`}
                style={{
                  opacity,
                  transform: transformFor(k, act),
                  zIndex: zFor(act),
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
