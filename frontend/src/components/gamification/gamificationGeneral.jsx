import React, { useEffect, useState, useMemo } from 'react';
import '../../styles/gamification.css';

import {
  useGradientColor,
  DEFAULT_COLOR_OPTS, // <-- use the shared mapping
} from '../../utils/hooks.ts';
import { useGeneralPools } from '../../utils/useGamificationPools.ts';

const NEUTRAL = 'rgba(255,255,255,0.95)';

export default function GamificationGeneral({
  dotId,
  percentage,
  color,
  mode = 'relative',
  belowCountStrict,
  equalCount,
  aboveCountStrict,
  positionClass,
  tieContext,
}) {
  const [currentText, setCurrentText] = useState({ title: '', description: '' });
  
  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));

  // small visual bias so the knob matches the lighter bar mid
  const knobPct = Math.min(100, safePct + 5);

  const knobSample = useGradientColor(knobPct, DEFAULT_COLOR_OPTS);
  const knobColor  = mode === 'absolute' ? knobSample.css : NEUTRAL;
    
  const { pick, loaded } = useGeneralPools();

  const Strong = useMemo(
    () =>
      function Strong({ children }) {
        return <strong style={{ textShadow: `0 0 12px ${color}` }}>{children}</strong>;
      },
    [color]
  );

  // counts
  const b = Math.max(0, (belowCountStrict ?? 0) | 0);
  const e = Math.max(0, (equalCount ?? 0) | 0);
  const a = Math.max(0, (aboveCountStrict ?? 0) | 0);
  const totalOthers = b + e + a;

  // rank + percentile
  const N = totalOthers + 1;
  const rankFromLow = b + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  // heuristics
  const SMALL = N < 8;
  const BOTTOM_Q = 0.15;
  const TOP_Q = 0.85;
  const NEAR_M = 0.05;

  // bands
  const isSolo = totalOthers === 0 || positionClass === 'solo';
  const isTopBand = !isSolo && a === 0;
  const isBottomBand = !isSolo && b === 0;
  const isNearTop = !isSolo && !isTopBand && (SMALL ? a === 1 : q >= TOP_Q - NEAR_M);
  const isNearBottom = !isSolo && !isBottomBand && (SMALL ? b === 1 : q <= BOTTOM_Q + NEAR_M);
  const isMiddleBand =
    !isSolo && !isTopBand && !isBottomBand && !isNearTop && !isNearBottom;

  // canonical tie state (derived)
  const canonicalTie =
    e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  useEffect(() => {
    if (!loaded) return;

    const fallbackBuckets = {
      '0-20': {
        titles: ['Climate Clueless', 'Eco-Absentee'],
        secondary: ['Low effort, just ahead of a few'],
      },
      '21-40': {
        titles: ['Footprint Fumbler', 'Eco Dabbler'],
        secondary: ['Slow start, keep going'],
      },
      '41-60': {
        titles: ['Balanced as in Average'],
        secondary: ['Right in the pack'],
      },
      '61-80': {
        titles: ['Planet Ally', 'Nature Carer'],
        secondary: ['Solid progress'],
      },
      '81-100': {
        titles: ['Planet Guardian', "Earth's Best Friend"],
        secondary: ['Top of the class'],
      },
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

  // --- RELATIVE MODE (compact text with emoji arrows; include tie & counts) ---
  let relativeLine = null;

  if (mode === 'relative') {
    if (isSolo) {
      relativeLine = <>First one here! 🎉</>;
    } else if (isTopBand) {
      if (canonicalTie === 'tiedTop') {
        relativeLine = (
          <>
            Top spot ⬆️<br />
            Tied with <Strong>{e}</Strong>
          </>
        );
      } else {
        relativeLine = <>Top of the group ⬆️</>;
      }
    } else if (isNearTop) {
      if (e > 0) {
        relativeLine = (
          <>
            Near top ⬆️<br />
            Tied with <Strong>{e}</Strong>, behind <Strong>{a}</Strong>
          </>
        );
      } else {
        relativeLine = (
          <>
            Near top ⬆️<br />
            Behind <Strong>{a}</Strong>
          </>
        );
      }
    } else if (isBottomBand) {
      if (canonicalTie === 'tiedBottom') {
        relativeLine = (
          <>
            Bottom ⬇️<br />
            Tied with <Strong>{e}</Strong>
          </>
        );
      } else {
        relativeLine = <>Bottom ⬇️</>;
      }
    } else if (isNearBottom) {
      if (e > 0) {
        relativeLine = (
          <>
            Near bottom ⬇️<br />
            Tied with <Strong>{e}</Strong>, ahead of <Strong>{b}</Strong>
          </>
        );
      } else {
        relativeLine = (
          <>
            Near bottom ⬇️<br />
            Ahead of <Strong>{b}</Strong>
          </>
        );
      }
    } else if (isMiddleBand) {
      if (canonicalTie === 'tiedMiddle') {
        relativeLine = (
          <>
            Middle =<br />
            Tied with <Strong>{e}</Strong>, ahead of <Strong>{b}</Strong>, behind <Strong>{a}</Strong>
          </>
        );
      } else if (a < b) {
        relativeLine = (
          <>
            Middle =<br />
            Behind <Strong>{a}</Strong>
          </>
        );
      } else if (b < a) {
        relativeLine = (
          <>
            Middle =<br />
            Ahead of <Strong>{b}</Strong>
          </>
        );
      } else {
        relativeLine = (
          <>
            Middle =<br />
            Ahead of <Strong>{b}</Strong>, behind <Strong>{a}</Strong>
          </>
        );
      }
    }

    if (!relativeLine) {
      relativeLine = <>In the mix =</>;
    }
  }

  const line =
    mode === 'relative' ? (
      <>
        {relativeLine} <span style={{ opacity: 0.6 }}>🙂</span>
      </>
    ) : (
      <>
        {' '}
        <strong style={{ textShadow: `0 0 12px ${color}, 0 0 22px ${knobSample.css}` }}>
          {Math.round(safePct)}
        </strong>
        /100
      </>
    );

  const { description } = currentText;

  return (
    <div className="generalized-result">
      <div className="gam-general">
        <div className="gam-general-description">
          {/* no title in either mode */}
          {mode === 'absolute' && description ? (
            <h4 className="gam-subline">{description}</h4>
          ) : null}
          <p>{line}</p>
        </div>

        {mode === 'absolute' && (
          <div className="gam-visualization">
            <div className="gam-percentage-knob">
              <div
                className="gam-knob-arrow"
                style={{
                  bottom: `${safePct}%`,
                  borderBottom: `18px solid ${knobColor}`,
                }}
              />
            </div>
            <div className="gam-percentage-bar" />
          </div>
        )}
      </div>
    </div>
  );
}
