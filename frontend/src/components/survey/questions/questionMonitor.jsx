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

  // ---- Responsive Y offset (mobile/tablet/desktop)
  const [viewport, setViewport] = useState('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkViewport = () => {
      const width = window.innerWidth;
      if (width <= 768) setViewport('mobile');
      else if (width <= 1024) setViewport('tablet');
      else setViewport('desktop');
    };
    checkViewport();
    window.addEventListener('resize', checkViewport, { passive: true });
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const quantize = (x, step = 0.02) => {
    if (!Number.isFinite(x)) return 0;
    return Math.round(x / step) * step;
  };
  const nudgeIfCheckpoint = (x, eps = 1e-3) => {
    const nearest = Math.round(x);
    if (Math.abs(x - nearest) < eps) return x <= nearest ? nearest - eps : nearest + eps;
    return x;
  };
  const stableT = useMemo(() => {
    const clamped = Math.max(0, Math.min(3, Number(tDeferred ?? 0)));
    return nudgeIfCheckpoint(quantize(clamped, 0.02), 0.001);
  }, [tDeferred]);

  const snappedIndexFromStable = Number.isInteger(stableT) ? Math.round(stableT) : null;

  const opacities = useMemo(
    () => getAnswerOpacities(stableT, snappedIndexFromStable),
    [stableT, snappedIndexFromStable]
  );
  const scales = useMemo(
    () => getScaleActivations(stableT, snappedIndexFromStable),
    [stableT, snappedIndexFromStable]
  );

  const i = Math.floor(stableT);
  const f = stableT - i;
  const j = Math.min(i + 1, options.length - 1);

  const BASE_SCALE = 0.965;
  const GROW = 0.50;

  // Y-offsets tuned per viewport
  const Y_OFFSET_DESKTOP = 22;
  const Y_OFFSET_TABLET  = 36;
  const Y_OFFSET_MOBILE  = 36;

  const Y_OFFSET =
    viewport === 'mobile'
      ? Y_OFFSET_MOBILE
      : viewport === 'tablet'
      ? Y_OFFSET_TABLET
      : Y_OFFSET_DESKTOP;

  const CURVE_EXP = 1.0;

  const tent = (x) => {
    const v = 4 * x * (1 - x);
    return Math.max(0, v) ** CURVE_EXP;
  };

  // Round scale to discrete steps to reduce glyph resampling artifacts
  const scaleFromActivation = (a) => {
    const raw = BASE_SCALE + GROW * a;
    const stepped = [0.96, 0.98, 1, 1.02, 1.05, 1.1];
    let sc = 1;
    let minD = Infinity;
    for (const s of stepped) {
      const d = Math.abs(s - raw);
      if (d < minD) { minD = d; sc = s; }
    }
    return sc;
  };

  const snapPx = (px) => {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    return Math.round(px * dpr) / dpr;
  };

  // Translate text container only (keeps text crisp). Scale a visual wrapper inside.
  const translateFor = (idx) => {
    let dy = 0;
    if (!Number.isInteger(stableT)) {
      if (idx === i && idx !== j) dy = +Y_OFFSET * tent(f);
      else if (idx === j && idx !== i) dy = -Y_OFFSET * tent(f);
    }
    const dySnapped = snapPx(dy);
    return `translate(-50%, calc(-50% + ${dySnapped}px))`; // 2D translate (avoid 3D)
  };

  const zFor = (activation) => (activation >= 0.5 ? 2 : 1);

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
            const act     = scales[k] ?? 0;
            const snapped = snappedIndexFromStable === k;
            const sc      = scaleFromActivation(act);

            return (
              <div
                key={k}
                className={`qm-answer-abs ${snapped ? 'is-selected' : ''}`}
                style={{
                  opacity,
                  transform: translateFor(k),
                  zIndex: zFor(act),
                }}
              >
                {/* Visual wrapper scales; text inside stays unscaled for crispness */}
                <div
                  className="qm-answer-visual"
                  style={{
                    transform: `scale(${sc})`,
                    transformOrigin: '50% 50%',
                    willChange: isDragging ? 'transform' : undefined,
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
