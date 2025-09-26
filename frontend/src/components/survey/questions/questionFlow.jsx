import React, { useMemo, useState } from 'react';
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

// Compute weight at a given t using the piecewise mapping used by the scale
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
}) {
  const [current, setCurrent] = useState(0);
  const [weights, setWeights] = useState({});
  const [vizMeta, setVizMeta] = useState({});
  const [orders, setOrders] = useState({});
  const [error, setError] = useState('');
  const [fadeState, setFadeState] = useState('fade-in');

  // NEW: lift drag state so we can disable transitions while dragging
  const [isDragging, setIsDragging] = useState(false);

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

  const handleScaleChange = (w, meta) => {
    const next = { ...weights, [q.id]: w };
    setWeights(next);
    setVizMeta((m) => ({ ...m, [q.id]: { t: meta?.t, index: meta?.index ?? null } }));
    // NEW: watch dragging flag coming from the scale
    if (typeof meta?.dragging === 'boolean') setIsDragging(meta.dragging);
    setError('');
    onWeightsUpdate?.(next);
  };

  const handleNext = () => {
    if (weights[q.id] == null) {
      setError('Make a selection anywhere on the line (tap a dot or between).');
      return;
    }
    setFadeState('fade-out');
    setTimeout(() => {
      setFadeState('fade-in');
      if (current < questions.length - 1) {
        setCurrent((c) => c + 1);
      } else {
        onSubmit?.(weights);
      }
    }, 70);
  };

  const handleShuffle = () => {
    const len = q.options.length;
    if (len < 2) return;

    let newOrder = order;
    do {
      newOrder = shuffleArray(order);
    } while (newOrder.every((v, i) => v === order[i]));

    setOrders((prev) => ({ ...prev, [q.id]: newOrder }));

    const tNow = vizMeta[q.id]?.t;
    if (typeof tNow === 'number') {
      const newDisplayOptions = newOrder.map((i) => q.options[i]);
      const newW = weightAtTFromOptions(newDisplayOptions, tNow);
      if (newW != null) {
        const next = { ...weights, [q.id]: newW };
        setWeights(next);
        onWeightsUpdate?.(next);
      }
    }

    setError('');
  };

  const currentWeight = weights[q.id] ?? null;
  const currentMeta = vizMeta[q.id] ?? { t: undefined, index: null };

  return (
    <div className={`survey-section`}>
      {error && (
        <div className={`error-container ${fadeState}`}>
          <h2>Heads up</h2>
          <p className="email-tag">{error}</p>
        </div>
      )}

      <div className="questionnaire">
        <QuestionMonitor
          prompt={q.prompt}
          options={displayOptions}
          t={currentMeta.t}
          index={currentMeta.index}
          qIndex={current}
          qTotal={questions.length}
          // NEW
          isDragging={isDragging}
        />

        <CheckpointScale
          options={displayOptions}
          value={currentWeight}
          resetKey={resetKey}
          onChange={handleScaleChange}
        />

        <div className="survey-actions">
          <button
            type="button"
            className="shuffle-button"
            onClick={handleShuffle}
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
            {current < questions.length - 1 ? <span>Next</span> : <span>I'm Ready</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
