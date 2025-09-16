// src/components/gamification/GamificationGeneral.jsx
import React, { useEffect, useState } from 'react';
import '../../styles/gamification.css';

import { useSkewedPercentColor } from '../../utils/hooks.ts';
import { useGeneralPools } from '../../utils/useGamificationPools.ts';

const GamificationGeneral = ({ dotId, percentage, color }) => {
  const [currentText, setCurrentText] = useState({ title: '', description: '' });

  const safePct = Number(percentage) || 0;
  const { css: skewedColor } = useSkewedPercentColor(safePct);

  // now we also receive `loaded`
  const { pick, loaded } = useGeneralPools();

  useEffect(() => {
    if (!dotId || percentage === undefined) return;
    if (!loaded) return; // <-- wait for first fetch to finish

    const fallbackBuckets = {
      '0-20': {
        titles: ['Climate Clueless', 'Eco-Absentee', 'Melting-Ice Enthusiast'],
        secondary: [
          'Low effort—just ahead of',
          'Villain in disguise - higher than',
          'Negative impact—better than only',
        ],
      },
      '21-40': {
        titles: ['Footprint Fumbler', 'Heat Struck', 'Eco Dabbler'],
        secondary: [
          'Slow start—higher than',
          'Not bad, not great—better than',
          'Mediocre progress—higher than',
        ],
      },
      '41-60': {
        titles: ['Uncertain Datapoint', 'Balanced as in Average', 'Null Responder'],
        secondary: [
          'Solidly average—better than',
          'Stuck in the middle—higher than',
          'Right in the pack—beating',
        ],
      },
      '61-80': {
        titles: ['Planet Ally', 'Animal Protector', 'Nature Carer'],
        secondary: [
          'Great work—better than',
          'Solid progress—higher than',
          'Making a real difference—beating',
        ],
      },
      '81-100': {
        titles: ['Planet Guardian', 'Sustainability Superhero', "Earth's Best Friend"],
        secondary: [
          'Outstanding—better than',
          'Top of the class—higher than',
          'Eco hero status—better than',
        ],
      },
    };

    const chosen = pick(safePct, 'gd', String(dotId), fallbackBuckets);

    // debug: see where copy came from (CMS vs fallback); the hook caches your choice
    console.log('[GamificationGeneral] loaded=%s pct=%d chosen=%o', loaded, safePct, chosen);

    if (chosen) {
      setCurrentText({ title: chosen.title, description: chosen.secondary });
    } else {
      setCurrentText({ title: 'Eco Participant', description: 'Right in the pack—beating' });
    }
  }, [dotId, percentage, safePct, pick, loaded]);

  if (!dotId || percentage === undefined || color === undefined) return null;

  const { title, description } = currentText;

  return (
    <div className="generalized-result">
      <h4 className="gam-general-title">This person is:</h4>
      <div className="gam-general">
        <div className="gam-general-description">
          <div className="gam-description-title">
            <h2>{title}</h2>
          </div>
          <div className="gam-description-text">
            <p>
              {description}{' '}
              <strong style={{ textShadow: `0 0 12px ${color}, 0 0 22px ${skewedColor}` }}>
                {safePct}%
              </strong>{' '}
              of other people.
            </p>
          </div>
        </div>

        <div className="gam-visualization">
          <div className="gam-percentage-knob">
            <div
              className="gam-knob-arrow"
              style={{ bottom: `${safePct}%`, borderBottom: `15px solid ${skewedColor}` }}
            />
          </div>
          <div className="gam-percentage-bar" />
        </div>
      </div>
    </div>
  );
};

export default GamificationGeneral;
