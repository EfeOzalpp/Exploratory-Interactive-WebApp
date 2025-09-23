import React, { useEffect, useState, useMemo } from 'react';
import '../../styles/gamification.css';

// Same gradient pipeline/stops as the 3D graph (no skew)
import { useGradientColor, BRAND_STOPS } from '../../utils/hooks.ts';
import { useGeneralPools } from '../../utils/useGamificationPools.ts';

const NEUTRAL = 'rgba(255,255,255,0.95)';

export default function GamificationGeneral({
  dotId,
  percentage,           // 0..100 (display only)
  color,
  mode = 'relative',

  // tie-aware, shared source of truth
  belowCountStrict,      // # with strictly lower score (excl self)
  equalCount,            // # with exactly same score (excl self)
  aboveCountStrict,      // # with strictly higher score (excl self)
  positionClass,         // 'solo' | 'top' | 'bottom' | 'middle' | 'middle-above' | 'middle-below'
  tieContext,            // may be 'tiedTop' | 'tiedBottom' | 'tiedMiddle' | 'top'|'bottom'|'middle'|'none'
}) {
  const [currentText, setCurrentText] = useState({ title: '', description: '' });

  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const knobSample = useGradientColor(safePct, { stops: BRAND_STOPS });
  const { pick, loaded } = useGeneralPools();
  const knobColor = mode === 'absolute' ? knobSample.css : NEUTRAL;

  // Small helper to render emphasized numbers with a glow that matches the dot color.
  const Strong = useMemo(
    () =>
      function Strong({ children }) {
        return <strong style={{ textShadow: `0 0 12px ${color}` }}>{children}</strong>;
      },
    [color]
  );

  // b = belowCountStrict, e = equalCount, a = aboveCountStrict
  const b = Math.max(0, (belowCountStrict ?? 0) | 0);
  const e = Math.max(0, (equalCount ?? 0) | 0);
  const a = Math.max(0, (aboveCountStrict ?? 0) | 0);
  const totalOthers = b + e + a;

  // rank + percentile (include self)
  const N = totalOthers + 1;              // population including this point
  const rankFromLow = b + 1;              // 1 = absolute lowest
  const q = N > 0 ? rankFromLow / N : 0;  // 0..1 percentile from low

  // thresholds
  const SMALL   = N < 8;   // small group heuristic
  const BOTTOM_Q = 0.15;   // bottom 15%
  const TOP_Q    = 0.85;   // top 15%
  const NEAR_M   = 0.05;   // ±5% near buffer around edges

  // STRICT bands (only true top/bottom if nobody above/below)
  const isSolo       = totalOthers === 0 || positionClass === 'solo';
  const isTopBand    = !isSolo && a === 0; // nobody above
  const isBottomBand = !isSolo && b === 0; // nobody below

  // “Near” bands (use quantiles or one-away for tiny groups)
  const isNearTop    = !isSolo && !isTopBand    && (SMALL ? a === 1 : q >= TOP_Q - NEAR_M);
  const isNearBottom = !isSolo && !isBottomBand && (SMALL ? b === 1 : q <= BOTTOM_Q + NEAR_M);

  // Middle = not top/bottom/near
  const isMiddleBand = !isSolo && !isTopBand && !isBottomBand && !isNearTop && !isNearBottom;

  // canonical tie label derived from counts (independent of incoming tieContext)
  const canonicalTie =
    e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  useEffect(() => {
    if (!loaded) return;

    const fallbackBuckets = {
      '0-20':   { titles: ['Climate Clueless', 'Eco-Absentee'], secondary: ['Low effort—just ahead of a few'] },
      '21-40':  { titles: ['Footprint Fumbler', 'Eco Dabbler'], secondary: ['Slow start—keep going'] },
      '41-60':  { titles: ['Balanced as in Average'],           secondary: ['Right in the pack'] },
      '61-80':  { titles: ['Planet Ally', 'Nature Carer'],      secondary: ['Solid progress'] },
      '81-100': { titles: ['Planet Guardian', "Earth's Best Friend"], secondary: ['Top of the class'] },
    };

    if (!dotId || percentage === undefined) return;
    const chosen = pick(safePct, 'gd', String(dotId), fallbackBuckets);

    setCurrentText(
      chosen
        ? { title: chosen.title, description: chosen.secondary || '' }
        : { title: 'Eco Participant', description: '' }
    );
  }, [dotId, percentage, safePct, pick, loaded]);

  if (!dotId || percentage === undefined || color === undefined) return null;

  // --- Build relative line (explicit tie & “near” handling) ---
  let relativeLine = null;

  if (mode === 'relative') {
    if (isSolo) {
      relativeLine = <>The first person from this section to arrive!</>;
    } else if (isTopBand) {
      if (canonicalTie === 'tiedTop') {
        if (e === 1)       relativeLine = <>Sharing the top, tied with <Strong>one other person</Strong>.</>;
        else if (e === 2)  relativeLine = <>Sharing the top, tied with <Strong>two others</Strong>.</>;
        else               relativeLine = <>Sharing the top, tied with <Strong>{e}</Strong> others.</>;
      } else {
        relativeLine = <>At the very top, ahead of everyone else.</>;
      }
    } else if (isNearTop) {
      // NEAR TOP — tie-aware
      if (e > 0) {
        if (e === 1 && a === 1)
          relativeLine = <>Close to the top, tied with <Strong>one person</Strong> and behind only <Strong>one person</Strong>.</>;
        else if (e === 1)
          relativeLine = <>Close to the top, tied with <Strong>one person</Strong> and behind only <Strong>{a}</Strong> people.</>;
        else if (a === 1)
          relativeLine = <>Close to the top, tied with <Strong>{e}</Strong> others and behind only <Strong>one person</Strong>.</>;
        else
          relativeLine = <>Close to the top, tied with <Strong>{e}</Strong> others and behind only <Strong>{a}</Strong> people.</>;
      } else {
        relativeLine =
          a === 1
            ? <>Almost at the top, behind only <Strong>one person</Strong>.</>
            : <>Close to the top, behind only <Strong>{a}</Strong> people.</>;
      }
    } else if (isBottomBand) {
      if (canonicalTie === 'tiedBottom') {
        if (e === 1)       relativeLine = <>At the bottom, tied with <Strong>one other person</Strong>.</>;
        else if (e === 2)  relativeLine = <>At the bottom, tied with <Strong>two others</Strong>.</>;
        else               relativeLine = <>At the bottom, tied with <Strong>{e}</Strong> others.</>;
      } else {
        relativeLine = <>At the bottom, everyone else is ahead.</>;
      }
    } else if (isNearBottom) {
      // NEAR BOTTOM — tie-aware
      if (e > 0) {
        if (e === 1 && b === 1)
          relativeLine = <>Near the bottom, tied with <Strong>one person</Strong> and ahead of only <Strong>one person</Strong>.</>;
        else if (e === 1)
          relativeLine = <>Near the bottom, tied with <Strong>one person</Strong> and ahead of only <Strong>{b}</Strong> people.</>;
        else if (b === 1)
          relativeLine = <>Near the bottom, tied with <Strong>{e}</Strong> others and ahead of only <Strong>one person</Strong>.</>;
        else
          relativeLine = <>Near the bottom, tied with <Strong>{e}</Strong> others and ahead of only <Strong>{b}</Strong> people.</>;
      } else {
        relativeLine =
          b === 1
            ? <>Near the bottom, ahead of only <Strong>one person</Strong>.</>
            : <>Close to the bottom, ahead of only <Strong>{b}</Strong> people.</>;
      }
    } else if (isMiddleBand) {
      if (canonicalTie === 'tiedMiddle') {
        if (e === 1)       relativeLine = <>In the middle, tied with <Strong>one other person</Strong>.</>;
        else if (e === 2)  relativeLine = <>In the middle, tied with <Strong>two others</Strong>.</>;
        else               relativeLine = <>In the middle, tied with <Strong>{e}</Strong> others.</>;
      } else {
        if (a < b) {
          relativeLine =
            a === 1
              ? <>In the middle, behind only <Strong>one person</Strong>.</>
              : <>In the middle, behind only <Strong>{a}</Strong> people.</>;
        } else if (b < a) {
          relativeLine =
            b === 1
              ? <>In the middle, ahead of only <Strong>one person</Strong>.</>
              : <>In the middle, ahead of only <Strong>{b}</Strong> people.</>;
        } else {
          relativeLine = <>In the middle, ahead of <Strong>{b}</Strong> and behind <Strong>{a}</Strong>.</>;
        }
      }
    }

    // Safety fallback so we never render empty
    if (!relativeLine) {
      relativeLine = <>Somewhere in the pack.</>;
    }
  }

  const line =
    mode === 'relative' ? (
      relativeLine
    ) : (
      <>
        Score{' '}
        <strong style={{ textShadow: `0 0 12px ${color}, 0 0 22px ${knobColor}` }}>
          {safePct}
        </strong>
        /100
      </>
    );

  const { title, description } = currentText;

  return (
    <div className="generalized-result">
      <h4 className="gam-general-title">This person is:</h4>
      <div className="gam-general">
        <div className="gam-general-description">
          <div className="gam-description-title">
            <h2>{title}</h2>
          </div>

          {/* Hide secondary text in relative mode (to reduce verbosity) */}
          {mode === 'absolute' && description ? (
            <p className="gam-subline">{description}</p>
          ) : null}

          <div className="gam-description-text"><p>{line}</p></div>
        </div>

        {mode === 'absolute' && (
          <div className="gam-visualization">
            <div className="gam-percentage-knob">
              <div
                className="gam-knob-arrow"
                style={{ bottom: `${safePct}%`, borderBottom: `15px solid ${knobColor}` }}
              />
            </div>
            <div className="gam-percentage-bar" />
          </div>
        )}
      </div>
    </div>
  );
}
