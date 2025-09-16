import React, { useEffect, useRef, useState } from 'react';
import '../../styles/gamification.css';

import { useSkewedPercentColor } from '../../utils/hooks.ts';
import { usePersonalizedPools } from '../../utils/useGamificationPools.ts';

const FADE_MS = 200;
const PROX_THRESHOLD = 0.02;

const GamificationPersonalized = ({ userData, percentage, color }) => {
  const [selectedTitle, setSelectedTitle] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [open, setOpen] = useState(true);
  const [nearButton, setNearButton] = useState(false);

  // hooks must be unconditional
  const safePct = Number(percentage) || 0;
  const { css: skewedColor } = useSkewedPercentColor(safePct);

  // CMS-powered picker
  const { pick } = usePersonalizedPools();

  // proximity-driven reveal
  const btnRef = useRef(null);
  const rafRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0, has: false });

  useEffect(() => {
    const onMouseMove = (e) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY, has: true };
      scheduleCheck();
    };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (percentage === undefined || !userData) return;

    // Fallback buckets only used if CMS has no matching doc or is empty
    const fallbackBuckets = {
      '0-20': {
        titles: ['Carbon Culprit', 'Planet Polluter', 'Sustainability Enemy'],
        secondary: ["Earth would've needed you, You're surpass only"],
      },
      '21-40': {
        titles: ['I Have a Backup Planet!', 'Nature? Is it Edible?'],
        secondary: ["Hands down, it's not a crime, you surpass only"],
      },
      '41-60': {
        titles: ['Middle Spot is Yours', 'Is it trendy to like nature?'],
        secondary: ["You're getting there! -Ahead of"],
      },
      '61-80': {
        titles: ['Humble-Green MF', 'Sustainability and Whatnot'],
        secondary: ["Spectacular and frenzy! You're higher"],
      },
      '81-100': {
        titles: ["Nature's Humble Savior", 'Damn! Larger than life habits'],
        secondary: ["You're ahead of almost everyone, higher than"],
      },
    };

    const chosen = pick(safePct, 'gp', String(userData._id || 'me'), fallbackBuckets);

    // debug: see where copy came from
    console.log(
      '[GamificationPersonalized] pct=%d, _id=%s → chosen=%o',
      safePct,
      userData?._id,
      chosen
    );

    if (chosen) {
      setSelectedTitle(chosen.title);
      setSecondaryText(chosen.secondary);
    } else {
      // absolute last-resort text
      setSelectedTitle('Eco Participant');
      setSecondaryText('Right in the pack—beating');
    }
  }, [percentage, userData, safePct, pick]);

  if (!userData) return null;

  const panelId = `gp-panel-${userData?._id || 'me'}`;
  const label = open ? 'Hide your result' : 'Show your result';
  const symbol = open ? '−' : '+';
  const visible = open || nearButton;

  return (
    <div
      className="gp-root"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <button
        ref={btnRef}
        type="button"
        className="toggle-button gp-toggle"
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        style={{ pointerEvents: 'auto' }}
      >
        <span className="gp-toggle-symbol">{symbol}</span>
      </button>

      {open && (
        <div id={panelId} className="personalized-result gp-container" style={{ pointerEvents: 'none' }}>
          <div className="gamification-text">
            <h4 className="gam-title">Compared to the pool you are:</h4>
            <h1 className="personal-title">{selectedTitle}</h1>
            <p>
              {secondaryText}{' '}
              <strong style={{ textShadow: `0 0 12px ${color}, 0 0 22px ${skewedColor}` }}>
                {safePct}%
              </strong>{' '}
              people!
            </p>
          </div>

          <div className="gamification-knob">
            <div className="percentage-knob">
              <div
                className="knob-arrow"
                style={{ bottom: `${safePct}%`, borderBottom: `18px solid ${skewedColor}` }}
              />
            </div>
          </div>

          <div className="gamification-bar">
            <div className="percentage-bar" />
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationPersonalized;
