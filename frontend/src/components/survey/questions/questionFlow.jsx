// src/components/survey/questions/questionFlow.jsx
import React, { useMemo, useState } from 'react';
import { computeRealtimeAverage } from '../../../utils/liveAverage.ts';
import CheckpointScale from '../../survey/checkpointScale';
import QuestionMonitor from './questionMonitor';
import { WEIGHTED_QUESTIONS } from './questionsWeights';

// Fisher–Yates shuffle
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Piecewise weight for t∈[0..3]
function weightAtTFromOptions(options, t) {
  if (t == null || Number.isNaN(t)) return null;
  const clamped = Math.max(0, Math.min(3, t));
  const i = Math.floor(clamped);
  const f = clamped - i;
  const ws = options.map((o) => o.weight);
  if (i >= 3) return ws[3];
  return ws[i] + (ws[i + 1] - ws[i]) * f;
}

export default function QuestionFlowWeighted({
  questions = WEIGHTED_QUESTIONS,
  onWeightsUpdate,
  onSubmit,
  onLiveAverageChange,
}) {
  const [current, setCurrent] = useState(0);
  const [weights, setWeights] = useState({});
  const [vizMeta, setVizMeta] = useState({});
  const [orders, setOrders] = useState({});
  const [error, setError] = useState('');
  const [fadeState, setFadeState] = useState('fade-in');
  const [sessionKey, setSessionKey] = useState(0);

  const q = questions[current];

  const order = useMemo(
    () => orders[q.id] ?? q.options.map((_, i) => i),
    [orders, q.id, q.options]
  );

  const displayOptions = useMemo(
    () => order.map((i) => q.options[i]),
    [order, q.options]
  );

  const resetKey = q.id;

  // Shuffle ensuring at least one visible option changes at current t
  function shuffleForVisibleChange(orderIn, tNow, len) {
    if (!Number.isFinite(tNow)) {
      let out = orderIn;
      do { out = shuffleArray(orderIn); } while (out.every((v, i) => v === orderIn[i]));
      return out;
    }

    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const i = Math.floor(clamp(tNow, 0, len - 1));
    const j = Math.min(i + 1, len - 1);

    const snapped = Math.abs(tNow - Math.round(tNow)) < 1e-4;
    const visiblePositions = snapped ? [i] : Array.from(new Set([i, j]));

    const pos = visiblePositions[Math.floor(Math.random() * visiblePositions.length)];
    let k = pos;
    while (k === pos) k = Math.floor(Math.random() * len);

    const out = orderIn.slice();
    [out[pos], out[k]] = [out[k], out[pos]];
    return out;
  }

  function shuffleNow() {
    const qLoc = questions[current];
    const orderLoc = orders[qLoc.id] ?? qLoc.options.map((_, i) => i);
    const len = qLoc.options.length;
    if (len < 2) return;

    const tNow = vizMeta[qLoc.id]?.t;
    const newOrder = shuffleForVisibleChange(orderLoc, tNow, len);
    setOrders((prev) => ({ ...prev, [qLoc.id]: newOrder }));

    // keep the same t but recompute weight for the new display order
    if (typeof tNow === 'number') {
      const newDisplayOptions = newOrder.map((i) => qLoc.options[i]);
      const newW = weightAtTFromOptions(newDisplayOptions, tNow);
      if (newW != null) {
        const next = { ...weights, [qLoc.id]: newW };
        setWeights(next);
        onWeightsUpdate?.(next);
        onLiveAverageChange?.(computeRealtimeAverage(next));
      }
    }

    setError('');
  }

  // Handle thumb (real) movement
  const handleScaleChange = (w, meta) => {
    const next = { ...weights, [q.id]: w };
    setWeights(next);
    setVizMeta((m) => ({
      ...m,
      [q.id]: {
        t: meta?.t,
        index: meta?.index ?? null,
        committed: !!meta?.committed,
        dragging: !!meta?.dragging,
      },
    }));
    setError('');
    onWeightsUpdate?.(next);

    const liveAvg = computeRealtimeAverage(next); // 0..1
    onLiveAverageChange?.(liveAvg, meta);
  };

  const handleNext = () => {
    if (weights[q.id] == null) {
      setError('Make a selection anywhere on the line.');
      return;
    }
    setFadeState('fade-out');
    setTimeout(() => {
      setFadeState('fade-in');
      if (current < questions.length - 1) setCurrent((c) => c + 1);
      else onSubmit?.(weights);
    }, 70);
  };

  const currentWeight = weights[q.id] ?? null;
  const currentMeta = vizMeta[q.id] ?? { t: undefined, index: null, committed: false, dragging: false };

  const primaryCtaLabel = current < questions.length - 1 ? 'Next' : "I'm Ready";

  return (
    <div className={`survey-section ${fadeState}`} style={{ position: 'relative' }}>
      {error && (
        <div className={`error-container ${fadeState}`}>
          <h2>Heads up</h2>
          <p className="email-tag">{error}</p>
        </div>
      )}

      <div className="questionnaire" key={`qwrap-${sessionKey}-${current}`}>
        <QuestionMonitor
          key={`monitor-${resetKey}-${sessionKey}`}
          prompt={q.prompt}
          options={displayOptions}
          t={currentMeta.t}
          qIndex={current}
          qTotal={questions.length}
          isDragging={!!currentMeta.dragging}
          isGhosting={false}
        />

        <CheckpointScale
          key={`scale-${resetKey}-${sessionKey}`}
          options={displayOptions}
          value={currentWeight}
          resetKey={resetKey}
          onChange={handleScaleChange}
          showDots={false}
        />

        <div className="survey-actions">
          <button
            type="button"
            className="shuffle-button"
            onClick={shuffleNow}
            title="Shuffle answers"
            aria-label="Shuffle answers"
          >
            <span>Shuffle</span>
            <svg
              className="shuffle-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 3h5v5" />
              <path d="M4 20L21 3" />
              <path d="M21 16v5h-5" />
              <path d="M15 15l6 6" />
            </svg>
          </button>

          <button className="begin-button2" onClick={handleNext}>
            <span>{primaryCtaLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
