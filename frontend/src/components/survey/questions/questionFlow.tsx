// src/components/survey/questions/questionFlow.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { Question } from '../types.ts';
import SelectionMap from './SelectionMap.tsx';
import AnswersList, { ShapeKey } from './AnswersList.tsx';

const SHAPE_ORDER: ShapeKey[] = ['circle', 'square', 'triangle', 'diamond'];
const shapeForIndex = (idx: number): ShapeKey => SHAPE_ORDER[idx % SHAPE_ORDER.length];

// Matches the SelectionMap's initial target weights: BASE_BUCKET_CAP / 4 = 0.5 each.
const INITIAL_FACTORS: Record<ShapeKey, number> = {
  circle: 0.5,
  square: 0.5,
  triangle: 0.5,
  diamond: 0.5,
};

// keep CSS duration in sync with this
const D = 100 as const;

export default function QuestionFlow({
  questions,
  onAnswersUpdate,
  onSubmit,
  submitting,
  onLiveAverageChange, // ← restored
}: {
  questions: Question[];
  onAnswersUpdate?: (answers: Record<string, number | null>) => void;
  onSubmit?: (answers: Record<string, number | null>) => void;
  submitting?: boolean;
  onLiveAverageChange?: (avg: number | undefined, meta?: { dragging?: boolean; committed?: boolean }) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [slabState, setSlabState] = useState<'idle' | 'leaving' | 'entering'>('idle');

  const q = questions[current];

  // (Kept for reference; not used in the final agg)
  const baseAverages = useMemo(
    () =>
      questions.map((qq) =>
        qq.options.length
          ? qq.options.reduce((a, o) => a + (o.weight ?? 0), 0) / qq.options.length
          : 0
      ),
    [questions]
  );
  void baseAverages;

  // All four shape "importances" from the map (0..1; sum typically ~2)
  // Seed to 0.5 each so we don't start with null.
  const [mapFactors, setMapFactors] = useState<Record<ShapeKey, number>>({ ...INITIAL_FACTORS });

  // Weighted-average by importances (not scaling the intrinsic weights)
  const recomputeCurrent = useCallback((factors: Record<ShapeKey, number>) => {
    const EPS = 1e-9;

    const parts = q.options.map((o, i) => {
      const shape = shapeForIndex(i);
      const importance = Math.max(0, Number(factors[shape] ?? 0)); // 0..1
      const weight = Math.max(0, Math.min(1, Number(o.weight ?? 0))); // clamp 0..1
      return { weight, importance };
    });

    const denom = parts.reduce((a, p) => a + p.importance, 0);
    const agg =
      denom <= EPS
        ? null
        : parts.reduce((a, p) => a + p.weight * p.importance, 0) / denom;

    setAnswers((prev) => ({ ...prev, [q.id]: agg }));
  }, [q]);

  // Expose latest recompute via ref
  const recomputeRef = useRef(recomputeCurrent);
  useEffect(() => { recomputeRef.current = recomputeCurrent; }, [recomputeCurrent]);

  // Keep latest callbacks in refs (avoid stale closures)
  const onAnswersUpdateRef = useRef(onAnswersUpdate);
  useEffect(() => { onAnswersUpdateRef.current = onAnswersUpdate; }, [onAnswersUpdate]);

  const onLiveAverageChangeRef = useRef(onLiveAverageChange);
  useEffect(() => { onLiveAverageChangeRef.current = onLiveAverageChange; }, [onLiveAverageChange]);

  // STABLE callback for SelectionMap -> normalize + recompute
  const onMapStable = useCallback((factors: Record<string, number>) => {
    const normalized: Record<ShapeKey, number> = {
      circle: Number(factors.circle ?? 0),
      square: Number(factors.square ?? 0),
      triangle: Number(factors.triangle ?? 0),
      diamond: Number(factors.diamond ?? 0),
    };
    setMapFactors(normalized);
    // Recompute current question’s aggregate immediately
    recomputeRef.current(normalized);
  }, []);

  // Force an initial recompute on mount and whenever the current question changes.
  useEffect(() => {
    recomputeRef.current(mapFactors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Also if `questions` array changes identity (hot reload / dynamic data), recompute.
  useEffect(() => {
    recomputeRef.current(mapFactors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  // Emit to parent + dispatch to canvas as 'gp:live-avg' (continuous, non-committing)
  useEffect(() => {
    // notify parent with the full answers map
    onAnswersUpdateRef.current?.(answers);

    // compute live average over non-null answers
    const vals = Object.values(answers).filter(
      (x): x is number => typeof x === 'number' && Number.isFinite(x)
    );

    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const avg2 = Math.round(avg * 100) / 100;

      // → Canvas bridge (window event)
      try {
        window.dispatchEvent(new CustomEvent('gp:live-avg', { detail: { avg: avg2 } }));
      } catch {}

      // → Parent bridge (realtime updates for FrontPage liveAvg)
      try {
        onLiveAverageChangeRef.current?.(avg2, { dragging: true, committed: false });
      } catch {}
    } else {
      try {
        window.dispatchEvent(new CustomEvent('gp:live-avg', { detail: { avg: undefined } }));
      } catch {}
      try {
        onLiveAverageChangeRef.current?.(undefined, { dragging: true, committed: false });
      } catch {}
    }
  }, [answers]);

  // Helper: compute current live average (same as above, no side effects)
  const computeCurrentAvg = () => {
    const vals = Object.values(answers).filter(
      (x): x is number => typeof x === 'number' && Number.isFinite(x)
    );
    if (!vals.length) return undefined;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(avg * 100) / 100;
  };

  // Treat drag-release as a "commit": SelectionMap should fire 'gp:weights-commit'
  useEffect(() => {
    const onCommit = () => {
      const avg2 = computeCurrentAvg();
      try {
        onLiveAverageChangeRef.current?.(avg2, { dragging: false, committed: true });
      } catch {}
    };
    window.addEventListener('gp:weights-commit', onCommit);
    return () => window.removeEventListener('gp:weights-commit', onCommit);
  }, [answers]); // depends on latest answers so commit uses current numbers

  const next = () => {
    // emit a "commit" so FrontPage can set allocAvg on step advance
    const avg2 = computeCurrentAvg();
    try {
      onLiveAverageChangeRef.current?.(avg2, { dragging: false, committed: true });
    } catch {}

    if (current < questions.length - 1) {
      // slab transition without touching the button area
      setSlabState('leaving');
      setTimeout(() => {
        setCurrent((c) => c + 1);
        setSlabState('entering');
        setTimeout(() => setSlabState('idle'), D);
      }, D);
    } else {
      onSubmit?.(answers);
    }
  };

  const currentShape = shapeForIndex(current);
  const slabClass =
    slabState === 'leaving' ? 'q-slab is-leaving'
    : slabState === 'entering' ? 'q-slab is-entering'
    : 'q-slab';

  return (
    <div className="questionnaire">
      <div className={`questions ${slabClass}`}>
        <div className="q-count">
          {current + 1}/{questions.length}
        </div>
        <h3 className="q-title">
          {q.prompt}
          <span className={`q-shape-badge q-shape--${currentShape}`} aria-label={`Shape: ${currentShape}`} />
        </h3>
      </div>

      <div className={`survey-flow ${slabClass}`}>
        <div className="selection-part">
          {/* STABLE callback prevents map re-renders while dragging */}
          <SelectionMap onWeightsChange={onMapStable} />
        </div>

        {/* Each option is tied to its own shape (circle, square, triangle, diamond) */}
        <AnswersList question={q} factors={mapFactors} />
      </div>

      <div className="survey-actions">
        <button type="button" className="begin-button2" onClick={next} disabled={!!submitting}>
          <span>{current < questions.length - 1 ? 'Next' : 'Finish'}</span>
        </button>
      </div>
    </div>
  );
}
