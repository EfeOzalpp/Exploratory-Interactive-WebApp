// src/components/gamification/GamificationGeneral.jsx
import React, { useEffect, useState } from 'react';
import '../../styles/gamification.css';

import { useSkewedPercentColor } from '../../utils/hooks.ts';
import { useGeneralPools } from '../../utils/useGamificationPools.ts';

const NEUTRAL = 'rgba(255,255,255,0.95)';

const GamificationGeneral = ({
  dotId,
  percentage,   // percentile 0..100 (for gauge position / absolute score)
  count,         // how many people below
  poolSize,      // pool size (not excluding hovered)
  color,
  mode = 'relative',
}) => {
  const [currentText, setCurrentText] = useState({ title: '', description: '' });

  // Call hooks UNCONDITIONALLY
  const safePct = Number(percentage) || 0;
  const safeCount = Number.isFinite(count) ? count : 0;
  const safePool = Number.isFinite(poolSize) ? poolSize : 0;

  const skewed = useSkewedPercentColor(safePct);
  const { pick, loaded } = useGeneralPools();

  // Gauge color only matters in absolute mode
  const knobColor = mode === 'absolute' ? skewed.css : NEUTRAL;

  useEffect(() => {
    if (!loaded) return;
    // Fallback buckets in case CMS is empty
    const fallbackBuckets = {
      '0-20': {
        titles: ['Climate Clueless', 'Eco-Absentee', 'Melting-Ice Enthusiast'],
        secondary: ['Low effort—just ahead of a few'],
      },
      '21-40': {
        titles: ['Footprint Fumbler', 'Heat Struck', 'Eco Dabbler'],
        secondary: ['Slow start—keep going'],
      },
      '41-60': {
        titles: ['Uncertain Datapoint', 'Balanced as in Average', 'Null Responder'],
        secondary: ['Right in the pack'],
      },
      '61-80': {
        titles: ['Planet Ally', 'Animal Protector', 'Nature Carer'],
        secondary: ['Solid progress'],
      },
      '81-100': {
        titles: ['Planet Guardian', 'Sustainability Superhero', "Earth's Best Friend"],
        secondary: ['Top of the class'],
      },
    };

    if (!dotId || percentage === undefined) return;
    const chosen = pick(safePct, 'gd', String(dotId), fallbackBuckets);
    if (chosen) {
      setCurrentText({ title: chosen.title, description: chosen.secondary || '' });
    } else {
      setCurrentText({ title: 'Eco Participant', description: '' });
    }
  }, [dotId, percentage, safePct, pick, loaded]);

  // If inputs are missing, render nothing (hooks already ran above)
  if (!dotId || percentage === undefined || color === undefined) return null;

  // Copy varies by mode: counts in relative, score in absolute
  const line =
    mode === 'relative' ? (
      <>
        Ahead of{' '}
        <strong style={{ textShadow: `0 0 12px ${color}` }}>{safeCount}</strong>{' '}
        {safePool > 0 ? <>people (out of {safePool}).</> : <>people.</>}
      </>
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

          {/* Secondary line from CMS (like Personalized) */}
          {description ? <p className="gam-subline">{description}</p> : null}

          <div className="gam-description-text">
            <p>{line}</p>
          </div>
        </div>

        {/* Show gauge/bar ONLY in absolute mode */}
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
