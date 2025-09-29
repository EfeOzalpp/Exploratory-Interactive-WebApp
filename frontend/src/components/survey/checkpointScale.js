// src/components/survey/checkpointScale.jsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import '../../styles/checkpoint-scale.css';

export default function CheckpointScale({
  options,
  value,                 // preserved for API compat (unused)
  initialT = 1.5,
  resetKey,
  onChange,
  previewT,              // ghost/preview position when not dragging
  dismissGhostOnDelta = false, // only dismiss ghost by delta when true (use on 2nd hint)
  // NEW: always show ghost regardless of previous dismissal (e.g., during shuffle step)
  forceShowGhost = false,
}) {
  const railRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Tunables
  const MAGNET_WINDOW    = 0.18;
  const MAGNET_STRENGTH  = 0.55;
  const MAGNET_POWER     = 2.4;
  const COMMIT_RADIUS    = 0.125;
  const VELOCITY_DISABLE = 2.8;
  const DISMISS_GHOST_DELTA = 0.3; // ≈10% of the 0..3 rail — used only if dismissGhostOnDelta

  // Overlap hysteresis for ghost thumb (prevents ghost/real swap flicker)
  const OVERLAP_HIDE_T = 0.03;
  const OVERLAP_SHOW_T = 0.05;

  // Hysteresis for the *ghosted checkpoint dot* (prevents dot ghost flicker)
  const DOT_HIDE_T = 0.03;
  const DOT_SHOW_T = 0.05;

  const weights = useMemo(() => options.map(o => o.weight), [options]);
  const lerp = (a, b, t) => a + (b - a) * t;

  const weightAtT = (t) => {
    const clamped = Math.max(0, Math.min(3, t));
    const i = Math.floor(clamped);
    const f = clamped - i;
    if (i >= 3) return weights[3];
    return lerp(weights[i], weights[i + 1], f);
  };

  const [tInternal, setTInternal] = useState(initialT);
  useEffect(() => { setTInternal(initialT); }, [resetKey, initialT]);

  // Prime answers so monitor shows immediately
  const primedRef = useRef(false);
  useEffect(() => { primedRef.current = false; }, [resetKey]);
  useEffect(() => {
    if (!primedRef.current) {
      primedRef.current = true;
      setTInternal(initialT);
      const w = weightAtT(initialT);
      onChange?.(w, {
        t: initialT,
        index: Math.abs(initialT - Math.round(initialT)) < 1e-4 ? Math.round(initialT) : undefined,
        committed: false,
        prime: true,
        dragging: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialT, onChange, options]);

  // Velocity sampling for soft-magnet bypass
  const lastSampleRef = useRef({ t: initialT, time: (typeof performance !== 'undefined' ? performance.now() : 0) });
  const getVelocity = (tNow) => {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = Math.max(1, now - lastSampleRef.current.time) / 1000;
    const v = (tNow - lastSampleRef.current.t) / dt;
    lastSampleRef.current = { t: tNow, time: now };
    return v;
  };

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
  }, [onChange, options]);

  const updateFromClientX = useCallback((clientX) => {
    const tRaw = tFromClientX(clientX);
    const vAbs = Math.abs(getVelocity(tRaw));
    const tBiased = softMagnet(tRaw, vAbs);
    setTInternal(tBiased);
    emitChange(tBiased, false, { dragging: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, emitChange]);

  // Track movement since gesture start to dismiss ghost (user drag only, optional)
  const dragStartTRef = useRef(initialT);
  const hideGhostRef  = useRef(false);
  const [hideGhost, setHideGhost] = useState(false);

  // Overlap suppression for ghost thumb (hysteresis)
  const overlapSuppressedRef = useRef(false);

  // Hysteresis for ghosted *dot* near integers
  const dotGhostSuppressedRef = useRef(false);

  useEffect(() => {
    // reset ghost dismissal & hysteresis on question change
    hideGhostRef.current = false;
    setHideGhost(false);
    overlapSuppressedRef.current = false;
    dotGhostSuppressedRef.current = false;
  }, [resetKey]);

  const onPointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStartTRef.current = tInternal;
    lastSampleRef.current = {
      t: tInternal,
      time: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    };
    updateFromClientX(e.clientX);
    emitChange(tInternal, false, { dragging: true });
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);

    if (dismissGhostOnDelta && !hideGhostRef.current) {
      const nowT = tFromClientX(e.clientX);
      if (Math.abs(nowT - dragStartTRef.current) >= DISMISS_GHOST_DELTA) {
        hideGhostRef.current = true;
        setHideGhost(true);
      }
    }
  };

  const endDrag = (commit = true) => {
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

  const onPointerUp = () => endDrag(true);
  const onPointerCancel = () => endDrag(false);

  const handleDotClick = (i) => (e) => {
    e.stopPropagation();
    if (!hideGhostRef.current) {
      hideGhostRef.current = true;
      setHideGhost(true);
    }
    setTInternal(i);
    emitChange(i, true, { dragging: false });
  };

  // Effective ghost hide (can be overridden by forceShowGhost)
  const effectiveHideGhost = forceShowGhost ? false : hideGhost;

  // Visuals
  const pct = (tInternal / 3) * 100;
  const snappedIndex = Math.abs(tInternal - Math.round(tInternal)) < 1e-4 ? Math.round(tInternal) : null;
  const hitboxRectClass = snappedIndex != null ? 'is-rect' : '';

  // Ghost/Preview thumb (with overlap hysteresis)
  let ghostT =
    !dragging &&
    !effectiveHideGhost &&
    Number.isFinite(previewT)
      ? Math.max(0, Math.min(3, Number(previewT)))
      : null;

  if (ghostT != null) {
    const d = Math.abs(ghostT - tInternal);
    if (!overlapSuppressedRef.current && d < OVERLAP_HIDE_T) {
      overlapSuppressedRef.current = true;
    } else if (overlapSuppressedRef.current && d > OVERLAP_SHOW_T) {
      overlapSuppressedRef.current = false;
    }
  } else {
    overlapSuppressedRef.current = false;
  }

  const showGhostThumb = ghostT != null && !overlapSuppressedRef.current;
  const ghostPct = showGhostThumb ? (ghostT / 3) * 100 : null;

  // Ghosted checkpoint DOT with hysteresis
  let ghostDotIndex = null;
  if (ghostT != null) {
    const nearestDot = Math.round(ghostT);
    const dDot = Math.abs(ghostT - nearestDot);
    if (!dotGhostSuppressedRef.current && dDot < DOT_HIDE_T) {
      dotGhostSuppressedRef.current = true;    // suppress when very close to an integer
    } else if (dotGhostSuppressedRef.current && dDot > DOT_SHOW_T) {
      dotGhostSuppressedRef.current = false;   // re-enable after moving away
    }
    if (!dotGhostSuppressedRef.current) {
      ghostDotIndex = nearestDot;
    }
  } else {
    dotGhostSuppressedRef.current = false;
  }

  // Render
  return (
    <div className="cp-scale">
      <div
        className="cp-rail"
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: 'none', position: 'relative' }}
      >
        {/* Ghost line from real thumb to preview */}
        {showGhostThumb && Math.abs(ghostPct - pct) > 0.2 && (
          <div
            className="cp-ghost-line"
            style={{
              position: 'absolute',
              left: `${Math.min(pct, ghostPct)}%`,
              width: `${Math.abs(ghostPct - pct)}%`,
              top: '50%',
              height: 2,
              transform: 'translateY(-50%)',
              opacity: 0.25,
              background: 'currentColor',
              pointerEvents: 'none',
              zIndex: 1,
            }}
            aria-hidden
          />
        )}

        {[0, 1, 2, 3].map((i) => {
          const leftPct = (i / 3) * 100;
          const isActive = snappedIndex === i;
          // Only show ghost style on a dot if it's the ghost's nearest integer AND not the active dot
          const isGhost = !isActive && ghostDotIndex === i;

          return (
            <button
              key={i}
              className={`cp-dot ${isActive ? 'active' : ''} ${isGhost ? 'is-ghost' : ''}`}
              style={{
                left: `${leftPct}%`,
              }}
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

        {/* Ghost thumb (below real) */}
        {showGhostThumb && (
          <div
            className="cp-thumb-ghost"
            style={{
              position: 'absolute',
              left: `${ghostPct}%`,
              top: '-11px',
              marginLeft: -12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '4px solid rgba(187, 187, 187, 0.6)',
              background: 'rgba(57, 57, 57, 0.12)',
              boxShadow: '0 0 6px rgba(255, 255, 255, 0.83)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
