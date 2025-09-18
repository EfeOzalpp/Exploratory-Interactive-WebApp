import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import '../../styles/checkpoint-scale.css';

export default function CheckpointScale({ options, value, initialT = 1.5, resetKey, onChange }) {
  const railRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Tunables
  const MAGNET_WINDOW   = 0.18;
  const MAGNET_STRENGTH = 0.55;
  const MAGNET_POWER    = 2.4;
  const COMMIT_RADIUS   = 0.125;
  const VELOCITY_DISABLE= 2.8;

  const weights = useMemo(() => options.map(o => o.weight), [options]);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Map visual t∈[0,3] to piecewise weight
  const weightAtT = (t) => {
    const clamped = Math.max(0, Math.min(3, t));
    const i = Math.floor(clamped);
    const f = clamped - i;
    if (i >= 3) return weights[3];
    return lerp(weights[i], weights[i + 1], f);
  };

  const [tInternal, setTInternal] = useState(initialT);
  useEffect(() => { setTInternal(initialT); }, [resetKey, initialT]);

  // Velocity sampling for soft-magnet bypass
  const lastSampleRef = useRef({ t: initialT, time: performance.now() });
  const getVelocity = (tNow) => {
    const now = performance.now();
    const dt = Math.max(1, now - lastSampleRef.current.time) / 1000;
    const v = (tNow - lastSampleRef.current.t) / dt;
    lastSampleRef.current = { t: tNow, time: now };
    return v;
  };

  // Soft magnet toward nearest checkpoint
  const softMagnet = (t, vAbs) => {
    if (vAbs > VELOCITY_DISABLE) return t;
    const nearest = Math.round(t);
    const d = t - nearest;
    const ad = Math.abs(d);
    if (ad >= MAGNET_WINDOW) return t;
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

  const emitChange = useCallback((t, committed = false, extraMeta = {}) => {
    const w = weightAtT(t);
    const onCheckpoint = Math.abs(t - Math.round(t)) < 1e-4 ? Math.round(t) : undefined;
    onChange?.(w, { t, index: onCheckpoint, committed, ...extraMeta });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, options]); // weightAtT depends on options

  const updateFromClientX = useCallback((clientX) => {
    const tRaw = tFromClientX(clientX);
    const vAbs = Math.abs(getVelocity(tRaw));
    const tBiased = softMagnet(tRaw, vAbs);
    setTInternal(tBiased);
    emitChange(tBiased, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, emitChange]);

  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    lastSampleRef.current = { t: tInternal, time: performance.now() };
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };

  const onPointerUp = () => {
    setDragging(false);
    const nearest = Math.round(tInternal);
    if (Math.abs(tInternal - nearest) <= COMMIT_RADIUS) {
      setTInternal(nearest);
      emitChange(nearest, true);
    } else {
      emitChange(tInternal, true);
    }
  };

  const handleDotClick = (i) => (e) => {
    e.stopPropagation();
    setTInternal(i);
    emitChange(i, true);
  };

  // Visuals
  const pct = (tInternal / 3) * 100;
  const snappedIndex = Math.abs(tInternal - Math.round(tInternal)) < 1e-4 ? Math.round(tInternal) : null;
  const hitboxRectClass = snappedIndex != null ? 'is-rect' : '';

  // Prime an initial (non-committed) value once per question
  const primedRef = useRef(false);
  useEffect(() => { primedRef.current = false; }, [resetKey]);
  useEffect(() => {
    if (!primedRef.current) {
      primedRef.current = true;
      setTInternal(initialT);
      emitChange(initialT, false, { prime: true });
    }
  }, [initialT, emitChange]);

  return (
    <div className="cp-scale">
      <div
        className="cp-rail"
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        {[0, 1, 2, 3].map((i) => {
          const leftPct = (i / 3) * 100;
          const isActive = snappedIndex === i;
          return (
            <button
              key={i}
              className={`cp-dot ${isActive ? 'is-active' : ''}`}
              style={{ left: `${leftPct}%` }}
              onClick={handleDotClick(i)}
              type="button"
              aria-label={options[i]?.label}
              title={options[i]?.label}
            />
          );
        })}

        <div className={`cp-thumb-hitbox ${hitboxRectClass}`} style={{ left: `${pct}%` }}>
          <div className="cp-thumb" />
        </div>
      </div>
    </div>
  );
}
