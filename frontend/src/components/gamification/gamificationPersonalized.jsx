import React, { useEffect, useRef, useState } from 'react';
import '../../styles/gamification.css';

import { useSkewedPercentColor } from '../../utils/hooks.ts';
import { usePersonalizedPools } from '../../utils/useGamificationPools.ts';

const FADE_MS = 200;
const PROX_THRESHOLD = 0.02;
const CLOSE_GRACE_MS = 1000;
const NEUTRAL = 'rgba(255,255,255,0.95)';

const GamificationPersonalized = ({
  userData,
  percentage,        // percentile 0..100 for gauge
  count,             // how many people below you (self-excluded)
  poolSize,          // pool size excluding self
  color,
  mode = 'relative',
  onOpenChange,
}) => {
  const [selectedTitle, setSelectedTitle] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [open, setOpen] = useState(true);

  const [closingGrace, setClosingGrace] = useState(false);
  const closeTimerRef = useRef(null);

  const [nearButton, setNearButton] = useState(false);
  const btnRef = useRef(null);
  const rafRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0, has: false });

  const safePct = Number(percentage) || 0;
  const safeCount = Number.isFinite(count) ? count : 0;
  const safePool = Number.isFinite(poolSize) ? poolSize : 0;

  const skewed = useSkewedPercentColor(safePct);
  const { pick } = usePersonalizedPools();

  const knobColor = mode === 'absolute' ? skewed.css : NEUTRAL;

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  // --- proximity tracking ---
  useEffect(() => {
    const scheduleCheck = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!btnRef.current) return;

        const rect = btnRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const { innerWidth: vw, innerHeight: vh } = window;
        const px = lastPointerRef.current.has ? lastPointerRef.current.x : -9999;
        const py = lastPointerRef.current.has ? lastPointerRef.current.y : -9999;

        const dx = (px - cx) / vw;
        const dy = (py - cy) / vh;
        const dist = Math.sqrt(dx * dx + dy * dy);

        setNearButton(dist < PROX_THRESHOLD);
      });
    };

    const onMouseMove = (e) => { lastPointerRef.current = { x: e.clientX, y: e.clientY, has: true }; scheduleCheck(); };
    const onTouchMove = (e) => {
      if (!e.touches?.length) return;
      const t = e.touches[0];
      lastPointerRef.current = { x: t.clientX, y: t.clientY, has: true };
      scheduleCheck();
    };
    const onResizeOrScroll = () => scheduleCheck();

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, { passive: true });

    scheduleCheck();
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // --- wrapper close-grace ---
  useEffect(() => {
    if (!open) {
      setClosingGrace(true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setClosingGrace(false);
        closeTimerRef.current = null;
      }, CLOSE_GRACE_MS);
    } else {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setClosingGrace(false);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  // --- CMS + fallback copy (secondary only for ABSOLUTE) ---
  useEffect(() => {
    if (percentage === undefined || !userData) return;

    const fallbackBuckets = {
      '0-20':   { titles: ['Carbon Culprit', 'Planet Polluter', 'Sustainability Enemy'], secondary: ['Low effort—just ahead of a few'] },
      '21-40':  { titles: ['I Have a Backup Planet!', 'Nature? Is it Edible?'], secondary: ['Slow start—keep going'] },
      '41-60':  { titles: ['Middle Spot is Yours', 'Is it trendy to like nature?'], secondary: ['Right in the pack'] },
      '61-80':  { titles: ['Humble-Green MF', 'Sustainability and Whatnot'], secondary: ['Solid progress'] },
      '81-100': { titles: ["Nature's Humble Savior", 'Damn! Larger than life habits'], secondary: ['Top of the class'] },
    };

    const chosen = pick(safePct, 'gp', String(userData._id || 'me'), fallbackBuckets);
    if (chosen) {
      setSelectedTitle(chosen.title);
      // Only keep secondary in ABSOLUTE mode; clear otherwise
      setSecondaryText(mode === 'absolute' ? (chosen.secondary || '') : '');
    } else {
      setSelectedTitle('Eco Participant');
      setSecondaryText('');
    }
  }, [percentage, userData, safePct, pick, mode]);

  if (!userData) return null;

  const panelId = `gp-panel-${userData?._id || 'me'}`;
  const wrapperVisible = open || closingGrace || nearButton;

  // --- relative line with resilience ---
  const relativeLine = (() => {
    if (safePool === 0) return <>Hurray! First from your group to join.</>;
    if (safePool === 1) return safeCount === 0 ? <>Below the other person.</> : <>Above the other person.</>;
    if (safePool >= 3 && safeCount === 0) return <>Rock bottom—everyone else is ahead.</>;
    return (
      <>
        Ahead of <strong style={{ textShadow: `0 0 12px ${color}` }}>{safeCount}</strong> people (out of {safePool})
      </>
    );
  })();

  const line = mode === 'relative'
    ? relativeLine
    : (
      <>
        Score: <strong style={{ textShadow: `0 0 12px ${color}, 0 0 22px ${knobColor}` }}>{safePct}</strong>/100
      </>
    );

  return (
    <div className={`gp-root ${wrapperVisible ? 'is-visible' : ''}`}>
      <button
        ref={btnRef}
        type="button"
        className="toggle-button gp-toggle"
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label="Toggle personalized panel"
        aria-pressed={open}
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        style={{ pointerEvents: 'auto' }}
      >
        <span className={`gp-toggle-icon ${open ? 'is-open' : 'is-closed'}`} aria-hidden>
          <svg className="icon-plus" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
            <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
            <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
          </svg>
          <svg className="icon-minus" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
            <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="personalized-result gp-container"
          style={{ pointerEvents: 'none', transition: `opacity ${FADE_MS}ms ease` }}
        >
          <div className="gamification-text">
            <h4 className="gam-title">
              {mode === 'relative' ? 'Compared to this pool, you are:' : 'Your score VS unrealistic standards:'}
            </h4>
            <h1 className="personal-title">{selectedTitle}</h1>

            {/* Only show CMS secondary in ABSOLUTE mode */}
            {mode === 'absolute' && secondaryText ? <p className="gam-subline">{secondaryText}</p> : null}

            <p>{line}</p>
          </div>

          {mode === 'absolute' && (
            <>
              <div className="gamification-knob">
                <div className="percentage-knob">
                  <div
                    className="knob-arrow"
                    style={{ bottom: `${safePct}%`, borderBottom: `18px solid ${knobColor}` }}
                  />
                </div>
              </div>

              <div className="gamification-bar">
                <div className="percentage-bar" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GamificationPersonalized;
