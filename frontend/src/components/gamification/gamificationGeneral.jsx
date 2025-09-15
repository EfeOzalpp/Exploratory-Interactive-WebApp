import React, { useEffect, useState, useRef } from 'react';
import '../../styles/gamification.css';

const STORAGE_BUCKET = 'gamificationDotCache_v1'; // session-scoped cache (versioned)

const GamificationGeneral = ({ dotId, percentage, color }) => {
  // In-memory cache mirror of sessionStorage (keyed by `${dotId}:${bucket}`)
  const textCache = useRef({});
  const [currentText, setCurrentText] = useState({ title: '', description: '' });

  // Load cache from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_BUCKET);
      if (stored) textCache.current = JSON.parse(stored) || {};
    } catch {
      // ignore storage errors
      textCache.current = {};
    }
  }, []);

  useEffect(() => {
    if (!dotId || percentage === undefined) return;

    // derive a stable bucket so copy is consistent within ranges
    const pct = Number(percentage) || 0;
    const bucket =
      pct <= 20 ? '0-20' :
      pct <= 40 ? '21-40' :
      pct <= 60 ? '41-60' :
      pct <= 80 ? '61-80' : '81-100';

    const slotKey = `${dotId}:${bucket}`;

    // If we already chose text for this dot+bucket this session, reuse it
    const cached = textCache.current[slotKey];
    if (cached) {
      setCurrentText(cached);
      return;
    }

    // Random text pools
    const secondaryTexts = {
      '0-20': [
        'Low effort—just ahead of',
        'Villain in disguise - higher than',
        'Global warming’s best friend. Beating only',
        'Negative impact—better than only',
      ],
      '21-40': [
        'Slow start—higher than',
        'Not bad, not great—better than',
        'Getting there—beating only',
        'Mediocre progress—higher than',
      ],
      '41-60': [
        'Solidly average—better than',
        'Stuck in the middle—higher than',
        'Right in the pack—beating',
        'Decent effort—better than',
      ],
      '61-80': [
        'Great work—better than',
        'Solid progress—higher than',
        'Making a real difference—beating',
        'On the rise—better than',
      ],
      '81-100': [
        'Outstanding—better than',
        'Top of the class—higher than',
        'Setting the standard—beating',
        'Eco hero status—better than',
      ],
    };

    const titles = {
      '0-20': [
        'Climate Clueless', 'Eco-Absentee', 'Melting-Ice Enthusiast',
        'Carbon Profiter', 'Asphalt Enjoyer', 'Unworthy Commuter', 'UV Enjoyer',
      ],
      '21-40': [
        'Footprint Fumbler', 'Living Gas Source', 'Earth Kind of Sucks',
        'Yellow Velvet Cake', 'Heat Struck', 'Eco Dabbler',
      ],
      '41-60': [
        'Uncertain Datapoint', 'Balanced as in Average', 'Null Responder',
        'Realistic Answerer', 'Booring', 'Must Be Fun', 'Warming Up to the Idea',
      ],
      '61-80': [
        'Planet Ally', 'Animal Protector', 'Nature Carer',
        'Ecological Warrior', 'Sustainable Folk', 'Caring is Fulfilling',
        'Rather Contributes than Consumes',
      ],
      '81-100': [
        'Planet Guardian', 'Sustainability Superhero', "Earth's Best Friend",
        'Green MVP', 'Utopian Hardworker', 'Sweet Greens are Made of This',
      ],
    };

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const assignedText = {
      title: pick(titles[bucket]),
      description: pick(secondaryTexts[bucket]),
    };

    // Persist to sessionStorage and state
    textCache.current[slotKey] = assignedText;
    try {
      sessionStorage.setItem(STORAGE_BUCKET, JSON.stringify(textCache.current));
    } catch {
      // storage might be unavailable; ignore
    }
    setCurrentText(assignedText);
  }, [dotId, percentage]);

  if (!dotId || percentage === undefined || color === undefined) return null;

  // --- color helpers (unchanged) ---
  const cubicBezier = (t, p0, p1, p2, p3) => {
    const c = (1 - t), c2 = c * c, c3 = c2 * c;
    const t2 = t * t, t3 = t2 * t;
    return (c3 * p0) + (3 * c2 * t * p1) + (3 * c * t2 * p2) + (t3 * p3);
  };

  const skewPercentage = (p) => cubicBezier(p / 100, 0, 0.6, 0.85, 1) * 100;

  const interpolateColor = (t, c1, c2) => ({
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  });

  const getSkewedColor = (p) => {
    const skewedT = skewPercentage(p) / 100;
    const stops = [
      { stop: 0.0,  color: { r: 249, g: 14,  b: 33 } },
      { stop: 0.46, color: { r: 252, g: 159, b: 29 } },
      { stop: 0.64, color: { r: 245, g: 252, b: 95 } },
      { stop: 0.8,  color: { r: 0,   g: 253, b: 156 } },
      { stop: 1.0,  color: { r: 1,   g: 238, b: 0 } },
    ];

    let lower = stops[0], upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (skewedT >= stops[i].stop && skewedT <= stops[i + 1].stop) {
        lower = stops[i]; upper = stops[i + 1]; break;
      }
    }

    const range = upper.stop - lower.stop;
    const t = range === 0 ? 0 : (skewedT - lower.stop) / range;
    const c = interpolateColor(t, lower.color, upper.color);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  };

  const skewedColor = getSkewedColor(percentage);
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
              <strong
                style={{
                  textShadow: `0px 0px 12px ${color}, 0px 0px 22px ${skewedColor}`,
                }}
              >
                {percentage}%
              </strong>{' '}
              of other people.
            </p>
          </div>
        </div>

        <div className="gam-visualization">
          <div className="gam-percentage-knob">
            <div
              className="gam-knob-arrow"
              style={{
                bottom: `${percentage}%`,
                borderBottom: `15px solid ${skewedColor}`,
              }}
            />
          </div>
          <div className="gam-percentage-bar" />
        </div>
      </div>
    </div>
  );
};

export default GamificationGeneral;