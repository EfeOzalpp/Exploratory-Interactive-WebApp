import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import '../../styles/checkpoint-scale.css';

export default function CheckpointScale({
  options,
  value,                 // preserved for API compat (unused)
  initialT = 1.5,
  resetKey,
  onChange,
  // NEW: tutorial-friendly props
  t,                     // when provided, the thumb becomes controlled (0..3)
  interactive = true,    // gate pointer handlers (tutorial uses false)
  showDots = true,       // hide dots in tutorial to avoid “discrete-only” implication
  // NEW: do not emit weights (tutorial safety)
  weightless = false,
}) {
  const railRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Tunables
  const MAGNET_WINDOW    = 0.18;
  const MAGNET_STRENGTH  = 0.55;
  const MAGNET_POWER     = 2.4;
  const COMMIT_RADIUS    = 0.125;
  const VELOCITY_DISABLE = 2.8;

  const weights = useMemo(() => options.map(o => o.weight), [options]);
  const lerp = (a, b, t) => a + (b - a) * t;

  const weightAtT = (tval) => {
    const clamped = Math.max(0, Math.min(3, tval));
    const i = Math.floor(clamped);
    const f = clamped - i;
    if (i >= 3) return weights[3];
    return lerp(weights[i], weights[i + 1], f);
  };

  const [tInternal, setTInternal] = useState(initialT);

  // Reset on question change
  useEffect(() => { setTInternal(initialT); }, [resetKey, initialT]);

  // Controlled mode: mirror parent 't' if provided
  useEffect(() => {
    if (typeof t === 'number') {
      const clamped = Math.max(0, Math.min(3, t));
      setTInternal(clamped);
    }
  }, [t]);

  // Prime answers so monitor shows immediately on first mount
  const primedRef = useRef(false);
  useEffect(() => { primedRef.current = false; }, [resetKey]);
  useEffect(() => {
    if (!primedRef.current) {
      primedRef.current = true;
      setTInternal(initialT);
      const w = weightless ? null : weightAtT(initialT); // ← only change here
      onChange?.(w, {
        t: initialT,
        index: Math.abs(initialT - Math.round(initialT)) < 1e-4 ? Math.round(initialT) : undefined,
        committed: false,
        prime: true,
        dragging: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialT, onChange, options, weightless]);

  // Velocity sampling for soft-magnet bypass
  const lastSampleRef = useRef({ t: initialT, time: (typeof performance !== 'undefined' ? performance.now() : 0) });
  const getVelocity = (tNow) => {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = Math.max(1, now - lastSampleRef.current.time) / 1000;
    const v = (tNow - lastSampleRef.current.t) / dt;
    lastSampleRef.current = { t: tNow, time: now };
    return v;
  };

  const softMagnet = (tval, vAbs) => {
    if (vAbs > VELOCITY_DISABLE) return tval;
    const nearest = Math.round(tval);
    const d = tval - nearest;
    const ad = Math.abs(d);
    if (ad >= MAGNET_WINDOW) return tval;
    const x = 1 - ad / MAGNET_WINDOW;
    const falloff = Math.pow(x, MAGNET_POWER);
    const bias = MAGNET_STRENGTH * falloff;
    return nearest + d * (1 - bias);
  };

  const tFromClientX = (clientX) => {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    const x = Math.max(rect.left, Math.min(clientX, rect.right));
    const ratio = (x - rect.left) / Math.max(1, rect.width);
    return ratio * 3;
  };

  const emitChange = useCallback((tval, committed = false, extraMeta = {}) => {
    const w = weightless ? null : weightAtT(tval); // ← only change here
    const onCheckpoint = Math.abs(tval - Math.round(tval)) < 1e-4 ? Math.round(tval) : undefined;
    onChange?.(w, { t: tval, index: onCheckpoint, committed, ...extraMeta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, options, weightless]);

  const updateFromClientX = useCallback((clientX) => {
    const tRaw = tFromClientX(clientX);
    const vAbs = Math.abs(getVelocity(tRaw));
    const tBiased = softMagnet(tRaw, vAbs);
    setTInternal(tBiased);
    emitChange(tBiased, false, { dragging: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, emitChange]);

  // Pointer handlers (gated by `interactive`)
  const onPointerDown = (e) => {
    if (!interactive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    lastSampleRef.current = {
      t: tInternal,
      time: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    };
    updateFromClientX(e.clientX);
    emitChange(tInternal, false, { dragging: true });
  };

  const onPointerMove = (e) => {
    if (!interactive || !dragging) return;
    updateFromClientX(e.clientX);
  };

  const endDrag = (commit = true) => {
    if (!interactive) return;
    setDragging(false);
    const nearest = Math.round(tInternal);
    if (commit) {
      if (Math.abs(tInternal - nearest) <= COMMIT_RADIUS) {
        setTInternal(nearest);
        emitChange(nearest, true, { dragging: false });
      } else {
        emitChange(tInternal, true, { dragging: false });
      }
    } else {
      emitChange(tInternal, false, { dragging: false });
    }
  };

  const onPointerUp     = () => endDrag(true);
  const onPointerCancel = () => endDrag(false);

  const handleDotClick = (i) => (e) => {
    if (!interactive) return;
    e.stopPropagation();
    setTInternal(i);
    emitChange(i, true, { dragging: false });
  };

  // Visuals
  const pct = (tInternal / 3) * 100;
  const snappedIndex = Math.abs(tInternal - Math.round(tInternal)) < 1e-4 ? Math.round(tInternal) : null;
  const hitboxRectClass = snappedIndex != null ? 'is-rect' : '';

  return (
    <div className="cp-scale">
      <div
        className="cp-rail"
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: interactive ? 'none' : 'auto', position: 'relative' }}
      >
        {/* Optional checkpoint dots */}
        {showDots && [0, 1, 2, 3].map((i) => {
          const leftPct = (i / 3) * 100;
          const isActive = snappedIndex === i;
          return (
            <button
              key={i}
              className={`cp-dot ${isActive ? 'active' : ''}`}
              style={{ left: `${leftPct}%` }}
              onClick={handleDotClick(i)}
              type="button"
              aria-label={options[i]?.label}
              title={options[i]?.label}
            />
          );
        })}

        {/* Real thumb (on top) */}
        <div className={`cp-thumb-hitbox ${hitboxRectClass}`} style={{ left: `${pct}%`, zIndex: 3 }}>
          <div className="cp-thumb" />
        </div>
      </div>
    </div>
  );
}
