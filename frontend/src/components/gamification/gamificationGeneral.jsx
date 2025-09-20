// src/components/gamification/GamificationGeneral.jsx
import React, { useEffect, useState } from 'react';
import '../../styles/gamification.css';

import { useSkewedPercentColor } from '../../utils/hooks.ts';
import { useGeneralPools } from '../../utils/useGamificationPools.ts';

const NEUTRAL = 'rgba(255,255,255,0.95)';

const GamificationGeneral = ({
  dotId,
  percentage,   // 0..100
  count,         // # below this person (excludes self)
  poolSize,      // total others in pool (excludes self)
  color,
  mode = 'relative',
}) => {
  const [currentText, setCurrentText] = useState({ title: '', description: '' });

  // Normalize/guard inputs
  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const safePool  = Math.max(0, Math.floor(Number.isFinite(poolSize) ? poolSize : 0));

  const skewed = useSkewedPercentColor(safePct);
  const { pick, loaded } = useGeneralPools();

  const knobColor = mode === 'absolute' ? skewed.css : NEUTRAL;

  useEffect(() => {
    if (!loaded) return;

    const fallbackBuckets = {
      '0-20':   { titles: ['Climate Clueless', 'Eco-Absentee', 'Melting-Ice Enthusiast'], secondary: ['Low effort—just ahead of a few'] },
      '21-40':  { titles: ['Footprint Fumbler', 'Heat Struck', 'Eco Dabbler'],           secondary: ['Slow start—keep going'] },
      '41-60':  { titles: ['Uncertain Datapoint', 'Balanced as in Average', 'Null Responder'], secondary: ['Right in the pack'] },
      '61-80':  { titles: ['Planet Ally', 'Animal Protector', 'Nature Carer'],            secondary: ['Solid progress'] },
      '81-100': { titles: ['Planet Guardian', 'Sustainability Superhero', "Earth's Best Friend"], secondary: ['Top of the class'] },
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

  // Relative edge-case wording (no hooks)
  let relativeLine;
  if (safePool === 0) {
    relativeLine = <>Hello! Only data point here — hope others join soon.</>;
  } else if (safePool === 1) {
    relativeLine = safeCount === 0 ? <>Below the other person.</> : <>Above the other person.</>;
  } else if (safePool >= 3 && safeCount === 0) {
    relativeLine = <>Rock bottom—everyone else is ahead.</>;
  } else if (safeCount === safePool) {
    relativeLine = <>At the top — ahead of everyone else.</>;
  } else if (safeCount === safePool - 1) {
    relativeLine = <>Second place — ahead of {safeCount}.</>;
  } else if (safeCount === safePool - 2) {
    relativeLine = <>Third best — ahead of {safeCount}.</>;
  } else {
    relativeLine = (
      <>
        Ahead of <strong style={{ textShadow: `0 0 12px ${color}` }}>{safeCount}</strong>{' '}
        people (out of {safePool}).
      </>
    );
  }

  const line =
    mode === 'relative' ? (
      relativeLine
    ) : (
      <>
        Score:{' '}
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

          <div className="gam-description-text">
            <p>{line}</p>
          </div>
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
