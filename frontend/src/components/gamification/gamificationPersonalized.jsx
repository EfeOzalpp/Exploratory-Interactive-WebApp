import React, { useEffect, useRef, useState, useMemo } from 'react';
import '../../styles/gamification.css';

import {
  useGradientColor,
  BRAND_STOPS,
  DEFAULT_COLOR_OPTS, // same mapping as General
} from '../../utils/hooks.ts';
import { usePersonalizedPools } from '../../utils/useGamificationPools.ts';

const FADE_MS = 200;
const PROX_THRESHOLD = 0.02;
const CLOSE_GRACE_MS = 1000;
const NEUTRAL = 'rgba(255,255,255,0.95)';

function classifyBand({ below: b, equal: e, above: a }) {
  const totalOthers = Math.max(0, b | 0) + Math.max(0, e | 0) + Math.max(0, a | 0);
  const N = totalOthers + 1;
  const rankFromLow = (b | 0) + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  const isSolo = totalOthers === 0;
  if (isSolo) return { band: 'solo', tie: 'none', N, b, e, a, q, rankFromLow };

  const isTopBand = a === 0;
  const isBottomBand = b === 0;

  const EDGE_COUNT = Math.max(2, Math.ceil(0.25 * N));
  const NEAR_Q = 0.30;

  const nearBottom = !isBottomBand && (rankFromLow <= EDGE_COUNT || q <= NEAR_Q);
  const nearTop    = !isTopBand    && ((N - rankFromLow + 1) <= EDGE_COUNT || q >= (1 - NEAR_Q));

  let band = 'middle';
  if (isTopBand) band = 'top';
  else if (isBottomBand) band = 'bottom';
  else if (nearTop) band = 'nearTop';
  else if (nearBottom) band = 'nearBottom';

  const canonicalTie =
    e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  return { band, tie: canonicalTie, N, b, e, a, q, rankFromLow };
}

