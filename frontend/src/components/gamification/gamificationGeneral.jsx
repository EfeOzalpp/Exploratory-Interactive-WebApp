// src/components/gamification/GamificationGeneral.jsx
import React, { useEffect, useState } from 'react';
import '../../styles/gamification.css';

// Use the same gradient pipeline/stops as the 3D graph (no skew)
import { useGradientColor, BRAND_STOPS } from '../../utils/hooks.ts';
import { useGeneralPools } from '../../utils/useGamificationPools.ts';

const NEUTRAL = 'rgba(255,255,255,0.95)';

const GamificationGeneral = ({
  dotId,
  percentage,           // 0..100 (display only)
  color,
  mode = 'relative',

  // tie-aware, shared source of truth
  belowCountStrict,      // # with strictly lower score (excl self)
  equalCount,            // # with exactly same score (excl self)
  aboveCountStrict,      // # with strictly higher score (excl self)
  positionClass,         // 'solo' | 'top' | 'bottom' | 'middle'
  tieContext,            // 'tiedTop' | 'tiedBottom' | 'tiedMiddle' | 'notTied'
}) => {
  const [currentText, setCurrentText] = useState({ title: '', description: '' });

  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));

  // 🎯 Exact same palette as the dots; no skew so colors line up visually
  const knobSample = useGradientColor(safePct, { stops: BRAND_STOPS });
  const { pick, loaded } = useGeneralPools();
  const knobColor = mode === 'absolute' ? knobSample.css : NEUTRAL;

  useEffect(() => {
    if (!loaded) return;
    const fallbackBuckets = {
      '0-20':   { titles: ['Climate Clueless', 'Eco-Absentee'], secondary: ['Low effort—just ahead of a few'] },
      '21-40':  { titles: ['Footprint Fumbler', 'Eco Dabbler'], secondary: ['Slow start—keep going'] },
      '41-60':  { titles: ['Balanced as in Average'],           secondary: ['Right in the pack'] },
      '61-80':  { titles: ['Planet Ally', 'Nature Carer'],      secondary: ['Solid progress'] },
      '81-100': { titles: ['Planet Guardian', 'Earth\'s Best Friend'], secondary: ['Top of the class'] },
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

  const strongNum = (n) => <strong style={{ textShadow: `0 0 12px ${color}` }}>{n}</strong>;

  // --- Build tie-aware relative line using shared stats ---
  let relativeLine;
  if (
    mode === 'relative' &&
    Number.isFinite(belowCountStrict) &&
    Number.isFinite(equalCount) &&
    Number.isFinite(aboveCountStrict) &&
    positionClass &&
    tieContext
  ) {
    const b = Math.max(0, belowCountStrict | 0);
    const e = Math.max(0, equalCount | 0);
    const a = Math.max(0, aboveCountStrict | 0);
    const totalOthers = b + e + a;

    if (totalOthers === 0 || positionClass === 'solo') {
      relativeLine = <>Hello! Only data point here — hope others join soon.</>;
    } else if (positionClass === 'top') {
      relativeLine =
        tieContext === 'tiedTop'
          ? <>Sharing the top — tied with {strongNum(e)}.</>
          : <>On top — ahead of everyone else.</>;
    } else if (positionClass === 'bottom') {
      relativeLine =
        tieContext === 'tiedBottom'
          ? <>Sharing the bottom — tied with {strongNum(e)}.</>
          : <>At the bottom — everyone else is ahead.</>;
    } else {
      // middle
      if (tieContext === 'tiedMiddle') {
        if (e === 1)       relativeLine = <>Twins — tied with {strongNum(1)}.</>;
        else if (e === 2)  relativeLine = <>Triplets — tied with {strongNum(2)}.</>;
        else               relativeLine = <>Tied with {strongNum(e)}.</>;
      } else {
        // no tie → position-aware
        if (a === 1)       relativeLine = <>Second place — ahead of {strongNum(b)}.</>;
        else if (a === 2)  relativeLine = <>Third place — ahead of {strongNum(b)}.</>;
        else               relativeLine = <>Ahead of {strongNum(b)}, behind {strongNum(a)}.</>;
      }
    }
  }

  // Absolute mode text stays the same
  const line = mode === 'relative'
    ? relativeLine
    : (
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
          {description ? <p className="gam-subline">{description}</p> : null}
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
};

export default GamificationGeneral;
