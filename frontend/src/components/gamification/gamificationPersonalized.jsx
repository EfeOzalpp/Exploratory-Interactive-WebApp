import React, { useEffect, useRef, useState, useMemo } from 'react';
import '../../styles/gamification.css';

// Same gradient sampling as the 3D graph (no skew)
import { useGradientColor, BRAND_STOPS } from '../../utils/hooks.ts';
import { usePersonalizedPools } from '../../utils/useGamificationPools.ts';

const FADE_MS = 200;
const PROX_THRESHOLD = 0.02;
const CLOSE_GRACE_MS = 1000;
const NEUTRAL = 'rgba(255,255,255,0.95)';

export default function GamificationPersonalized({
  userData,
  percentage,           // 0..100 for gauge
  color,
  mode = 'relative',
  onOpenChange,

  // tie-aware, shared source of truth
  belowCountStrict,
  equalCount,
  aboveCountStrict,
  positionClass,         // 'solo' | 'top' | 'bottom' | 'middle' | 'middle-above' | 'middle-below'
  tieContext,            // may be 'tiedTop' | 'tiedBottom' | 'tiedMiddle' | 'top'|'bottom'|'middle'|'none'

  // kept but unused now (per request to remove group/section phrasing)
  selectedSectionId,
}) {
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
  const knobSample = useGradientColor(safePct, { stops: BRAND_STOPS });
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

  // external “open me” hook from the toggle
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('gp:open-personalized', handler);
    return () => window.removeEventListener('gp:open-personalized', handler);
  }, []);

  // Proximity tracking so the toggle becomes discoverable
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

  // open/close grace (keeps the panel from snapping away immediately)
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
      '0-20':   { titles: ['Carbon Culprit', 'Planet Polluter', 'Sustainability Enemy'], secondary: ['Low effort—just ahead of a few'] },
      '21-40':  { titles: ['I Have a Backup Planet!', 'Nature? Is it Edible?'],           secondary: ['Slow start—keep going'] },
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

  // ---- Tie-aware bands (mirrors GamificationGeneral but with "you" voice) ----
  const b = Math.max(0, (belowCountStrict ?? 0) | 0);
  const e = Math.max(0, (equalCount ?? 0) | 0);
  const a = Math.max(0, (aboveCountStrict ?? 0) | 0);
  const totalOthers = b + e + a;

  const N = totalOthers + 1;
  const rankFromLow = b + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  const SMALL   = N < 8;
  const BOTTOM_Q = 0.15;
  const TOP_Q    = 0.85;
  const NEAR_M   = 0.05;

  const isSolo       = totalOthers === 0 || positionClass === 'solo';
  const isTopBand    = !isSolo && a === 0;
  const isBottomBand = !isSolo && b === 0;

  const isNearTop    = !isSolo && !isTopBand    && (SMALL ? a === 1 : q >= TOP_Q - NEAR_M);
  const isNearBottom = !isSolo && !isBottomBand && (SMALL ? b === 1 : q <= BOTTOM_Q + NEAR_M);

  const isMiddleBand = !isSolo && !isTopBand && !isBottomBand && !isNearTop && !isNearBottom;

  const canonicalTie =
    e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  // --- Personalized relative line (second-person, explicit ties and “near”)
  let relativeLine = null;
  if (mode === 'relative') {
    if (isSolo) {
      relativeLine = <>Hurray! You’re the first one here.</>;
    } else if (isTopBand) {
      if (canonicalTie === 'tiedTop') {
        if (e === 1)       relativeLine = <>You’re sharing the very top with <Strong>one other person</Strong>.</>;
        else if (e === 2)  relativeLine = <>You’re sharing the very top with <Strong>two others</Strong>.</>;
        else               relativeLine = <>You’re sharing the very top with <Strong>{e}</Strong> others.</>;
      } else {
        relativeLine = <>You’re on top, ahead of everyone else.</>;
      }
    } else if (isNearTop) {
      if (e > 0) {
        if (e === 1 && a === 1)
          relativeLine = <>You’re close to the top, tied with <Strong>one person</Strong> and behind only <Strong>one</Strong>.</>;
        else if (e === 1)
          relativeLine = <>You’re close to the top, tied with <Strong>one person</Strong> and behind <Strong>{a}</Strong> people.</>;
        else if (a === 1)
          relativeLine = <>You’re close to the top, tied with <Strong>{e}</Strong> others and behind only <Strong>one</Strong>.</>;
        else
          relativeLine = <>You’re close to the top, tied with <Strong>{e}</Strong> others and behind <Strong>{a}</Strong> people.</>;
      } else {
        relativeLine =
          a === 1
            ? <>Almost there, behind only <Strong>one person</Strong>.</>
            : <>You’re close to the top, behind <Strong>{a}</Strong> people.</>;
      }
    } else if (isBottomBand) {
      if (canonicalTie === 'tiedBottom') {
        if (e === 1)       relativeLine = <>You’re at the bottom, tied with <Strong>one other person</Strong>.</>;
        else if (e === 2)  relativeLine = <>You’re at the bottom, tied with <Strong>two others</Strong>.</>;
        else               relativeLine = <>You’re at the bottom, tied with <Strong>{e}</Strong> others.</>;
      } else {
        relativeLine = <>You’re at the bottom, everyone else is ahead.</>;
      }
    } else if (isNearBottom) {
      if (e > 0) {
        if (e === 1 && b === 1)
          relativeLine = <>You’re near the bottom, tied with <Strong>one person</Strong> and ahead of only <Strong>one</Strong>.</>;
        else if (e === 1)
          relativeLine = <>You’re near the bottom, tied with <Strong>one person</Strong> and ahead of <Strong>{b}</Strong> people.</>;
        else if (b === 1)
          relativeLine = <>You’re near the bottom, tied with <Strong>{e}</Strong> others and ahead of only <Strong>one</Strong>.</>;
        else
          relativeLine = <>You’re near the bottom, tied with <Strong>{e}</Strong> others and ahead of <Strong>{b}</Strong> people.</>;
      } else {
        relativeLine =
          b === 1
            ? <>You’re near the bottom, ahead of only <Strong>one person</Strong>.</>
            : <>You’re close to the bottom, ahead of <Strong>{b}</Strong> people.</>;
      }
    } else if (isMiddleBand) {
      if (canonicalTie === 'tiedMiddle') {
        if (e === 1)       relativeLine = <>You’re in the middle, tied with <Strong>one other person</Strong>.</>;
        else if (e === 2)  relativeLine = <>You’re in the middle, tied with <Strong>two others</Strong>.</>;
        else               relativeLine = <>You’re in the middle, tied with <Strong>{e}</Strong> others.</>;
      } else {
        if (a < b) {
          relativeLine =
            a === 1
              ? <>You’re in the middle, behind only <Strong>one person</Strong>.</>
              : <>You’re in the middle, behind <Strong>{a}</Strong> people.</>;
        } else if (b < a) {
          relativeLine =
            b === 1
              ? <>You’re in the middle, ahead of only <Strong>one person</Strong>.</>
              : <>You’re in the middle, ahead of <Strong>{b}</Strong> people.</>;
        } else {
          relativeLine = <>You’re in the middle, ahead of <Strong>{b}</Strong> and behind <Strong>{a}</Strong>.</>;
        }
      }
    }

    if (!relativeLine) {
      relativeLine = <>You’re somewhere in the group, keeping pace with everyone else.</>;
    }
  }

  const line =
    mode === 'relative'
      ? relativeLine
      : (
        <>
          Score:{' '}
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
            <h4 className="gam-title">
              {mode === 'relative'
                ? 'Compared to others, you are:'
                : 'Your score VS unrealistic standards:'}
            </h4>

            <h1 className="personal-title">{selectedTitle}</h1>
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
}