export default function GamificationPersonalized({
  userData,
  percentage,
  color,
  mode = 'relative',
  onOpenChange,

  belowCountStrict,
  equalCount,
  aboveCountStrict,
  positionClass,
  tieContext,

  selectedSectionId,
}) {
  // Title removed — keep CMS contract stable but do not render it
  const [selectedTitle, setSelectedTitle] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [open, setOpen] = useState(true);

  const [closingGrace, setClosingGrace] = useState(false);
  const closeTimerRef = useRef(null);

  const [nearButton, setNearButton] = useState(false);
  const btnRef = useRef(null);
  const rafRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0, has: false });

  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const knobPct = Math.min(100, safePct + 5); // same visual bias as General

  const knobSample = useGradientColor(knobPct, DEFAULT_COLOR_OPTS);
  const { pick } = usePersonalizedPools();
  const knobColor = mode === 'absolute' ? knobSample.css : NEUTRAL;

  const Strong = useMemo(
    () =>
      function Strong({ children }) {
        return <strong style={{ textShadow: `0 0 12px ${color}` }}>{children}</strong>;
      },
    [color]
  );

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('gp:open-personalized', handler);
    return () => window.removeEventListener('gp:open-personalized', handler);
  }, []);

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

  // CMS + fallback copy (secondary only for ABSOLUTE)
  useEffect(() => {
    if (percentage === undefined || !userData) return;

    const fallbackBuckets = {
      '0-20':   { titles: ['Carbon Culprit', 'Planet Polluter', 'Sustainability Enemy'], secondary: ['Low effort, just ahead of a few'] },
      '21-40':  { titles: ['I Have a Backup Planet!', 'Nature? Is it Edible?'],           secondary: ['Slow start, keep going'] },
      '41-60':  { titles: ['Middle Spot is Yours', 'Is it trendy to like nature?'],       secondary: ['Right in the pack'] },
      '61-80':  { titles: ['Humble-Green MF', 'Sustainability and Whatnot'],              secondary: ['Solid progress'] },
      '81-100': { titles: ["Nature's Humble Savior", 'Damn! Larger than life habits'],    secondary: ['Top of the class'] },
    };

    const chosen = pick(safePct, 'gp', String(userData._id || 'me'), fallbackBuckets);
    if (chosen) {
      setSelectedTitle(chosen.title);
      setSecondaryText(mode === 'absolute' ? (chosen.secondary || '') : '');
    } else {
      setSelectedTitle('Eco Participant');
      setSecondaryText('');
    }
  }, [percentage, userData, safePct, pick, mode]);

  if (!userData) return null;

  const panelId = `gp-panel-${userData?._id || 'me'}`;
  const wrapperVisible = open || closingGrace || nearButton;

  // bands (rank + ties)
  const b = Math.max(0, (belowCountStrict ?? 0) | 0);
  const e = Math.max(0, (equalCount ?? 0) | 0);
  const a = Math.max(0, (aboveCountStrict ?? 0) | 0);

  const bandInfo = classifyBand({ below: b, equal: e, above: a });

  // --- Personalized relative line (highlight only Top / Middle / Bottom words; numbers stay neutral) ---
  let relativeLine = null;
  if (mode === 'relative') {
    const { band, tie, b: bb, e: ee, a: aa } = bandInfo;

    if (band === 'solo') {
      relativeLine = <>You’re the first one here.</>;
    } else if (band === 'top') {
      relativeLine = tie === 'tiedTop'
        ? <>You’re sharing the very <Strong>Top</Strong> with {ee}.</>
        : <>You’re on <Strong>Top</Strong>, ahead of everyone else.</>;
    } else if (band === 'nearTop') {
      relativeLine = ee > 0
        ? <>You’re close to the <Strong>Top</Strong>, tied with {ee} and behind {aa}.</>
        : <>You’re close to the <Strong>Top</Strong>, behind {aa}.</>;
    } else if (band === 'bottom') {
      relativeLine = tie === 'tiedBottom'
        ? <>You’re at the <Strong>Bottom</Strong>, tied with {ee}.</>
        : <>You’re at the <Strong>Bottom</Strong>, everyone else is ahead.</>;
    } else if (band === 'nearBottom') {
      relativeLine = ee > 0
        ? <>You’re near the <Strong>Bottom</Strong>, tied with {ee} and ahead of {bb}.</>
        : <>You’re near the <Strong>Bottom</Strong>, ahead of {bb}.</>;
    } else {
      // middle
      if (tie === 'tiedMiddle') {
        relativeLine = <>You’re in the <Strong>Middle</Strong>, tied with {ee}.</>;
      } else if (aa < bb) {
        relativeLine = <>You’re in the <Strong>Middle</Strong>, behind {aa}.</>;
      } else if (bb < aa) {
        relativeLine = <>You’re in the <Strong>Middle</Strong>, ahead of {bb}.</>;
      } else {
        relativeLine = <>You’re in the <Strong>Middle</Strong>, ahead of {bb} and behind {aa}.</>;
      }
    }

    if (!relativeLine) relativeLine = <>You’re in the mix.</>;
  }

  const line =
    mode === 'relative'
      ? (
        <>
          {relativeLine} <span style={{ opacity: 0.6 }}>🙂</span>
        </>
      )
      : (
        <>
          <strong style={{ textShadow: `0 0 12px ${color}, 0 0 22px ${knobColor}` }}>
            {safePct}
          </strong>
          /100
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
            <line x1="12" y1="5"  x2="12" y2="19" strokeWidth="2.5" />
            <line x1="5"  y1="12" x2="19" y2="12" strokeWidth="2.5" />
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
            {mode === 'absolute' && secondaryText ? (
              <h4 className="gam-subline">{secondaryText}</h4>
            ) : null}

            <h4 className="gam-title">
              {mode === 'relative' ? (
                'Yours'
              ) : (
                <>
                  {' '}
                  <strong
                    style={{
                      textShadow: `0 0 12px ${color}, 0 0 22px ${knobColor}`,
                    }}
                  >
                    {safePct}
                  </strong>
                  /100
                </>
              )}
            </h4>

            {mode === 'relative' && <p>{line}</p>}
          </div>

          {mode === 'absolute' && (
            <>
              <div className="gamification-knob">
                <div className="percentage-knob">
                  <div
                    className="knob-arrow"
                    style={{
                      bottom: `${safePct}%`,
                      borderBottom: `18px solid ${knobColor}`,
                    }}
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
}
