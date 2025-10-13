import React, { useMemo, useState, useEffect, useRef } from 'react';
import { computeRealtimeAverage } from '../../../utils/liveAverage.ts';
import CheckpointScale from '../../survey/checkpointScale';
import QuestionMonitor from './questionMonitor';
import { WEIGHTED_QUESTIONS } from './questionsWeights';
import HintBubble from '../../../tooltip/hintBubble';
import { useGraph } from '../../../context/graphContext.tsx';

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

const TUTORIAL_STEPS = [
  { id: 'intro',   text: '' },
  { id: 'drag',    text: '' },
  { id: 'shuffle', text: '' },
  { id: 'edges',   text: '' },
];

// Map step → h2/h4/binder copy
function getStepContent(stepId) {
  switch (stepId) {
    case 'intro':
      return {
        title: 'Welcome!',
        body: 'Let’s start with a quick walkthrough.',
        binder: 'Next: You can pick in between',
      };
    case 'drag':
      return {
        title: 'Drag it!',
        body: 'Text appears as you drag. Anywhere on the line is a correct answer.',
        binder: 'Next: Text Cues',
      };
    case 'shuffle':
      return {
        title: 'Text Cues',
        body: 'Text grow and shrink as you blend them, choose the point where the answer reflects you.',
        binder: 'Next: Shuffle',
      };
    case 'edges':
      return {
        title: 'Mix And Match',
        body: "When the two answers you like aren't aligning, shuffle them so they do.",
        binder: 'Begin',
      };
    default:
      return { title: '', body: '', binder: '' };
  }
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

  const { tutorialMode, setTutorialMode } = useGraph();

  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const step = TUTORIAL_STEPS[tutorialStepIndex];

  // Demo UI states
  const [demoShufflePress, setDemoShufflePress] = useState(false);
  const [demoShuffleEnabled, setDemoShuffleEnabled] = useState(false);
  const [demoPrimaryPress, setDemoPrimaryPress] = useState(false);

  // Refs
  const dragTickerRef = useRef(0);
  const dragDemoRunningRef = useRef(false);
  const userInteractedRef = useRef(false);
  const previewAnimRef = useRef({ raf: 0, token: 0 });

  // NEW: single source of truth for ghost position during tutorial
  const ghostTRef = useRef(1.5);

  useEffect(() => {
    if (tutorialMode) {
      setTutorialStepIndex(0);
      userInteractedRef.current = false;
      ghostTRef.current = 1.5; // reset ghost on tutorial (first step)
    }
  }, [tutorialMode]);

  // Enable demo shuffle loop ONLY on EDGES step
  useEffect(() => {
    const on = !!tutorialMode && step?.id === 'edges';
    setDemoShuffleEnabled(on);
    if (!on) setDemoShufflePress(false);
  }, [tutorialMode, step?.id]);

  // Intro: light CTA pulse
  useEffect(() => {
    let pressTimer = 0, cycleTimer = 0, cancelled = false;
    if (tutorialMode && step?.id === 'intro') {
      let count = 0;
      const cycle = () => {
        if (cancelled || count >= 2) return;
        setDemoPrimaryPress(true);
        pressTimer = window.setTimeout(() => {
          setDemoPrimaryPress(false);
          count++;
          if (!cancelled && count < 1) cycleTimer = window.setTimeout(cycle, 500);
        }, 1200);
      };
      cycleTimer = window.setTimeout(cycle, 3400);
    } else {
      setDemoPrimaryPress(false);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(pressTimer);
      window.clearTimeout(cycleTimer);
    };
  }, [tutorialMode, step?.id]);

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

  // Update preview t (affects monitor/ghost; no thumb move)
  const setPreviewT = (t) => {
    const w = weightAtTFromOptions(displayOptions, t);

    // keep ghostTRef authoritative for animation starts
    ghostTRef.current = Math.max(0, Math.min(3, t));

    setWeights((prev) => ({ ...prev, [q.id]: w }));
    setVizMeta((m) => ({
      ...m,
      [q.id]: {
        t,
        index: null,            // ghost never requests "snapped"
        committed: false,
        dragging: false,
      },
    }));
    onWeightsUpdate?.({ ...weights, [q.id]: w });
  };

  // Animate preview t (always start from ghostTRef, never fall back to 1.5 mid-loop)
  const animatePreviewTo = (targetT, duration = 900) => {
    if (previewAnimRef.current.raf) cancelAnimationFrame(previewAnimRef.current.raf);
    const token = ++previewAnimRef.current.token;

    const startT = Math.max(0, Math.min(3, ghostTRef.current)); // <— key change
    const clampedTarget = Math.max(0, Math.min(3, targetT));
    const startTime = performance.now();
    const ease = (x) => 0.5 * (1 - Math.cos(Math.PI * x));

    const tick = (now) => {
      if (previewAnimRef.current.token !== token || !tutorialMode || !['shuffle', 'edges'].includes(step?.id)) return;
      const u = Math.min(1, Math.max(0, (now - startTime) / duration));
      const t = startT + (clampedTarget - startT) * ease(u);
      setPreviewT(t);
      if (u < 1) previewAnimRef.current.raf = requestAnimationFrame(tick);
    };

    previewAnimRef.current.raf = requestAnimationFrame(tick);
  };
  
  // Guarantees at least one of the currently visible answers changes after shuffle.
  // If t is snapped to an integer (exact checkpoint), we only ensure THAT index changes.
  function shuffleForVisibleChange(order, tNow, len) {
    // If no t yet (e.g., first render), fall back to “not identical” shuffle
    if (!Number.isFinite(tNow)) {
      let out = order;
      do { out = shuffleArray(order); } while (out.every((v, i) => v === order[i]));
      return out;
    }

    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const i = Math.floor(clamp(tNow, 0, len - 1));
    const j = Math.min(i + 1, len - 1);

    const snapped = Math.abs(tNow - Math.round(tNow)) < 1e-4;
    const visiblePositions = snapped ? [i] : Array.from(new Set([i, j])); // de-dupe when i==j

    // Pick which visible position we’ll change
    const pos = visiblePositions[Math.floor(Math.random() * visiblePositions.length)];

    // Pick any other index to swap with
    let k = pos;
    while (k === pos) k = Math.floor(Math.random() * len);

    const out = order.slice();
    [out[pos], out[k]] = [out[k], out[pos]];
    return out;
  }

  // Shuffle (real)
  function shuffleNow(triggeredByDemo = false) {
    const qLoc = questions[current];
    const orderLoc = orders[qLoc.id] ?? qLoc.options.map((_, i) => i);
    const len = qLoc.options.length;
    if (len < 2) return;

    if (!triggeredByDemo && demoShuffleEnabled) setDemoShuffleEnabled(false);

    // Current “t” that the monitor/preview is using
    const tNow = vizMeta[qLoc.id]?.t;

    // Compute a new order that guarantees at least one visible change
    const newOrder = shuffleForVisibleChange(orderLoc, tNow, len);

    setOrders((prev) => ({ ...prev, [qLoc.id]: newOrder }));

    // Recompute the weight at the SAME t using the new display order
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

  // EDGES step → cycle faux shuffle presses (no extra marker motion)
  useEffect(() => {
    if (!demoShuffleEnabled) return;
    let cancelled = false, pressTimer = 0, cycleTimer = 0;
    const cycle = () => {
      if (cancelled) return;
      setDemoShufflePress(true);
      shuffleNow(true);
      pressTimer = window.setTimeout(() => {
        setDemoShufflePress(false);
        if (!cancelled && demoShuffleEnabled) cycleTimer = window.setTimeout(cycle, 1200);
      }, 200);
    };
    cycleTimer = window.setTimeout(cycle, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(pressTimer);
      window.clearTimeout(cycleTimer);
    };
  }, [demoShuffleEnabled]);

  // SHUFFLE (Text Cues) step → smooth drag-like motion, pause, and avoid checkpoints
  useEffect(() => {
    if (!(tutorialMode && step?.id === 'shuffle')) return;

    let cancelled = false;
    let holdTimer = 0;

    // seed ghost from current viz (if any), else keep whatever last ghost had
    if (Number.isFinite(vizMeta[q.id]?.t)) {
      ghostTRef.current = Math.max(0, Math.min(3, Number(vizMeta[q.id].t)));
    }

    const MOVE_MS = 700;
    const HOLD_MS = 2000;
    const MIN_DELTA = 0.6;
    const AVOID_RADIUS = 0.25;

    const isNearCheckpoint = (t) =>
      [0, 1, 2, 3].some((c) => Math.abs(t - c) < AVOID_RADIUS);

    const pickTarget = () => {
      let candidate, tries = 0;
      do {
        candidate = 0.2 + Math.random() * 2.6; // [0.2, 2.8]
        tries++;
        if (tries > 20) break;
      } while (
        Math.abs(candidate - ghostTRef.current) < MIN_DELTA || // <— compare to ref, not local
        isNearCheckpoint(candidate)
      );
      return candidate;
    };

    const hop = () => {
      if (cancelled) return;
      const target = pickTarget();
      animatePreviewTo(target, MOVE_MS);
      holdTimer = window.setTimeout(hop, MOVE_MS + HOLD_MS);
    };

    stopDragDemo(); // don’t run both at once
    hop();

    return () => {
      cancelled = true;
      clearTimeout(holdTimer);
      if (previewAnimRef.current.raf) cancelAnimationFrame(previewAnimRef.current.raf);
      previewAnimRef.current.raf = 0;
      previewAnimRef.current.token++;
    };
  }, [tutorialMode, step?.id, q.id]); 

  // DRAG step → synthetic drag demo
  useEffect(() => {
    stopDragDemo();
    if (tutorialMode && step?.id === 'drag') startDragDemo();
    return () => stopDragDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialMode, step?.id, current, order]);

  function startDragDemo() {
    if (dragDemoRunningRef.current) return;
    dragDemoRunningRef.current = true;
    userInteractedRef.current = false;

    const keyframes = [
      { to: 0.60, dur: 1000 },
      { to: 1.48, dur: 1100 }, // avoid exact midpoint
      { to: 2.30, dur: 1000 },
      { to: 1.02, dur: 1100 }, // avoid exact checkpoint
    ];
    let seg = 0;
    let start = performance.now();
    let from = ghostTRef.current;  // <— start from current ghost
    let to = keyframes[0].to;
    let dur = keyframes[0].dur;
    const ease = (x) => 0.5 * (1 - Math.cos(Math.PI * x));

    const tick = (now) => {
      if (!dragDemoRunningRef.current || !tutorialMode || step?.id !== 'drag') {
        dragDemoRunningRef.current = false;
        return;
      }
      const u = Math.min(1, (now - start) / dur);
      const t = from + (to - from) * ease(u);
      setPreviewT(t);

      if (u >= 1) {
        seg = (seg + 1) % keyframes.length;
        from = to;
        to = keyframes[seg].to;
        dur = keyframes[seg].dur;
        start = now;
      }
      dragTickerRef.current = requestAnimationFrame(tick);
    };
    dragTickerRef.current = requestAnimationFrame(tick);
  }

  function stopDragDemo() {
    dragDemoRunningRef.current = false;
    cancelAnimationFrame(dragTickerRef.current);
  }

  // On user interaction cancel demos/animations
  const handleScaleChange = (w, meta) => {
    if (meta?.dragging || meta?.committed) {
      userInteractedRef.current = true;
      stopDragDemo();
      if (previewAnimRef.current.raf) cancelAnimationFrame(previewAnimRef.current.raf);
      previewAnimRef.current.raf = 0;
      previewAnimRef.current.token++;
      // if the user moved the real thumb, sync ghost to that t
      if (typeof meta?.t === 'number') {
        ghostTRef.current = Math.max(0, Math.min(3, meta.t));
      }
    }

    // Treat the current slider’s value as the truth while moving.
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
    
    // NEW: emit a live average every time the slider moves
    const liveAvg = computeRealtimeAverage(next); // 0..1
    onLiveAverageChange?.(liveAvg, meta);
  };

  const handleNext = () => {
    if (weights[q.id] == null) {
      setError('Make a selection anywhere on the line (tap a dot or between).');
      return;
    }
    setFadeState('fade-out');
    setTimeout(() => {
      setFadeState('fade-in');
      if (current < questions.length - 1) setCurrent((c) => c + 1);
      else onSubmit?.(weights);
    }, 70);
  };

  const handlePrimaryAction = () => {
    if (tutorialMode) {
      const isLastStep = tutorialStepIndex >= TUTORIAL_STEPS.length - 1;
      if (!isLastStep) setTutorialStepIndex((i) => i + 1);
      else endTutorialAndBegin();
      return;
    }
    handleNext();
  };

  const endTutorialAndBegin = () => {
    stopDragDemo();
    setDemoShuffleEnabled(false);
    setDemoShufflePress(false);
    setDemoPrimaryPress(false);
    setTutorialMode(false);
    userInteractedRef.current = false;

    if (previewAnimRef.current.raf) cancelAnimationFrame(previewAnimRef.current.raf);
    previewAnimRef.current.raf = 0;
    previewAnimRef.current.token++;

    setOrders({});
    setVizMeta({});
    setWeights({});
    setError('');
    setCurrent(0);
    setSessionKey((k) => k + 1);
    ghostTRef.current = 1.5;
  };

  const skipTutorial = () => endTutorialAndBegin();

  const currentWeight = weights[q.id] ?? null;
  const currentMeta = vizMeta[q.id] ?? { t: undefined, index: null, committed: false, dragging: false };

  // FIXED: provide else-branch for the tutorial ternary and parenthesize the non-tutorial ternary
  const primaryCtaLabel = tutorialMode
    ? (tutorialStepIndex >= TUTORIAL_STEPS.length - 1 ? 'Begin' : 'Next Tip')
    : (current < questions.length - 1 ? 'Next' : "I'm Ready");

  const { title, body, binder } = getStepContent(step?.id);

  // mark “ghosting” so CSS disables transitions like real drag
  const isGhosting =
    !!tutorialMode &&
    (step?.id === 'drag' || step?.id === 'shuffle') &&
    !currentMeta.dragging;

  // Force ghost visible in Text Cues (disable overlap hiding)
  const forceGhostNow =
    !!tutorialMode && (step?.id === 'drag' || step?.id === 'shuffle');

  return (
    <div className={`survey-section ${fadeState}`} style={{ position: 'relative' }}>
      {error && (
        <div className={`error-container ${fadeState}`}>
          <h2>Heads up</h2>
          <p className="email-tag">{error}</p>
        </div>
      )}

      {/* Tutorial bubble */}
      <HintBubble
        show={!!tutorialMode}
        placement="top"
        bubbleId="weighted-flow"
        stepId={step?.id}
      >
        <div>
          {title ? <h2 style={{ margin: 0 }}>{title}</h2> : null}
          {body ? <h4 className="tip" style={{ margin: '6px 0 0 0' }}>{body}</h4> : null}
          {binder ? (
            <h4
              className="binder"
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => {
                if (tutorialMode && step?.id === 'intro') {
                  setDemoPrimaryPress(true);
                  setTimeout(() => setDemoPrimaryPress(false), 200);
                }
                const isLastStep = tutorialStepIndex >= TUTORIAL_STEPS.length - 1;
                if (!isLastStep) setTutorialStepIndex((i) => i + 1);
                else endTutorialAndBegin();
              }}
              role="button"
              tabIndex={0}
            >
              {binder}
            </h4>
          ) : null}
        </div>

        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <h4
            className="hb-skip"
            onClick={skipTutorial}
            aria-label="Skip tips"
            style={{
              display: 'inline-block',
              opacity: 0.75,
              textDecoration: 'underline',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            role="button"
            tabIndex={0}
          >
            Skip tips
          </h4>
        </div>
      </HintBubble>

      <div className="questionnaire" key={`qwrap-${sessionKey}-${current}`}>
        <QuestionMonitor
          key={`monitor-${resetKey}-${sessionKey}`}
          prompt={q.prompt}
          options={displayOptions}
          t={currentMeta.t}
          qIndex={current}
          qTotal={questions.length}
          isDragging={!!currentMeta.dragging}
          isGhosting={isGhosting}
        />

        <CheckpointScale
          key={`scale-${resetKey}-${sessionKey}`}
          options={displayOptions}
          value={currentWeight}
          resetKey={resetKey}
          onChange={handleScaleChange}
          // Use previewT for tutorial animations
          previewT={tutorialMode ? currentMeta.t : undefined}
          // Keep ghost visible in DRAG and SHUFFLE to avoid overlap hide
          dismissGhostOnDelta={!!tutorialMode && step?.id === 'drag'}
          forceShowGhost={forceGhostNow}
        />

        <div className="survey-actions">
          <button
            type="button"
            className={`shuffle-button ${demoShufflePress ? 'is-demo-press' : ''}`}
            onClick={() => shuffleNow(false)}
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

          <button
            className={`begin-button2 ${demoPrimaryPress ? 'is-demo-press' : ''}`}
            onClick={handlePrimaryAction}
          >
            <span>{primaryCtaLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
