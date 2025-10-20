import React, { useEffect, useRef, useState, Suspense } from 'react';
// NOTE: path is from /survey/tutorial → /survey
import CheckpointScale from './checkpointScale.js';
import QuestionMonitor from './questions/questionMonitor.jsx';
import '../../styles/hint-bubble.css'; // keep your existing styles if needed

const Lottie = React.lazy(() =>
  import(/* webpackChunkName: "lottie-react" */ 'lottie-react')
);

type TutorialProps = { onFinish: () => void };
type Step = { id: 'drag' | 'blend' | 'shuffle'; title: string; copy: string };

/** Weightless sample options — labels only (no weights) */
const DEMO_OPTIONS = [
  { label: 'A sealed envelope with your name on it' },
  { label: 'A voicemail from your future self' },
  { label: 'An empty room with music playing' },
  { label: 'A map that redraws itself at night' },
];

const STEPS: Step[] = [
  { id: 'drag',    title: 'Drag the knob',   copy: 'Anywhere on the line works.' },
  { id: 'blend',   title: 'Blend answers',   copy: 'Pause between two to blend them.' },
  { id: 'shuffle', title: 'Shuffle answers', copy: 'Mix and match the answers with shuffle.' },
];

/* ---------------------------------------------------
   Shuffle helper (ensures a visible change at current t)
   Mirrors behavior in QuestionFlowWeighted.shuffleForVisibleChange
--------------------------------------------------- */
function shuffleForVisibleChange(orderIn: number[], tNow: number, len: number) {
  if (!Number.isFinite(tNow)) {
    let out = orderIn;
    // Fisher–Yates until order differs
    do {
      const a = orderIn.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      out = a;
    } while (out.every((v, i) => v === orderIn[i]));
    return out;
  }

  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
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

/* ---------------------------------------------------
   👋 HandHint
--------------------------------------------------- */
function HandHint({
  t,
  stage,
  onComplete,
}: {
  t: number;
  stage: 'intro' | 'pause' | 'release' | 'hidden';
  onComplete?: () => void;
}) {
  const lottieRef = useRef<any>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    import(/* webpackChunkName:"lottie-hand" */ '../../lottie-for-UI/hand.json')
      .then((mod) => { if (alive) setData(mod.default || mod); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const inst = lottieRef.current;
    if (!inst) return;
    inst.setSpeed?.(1);

    if (stage === 'intro')   { inst.playSegments?.([0, 15], true); return; }
    if (stage === 'pause')   { inst.goToAndStop?.(15, true);       return; }
    if (stage === 'release') { inst.playSegments?.([15, 25], true);return; }
    if (stage === 'hidden')  { inst.stop?.();                      return; }
  }, [stage, data]);

  const handleComplete = () => {
    const inst = lottieRef.current;
    if (!inst) return;
    if (stage === 'intro')   inst.goToAndStop?.(15, true);
    if (stage === 'release') onComplete?.();
  };

  const positionPercent = `${(t / 3) * 100}%`;

  return (
    <div
      className={`hand-hint ${stage !== 'hidden' ? 'visible' : ''}`}
      style={{
        left: positionPercent,
        position: 'absolute',
        top: 0,
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      <Suspense fallback={null}>
        {data && (
          <Lottie
            lottieRef={lottieRef}
            animationData={data}
            loop={false}
            autoplay={false}
            onComplete={handleComplete}
          />
        )}
      </Suspense>
    </div>
  );
}

/* ---------------------------------------------------
   🧩 Tutorial — ghost/preview t + “Here!” marker in step 2
--------------------------------------------------- */
export default function Tutorial({ onFinish }: TutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);

  // what the monitor should show (we set this sparsely)
  const [vizT, setVizT] = useState(1.5);

  // single source of truth for animation starts
  const ghostTRef = useRef(1.5);

  // order for demo options (used by shuffle demo)
  const [order, setOrder] = useState([0, 1, 2, 3]);

  // hand hint stage — keep mounted in step 1 but PAUSED so it never auto-plays
  const [handStage, setHandStage] =
    useState<'intro' | 'pause' | 'release' | 'hidden'>('pause');

  // anim refs
  const rafRef = useRef<number>(0);
  const previewAnimRef = useRef({ raf: 0, token: 0 });

  // track whether user actually *dragged* (not just clicked) in step 1
  const DRAG_MIN_DELTA = 0.03; // minimum movement in t-units to count as a drag
  const [tAtDragStart, setTAtDragStart] = useState<number | null>(null);
  const [didDragThisStep, setDidDragThisStep] = useState(false);

  // ⏭ auto-advance timer (start only AFTER a real drag is released in step 1)
  const advanceTimerRef = useRef<number | null>(null);
  const scheduleAdvanceFromDragRelease = () => {
    if (advanceTimerRef.current != null) return;
    advanceTimerRef.current = window.setTimeout(() => {
      setStepIndex((s) => Math.min(s + 1, STEPS.length - 1));
      advanceTimerRef.current = null;
    }, 2000);
  };
  const cancelAdvanceTimer = () => {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  // ⏭ auto-advance for step 2 (blend) — after reaching the marker, wait ~4s
  const blendTimerRef = useRef<number | null>(null);
  const scheduleAdvanceFromBlendReach = () => {
    if (blendTimerRef.current != null) return;
    blendTimerRef.current = window.setTimeout(() => {
      setStepIndex((s) => Math.min(s + 1, STEPS.length - 1));
      blendTimerRef.current = null;
    }, 8000);
  };
  const cancelBlendTimer = () => {
    if (blendTimerRef.current != null) {
      window.clearTimeout(blendTimerRef.current);
      blendTimerRef.current = null;
    }
  };

  // clear timers on unmount
  useEffect(() => {
    return () => {
      cancelAdvanceTimer();
      cancelBlendTimer();
    };
  }, []);

  // also cancel relevant timers when leaving their steps
  useEffect(() => {
    if (STEPS[stepIndex]?.id !== 'drag') cancelAdvanceTimer();
    if (STEPS[stepIndex]?.id !== 'blend') cancelBlendTimer();

    // reset click/drag tracking when step changes
    setTAtDragStart(null);
    setDidDragThisStep(false);
  }, [stepIndex]);

  // “Here!” marker (step 2 only)
  const MARKER_T = 2.18;            // ~70% along a 0..3 rail
  const MARKER_TOL = 0.08;          // counts as "hit"
  const SNAP_ON_DRAG_RADIUS = 0.12; // snap when dragging within this window
  const [reachedMarker, setReachedMarker] = useState(false);
  const [markerHiding, setMarkerHiding] = useState(false); // animate out
  const [showMarker, setShowMarker] = useState(false);     // mounted only in BLEND

  const stopRAF = () => cancelAnimationFrame(rafRef.current);
  const cancelPreview = () => {
    if (previewAnimRef.current.raf) cancelAnimationFrame(previewAnimRef.current.raf);
    previewAnimRef.current.raf = 0;
    previewAnimRef.current.token++;
  };

  // set preview t consistently (updates monitor + ghost source)
  const setPreviewT = (t: number) => {
    const clamped = Math.max(0, Math.min(3, t));
    ghostTRef.current = clamped;
    setVizT(clamped);
  };

  // animate preview t from current ghost → target
  const animatePreviewTo = (targetT: number, duration = 900) => {
    cancelPreview();
    const token = ++previewAnimRef.current.token;

    const startT = Math.max(0, Math.min(3, ghostTRef.current));
    const endT   = Math.max(0, Math.min(3, targetT));
    const start  = performance.now();
    const ease   = (x: number) => 0.5 * (1 - Math.cos(Math.PI * x));

    const tick = (now: number) => {
      if (previewAnimRef.current.token !== token) return;
      const u = Math.min(1, Math.max(0, (now - start) / duration));
      const v = startT + (endT - startT) * ease(u);
      setPreviewT(v);
      if (u < 1) previewAnimRef.current.raf = requestAnimationFrame(tick);
    };

    previewAnimRef.current.raf = requestAnimationFrame(tick);
  };

  // step orchestration
  useEffect(() => {
    stopRAF();
    cancelPreview();

    const id = STEPS[stepIndex]?.id;

    // reset marker & copy per step
    const onBlend = id === 'blend';
    setShowMarker(onBlend);
    setReachedMarker(false);
    setMarkerHiding(false);

    if (id === 'drag') {
      // keep the hand mounted but PAUSED so it never auto-plays while user interacts
      setHandStage('pause');

      // synthetic drag keyframes, avoiding exact midpoint/checkpoints
      const kf = [
        { to: 0.60, dur: 900 },
        { to: 1.46, dur: 900 },
        { to: 2.25, dur: 900 },
        { to: 1.05, dur: 900 },
      ];
      let seg = 0;
      let start = performance.now();
      let from  = ghostTRef.current;
      let to    = kf[0].to;
      let dur   = kf[0].dur;
      const ease = (x: number) => 0.5 * (1 - Math.cos(Math.PI * x));

      const loop = (now: number) => {
        const u = Math.min(1, (now - start) / dur);
        const v = from + (to - from) * ease(u);
        setPreviewT(v);
        if (u >= 1) {
          seg = (seg + 1) % kf.length;
          from = to;
          to   = kf[seg].to;
          dur  = kf[seg].dur;
          start = now;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }

    if (id === 'blend') {
      setHandStage('hidden'); // hide hand on steps 2 & 3
      // start centered; user moves to the marker (70%)
      animatePreviewTo(1.5, 500);
    }

    if (id === 'shuffle') {
      setHandStage('hidden'); // hide hand
      // DO NOT move the thumb when entering shuffle
      animatePreviewTo(ghostTRef.current, 0);
      const swapLater = window.setTimeout(() => {
        setOrder((o) => {
          const a = o.slice();
          [a[1], a[2]] = [a[2], a[1]];
          return a;
        });
      }, 600);
      return () => window.clearTimeout(swapLater);
    }

    return () => {
      stopRAF();
      cancelPreview();
    };
  }, [stepIndex]);

  // advance logic
  const goNext = () => setStepIndex((s) => Math.min(STEPS.length - 1, s + 1));
  const currentStep = STEPS[stepIndex];
  const isLast = currentStep.id === 'shuffle';

  // 🔄 Updated shuffle: ensure a visible change at current t (weightless)
  const shuffleNow = () => {
    setOrder((prev) => {
      const len = prev.length;
      const tNow = ghostTRef.current; // the same t the tutorial displays
      return shuffleForVisibleChange(prev, tNow, len);
    });
    // Intentionally do NOT animate the preview or move the thumb.
  };

  const displayOptions = order.map((i) => DEMO_OPTIONS[i]);

  // user movement; update marker logic
  const handleScaleChange = (_w: number | null, meta?: { t?: number; dragging?: boolean; committed?: boolean }) => {
    if (typeof meta?.t === 'number') {
      // clamp live t
      let clamped = Math.max(0, Math.min(3, meta.t));

      // 🔒 Snap-to-marker ONLY when nearby *and dragging* in step 2 (blend)
      if (STEPS[stepIndex]?.id === 'blend' && meta.dragging) {
        if (Math.abs(clamped - MARKER_T) <= SNAP_ON_DRAG_RADIUS) {
          clamped = MARKER_T;
        }
      }

      // track click vs real drag in step 1
      if (STEPS[stepIndex]?.id === 'drag') {
        if (meta.dragging) {
          if (tAtDragStart == null) {
            setTAtDragStart(clamped);
          } else if (!didDragThisStep && Math.abs(clamped - tAtDragStart) >= DRAG_MIN_DELTA) {
            setDidDragThisStep(true);
          }
        }
      }

      ghostTRef.current = clamped;
      setVizT(clamped);
    }

    // DO NOT trigger the hand animation during user drag — keep it paused in step 1
    if (meta?.dragging) {
      stopRAF();
      cancelPreview();
    }

    // ✅ Only handle "marker reached" AFTER a release/commit in step 2
    if (meta?.committed && STEPS[stepIndex]?.id === 'blend') {
      const hit = Math.abs(ghostTRef.current - MARKER_T) <= MARKER_TOL;
      if (hit && showMarker && !reachedMarker) {
        setReachedMarker(true);
        setMarkerHiding(true);
        window.setTimeout(() => setShowMarker(false), 500);
        scheduleAdvanceFromBlendReach(); // start the ~4s auto-advance
      }
    }

    // ✅ Only start the 2s timer after the user RELEASES a real drag in step 1
    if (meta?.committed && STEPS[stepIndex]?.id === 'drag') {
      stopRAF();
      cancelPreview();

      if (didDragThisStep) {
        scheduleAdvanceFromDragRelease();
      } else {
        cancelAdvanceTimer();
      }
      setTAtDragStart(null);
      setDidDragThisStep(false);
    }
  };

  // dynamic copy in the tutorial-card (header)
  const cardCopy =
    currentStep.id === 'blend'
      ? (reachedMarker ? (
          <>
            This sits between both answers.
            <br />
            Leaning toward the empty room with music.
          </>
        ) : (
          'Drag the dot to the marked spot.'
        ))
      : currentStep.copy;

  const MARKER_TOP = 12;

  return (
    <div className="survey-section tutorial-card-wrap">
      <div className="tutorial-card">
        <div className="tutorial-header">
          <div className="qm-title is-between">
            {currentStep.title}
          </div>
          <div className="tip tutorial-tip">{cardCopy}</div>
        </div>
      </div>

      <div className="questionnaire" style={{ position: 'relative' }}>
        {/* monitor reads vizT */}
        <QuestionMonitor
          options={displayOptions}
          t={vizT}
          isDragging={false}
          isGhosting={currentStep.id !== 'shuffle'}
        />

        {/* marker only in BLEND step */}
        {showMarker && (
          <div
            className={`here-marker-wrap ${markerHiding ? 'is-complete' : ''}`}
            style={{ left: `${(MARKER_T / 3) * 100}%`, top: `${MARKER_TOP}px` }}
            aria-hidden
          >
            <div className={`here-label ${reachedMarker ? 'is-reached' : ''}`}>Here!</div>
            <div className={`here-arrow ${reachedMarker ? 'is-dim' : ''}`}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M12 4v12M6 10l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        )}

        <CheckpointScale
          options={displayOptions}
          resetKey="tutorial-demo"
          onChange={handleScaleChange}
          /** critical: tutorial is fully weightless */
          weightless={true}
          /** tutorial visuals */
          dismissGhostOnDelta={false}
          forceShowGhost={false}
          showDots={false}
          interactive={true}
          /** controlled so snap reflects immediately */
          t={vizT}
        />

        {/* Hand stays mounted in step 1 but is paused;
            never animates during user drag */}
        {currentStep.id === 'drag' && handStage !== 'hidden' && (
          <HandHint
            t={vizT}
            stage={handStage} // 'pause' the whole time in step 1
            onComplete={() => setHandStage('hidden')}
          />
        )}

        <div className="survey-actions">
          {isLast && (
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
          )}

          {stepIndex < STEPS.length - 1 ? (
            <button type="button" className="begin-button2" onClick={() => setStepIndex((s) => Math.min(s + 1, STEPS.length - 1))}>
              <span>Next Tip</span>
            </button>
          ) : (
            <button type="button" className="begin-button2" onClick={onFinish}>
              <span>Begin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
