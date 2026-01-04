// src/components/survey/questions/QuestionFlow.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { Question } from "../types.ts";
import SelectionMap from "./SelectionMap.tsx";
import AnswersList, { ShapeKey } from "./AnswersList.tsx";
import { useAppState, DEFAULT_AVG } from "../../app-context/appStateContext.tsx";

const SHAPE_ORDER: ShapeKey[] = ["circle", "square", "triangle", "diamond"];
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
}: {
  questions: Question[];
  onAnswersUpdate?: (answers: Record<string, number | null>) => void;
  onSubmit?: (answers: Record<string, number | null>) => void;
  submitting?: boolean;
}) {
  const { setLiveAvg, commitAllocAvg } = useAppState();

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [slabState, setSlabState] = useState<"idle" | "leaving" | "entering">("idle");

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
  const [mapFactors, setMapFactors] = useState<Record<ShapeKey, number>>({ ...INITIAL_FACTORS });

  // Weighted-average by importances (not scaling the intrinsic weights)
  const recomputeCurrent = useCallback(
    (factors: Record<ShapeKey, number>) => {
      const EPS = 1e-9;

      const parts = q.options.map((o, i) => {
        const shape = shapeForIndex(i);
        const importance = Math.max(0, Number(factors[shape] ?? 0)); // 0..1
        const weight = Math.max(0, Math.min(1, Number(o.weight ?? 0))); // clamp 0..1
        return { weight, importance };
      });

      const denom = parts.reduce((a, p) => a + p.importance, 0);
      const agg =
        denom <= EPS ? null : parts.reduce((a, p) => a + p.weight * p.importance, 0) / denom;

      setAnswers((prev) => ({ ...prev, [q.id]: agg }));
    },
    [q]
  );

  // Expose latest recompute via ref
  const recomputeRef = useRef(recomputeCurrent);
  useEffect(() => {
    recomputeRef.current = recomputeCurrent;
  }, [recomputeCurrent]);

  // Keep latest onAnswersUpdate in a ref
  const onAnswersUpdateRef = useRef(onAnswersUpdate);
  useEffect(() => {
    onAnswersUpdateRef.current = onAnswersUpdate;
  }, [onAnswersUpdate]);

  // STABLE callback for SelectionMap -> normalize + recompute
  const onMapStable = useCallback((factors: Record<string, number>) => {
    const normalized: Record<ShapeKey, number> = {
      circle: Number(factors.circle ?? 0),
      square: Number(factors.square ?? 0),
      triangle: Number(factors.triangle ?? 0),
      diamond: Number(factors.diamond ?? 0),
    };
    setMapFactors(normalized);
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

  // Helper: compute current live average (no side effects)
  const computeCurrentAvg = useCallback(() => {
    const vals = Object.values(answers).filter(
      (x): x is number => typeof x === "number" && Number.isFinite(x)
    );
    if (!vals.length) return undefined;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(avg * 100) / 100;
  }, [answers]);

  // Emit answers to parent + update context liveAvg continuously
  useEffect(() => {
    onAnswersUpdateRef.current?.(answers);

    const avg = computeCurrentAvg();
    // Context owns the live average. If undefined, fall back to DEFAULT_AVG.
    setLiveAvg(typeof avg === "number" ? avg : DEFAULT_AVG);
  }, [answers, computeCurrentAvg, setLiveAvg]);

  // Treat drag-release as a "commit": SelectionMap should fire 'gp:weights-commit'
  useEffect(() => {
    const onCommit = () => {
      const avg = computeCurrentAvg();
      commitAllocAvg(typeof avg === "number" ? avg : DEFAULT_AVG);
    };
    window.addEventListener("gp:weights-commit", onCommit);
    return () => window.removeEventListener("gp:weights-commit", onCommit);
  }, [computeCurrentAvg, commitAllocAvg]);

  const next = () => {
    // Commit on step advance so placement can update
    const avg = computeCurrentAvg();
    commitAllocAvg(typeof avg === "number" ? avg : DEFAULT_AVG);

    if (current < questions.length - 1) {
      setSlabState("leaving");
      setTimeout(() => {
        setCurrent((c) => c + 1);
        setSlabState("entering");
        setTimeout(() => setSlabState("idle"), D);
      }, D);
    } else {
      onSubmit?.(answers);
    }
  };

  const currentShape = shapeForIndex(current);
  const slabClass =
    slabState === "leaving" ? "q-slab is-leaving" : slabState === "entering" ? "q-slab is-entering" : "q-slab";

  return (
    <div className="questionnaire">
      <div className="answer-question">
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
            <SelectionMap onWeightsChange={onMapStable} />
          </div>

          <AnswersList question={q} factors={mapFactors} />
        </div>
      </div>

      <div className="survey-actions">
        <button type="button" className="begin-button2" onClick={next} disabled={!!submitting}>
          <span>{current < questions.length - 1 ? "Next" : "Finish"}</span>
        </button>
      </div>
    </div>
  );
}
