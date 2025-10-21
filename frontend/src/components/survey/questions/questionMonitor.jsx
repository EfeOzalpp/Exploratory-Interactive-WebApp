import React, { useMemo, useEffect, useState, useDeferredValue, memo } from 'react';
import { getAnswerOpacities, getScaleActivations } from '../../survey/answerBlend.ts';

function QuestionMonitorInner({
  prompt,
  options,
  t,
  qIndex,
  qTotal,
  isDragging = false,
  isGhosting = false,
}) {
  const tDeferred = useDeferredValue(t);

  // ---------- Responsive Y offset (mobile/tablet/desktop)
  const [viewport, setViewport] = useState('desktop');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkViewport = () => {
      const w = window.innerWidth;
      if (w <= 768) setViewport('mobile');
      else if (w <= 1024) setViewport('tablet');
      else setViewport('desktop');
    };
    checkViewport();
    window.addEventListener('resize', checkViewport, { passive: true });
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // ---------- Stable t (quantized & nudged off exact checkpoints)
  const quantize = (x, step = 0.02) => (!Number.isFinite(x) ? 0 : Math.round(x / step) * step);
  const nudgeIfCheckpoint = (x, eps = 1e-3) => {
    const nearest = Math.round(x);
    return Math.abs(x - nearest) < eps ? (x <= nearest ? nearest - eps : nearest + eps) : x;
  };
  const stableT = useMemo(() => {
    const clamped = Math.max(0, Math.min(3, Number(tDeferred ?? 0)));
    return nudgeIfCheckpoint(quantize(clamped, 0.02), 0.001);
  }, [tDeferred]);

  const snappedIndexFromStable = Number.isInteger(stableT) ? Math.round(stableT) : null;

  // ---------- Blending fields
  const opacities = useMemo(
    () => getAnswerOpacities(stableT, snappedIndexFromStable),
    [stableT, snappedIndexFromStable]
  );
  const activations = useMemo(
    () => getScaleActivations(stableT, snappedIndexFromStable),
    [stableT, snappedIndexFromStable]
  );

  // ---------- Neighbors / mix fraction
  const i = Math.floor(stableT);
  const f = stableT - i;
  const j = Math.min(i + 1, options.length - 1);

  // ---------- Tunables
  const BASE_SCALE = 0.9;
  const GROW = 0.85;          // base scale growth from activation
  const BOOST_MAX = 0.22;     // extra bias for the nearer answer
  const BASE_SEPARATION = 10; // px separation when near equal blend

  const Y_OFFSET_DESKTOP = 32;
  const Y_OFFSET_TABLET  = 38;
  const Y_OFFSET_MOBILE  = 46;
  const Y_OFFSET =
    viewport === 'mobile' ? Y_OFFSET_MOBILE :
    viewport === 'tablet' ? Y_OFFSET_TABLET : Y_OFFSET_DESKTOP;

  const tent = (x) => Math.max(0, 4 * x * (1 - x)); // 0..1 bell

  const snapPx = (px) => {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    return Math.round(px * dpr) / dpr;
  };

  // ---------- Proximity-biased scale (closer answer pops more)
  const easeOut = (x) => 1 - Math.pow(1 - x, 2.2); // smooth bias
  const scaleForIdx = (a, idx) => {
    const shaped = Math.pow(a, 0.7);
    const raw = BASE_SCALE + GROW * shaped;

    const dist = Math.abs(stableT - idx);      // 0 when knob is right on the index
    const proximity = Math.max(0, 1 - dist);   // 1 near, 0 far
    const boost = easeOut(proximity) * BOOST_MAX;

    const s = raw + boost;
    return Math.max(0.9, Math.min(1.35, s));
  };

  // ---------- Positioning with separation at equal blend
  const translateFor = (idx) => {
    let dyCore = 0;

    // Main lift/drop for the two active answers while between them
    if (!Number.isInteger(stableT)) {
      if (idx === i && idx !== j) dyCore = +Y_OFFSET * tent(f);
      else if (idx === j && idx !== i) dyCore = -Y_OFFSET * tent(f);
    }

    // Extra separation when the mix is near the midpoint to reduce overlap
    let sep = 0;
    if (!Number.isInteger(stableT) && i !== j) {
      // 1 at exact midpoint, 0 at ends
      const centerMix = Math.max(0, 1 - Math.abs(f - 0.5) * 2);
      const dir = idx === i ? -1 : (idx === j ? +1 : 0); // push apart
      sep = dir * BASE_SEPARATION * centerMix;
    }

    const dy = snapPx(dyCore + sep);
    return `translate(-50%, calc(-50% + ${dy}px))`;
  };

  const zFor = (activation, idx) => {
    // closer item should be on top
    const dist = Math.abs(stableT - idx);
    return dist < 0.45 ? 3 : activation >= 0.5 ? 2 : 1;
  };

  return (
    <div className="qm-wrap">
      <div className="qm-card">
        <div className="qm-header">
          <div className={`qm-title ${Number.isInteger(snappedIndexFromStable) ? 'is-snapped' : 'is-between'}`}>
            {Number.isFinite(qIndex) && Number.isFinite(qTotal) && (
              <span className="qm-count">{qIndex + 1}/{qTotal} — </span>
            )}
            {prompt}
          </div>
        </div>

        <div className={`qm-stage ${isDragging ? 'is-dragging' : ''} ${isGhosting ? 'is-ghosting' : ''}`}>
          {options.map((o, k) => {
            const opacity = opacities[k] ?? 0;
            const act     = activations[k] ?? 0;

            return (
              <div
                key={k}
                className={`qm-answer-abs ${snappedIndexFromStable === k ? 'is-selected' : ''}`}
                style={{
                  opacity,
                  transform: translateFor(k),
                  zIndex: zFor(act, k),
                }}
              >
                {/* Scales text and chip together while keeping absolute centering intact */}
                <div
                  className="qm-scale-wrap"
                  style={{
                    transform: `scale(${scaleForIdx(act, k)})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
                    willChange: 'transform',
                  }}
                >
                  <h3 className="qm-answer-chip">{o.label}</h3>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Prevent rerenders unless t/options have materially changed
const propsAreEqual = (prev, next) => {
  if (prev.prompt !== next.prompt) return false;
  if (prev.qIndex !== next.qIndex || prev.qTotal !== next.qTotal) return false;
  if (prev.isDragging !== next.isDragging || prev.isGhosting !== next.isGhosting) return false;
  if (prev.t === next.t) {
    if (prev.options === next.options) return true;
    if (prev.options.length !== next.options.length) return false;
    for (let i = 0; i < prev.options.length; i++) {
      const a = prev.options[i], b = next.options[i];
      if (a.label !== b.label || a.weight !== b.weight) return false;
    }
    return true;
  }
  return false;
};

export default memo(QuestionMonitorInner, propsAreEqual);
