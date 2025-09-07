import React, { useEffect, useState } from 'react';
import '../../styles/gamification.css';

const GamificationPersonalized = ({ userData, percentage, color }) => {
  const [selectedTitle, setSelectedTitle] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [open, setOpen] = useState(true); // visible by default

  useEffect(() => {
    if (percentage === undefined || !userData) return;

    const titles = {
      "0-20": [
        "Carbon Culprit","Planet Polluter","Sustainability Enemy",
        "I thrive in environmental hazard","I'm a burden for Earth",
        "Sustainability Sinner","Green isn't my favorite color",
      ],
      "21-40": [
        "I Have a Backup Planet!","Nature? Is it Edible?","Sustainability, Who?",
        "Comfort Seeker, Earth is Ok Too","I am Aware of My Bad-nature",
      ],
      "41-60": [
        "Middle Spot is Yours","Is it trendy to like nature?","Nature <3 (ok, where's my award?)",
        "The Least I Can Do Is Honesty","I Like Mediocrity..:) (not really)",
      ],
      "61-80": [
        "Humble-Green MF","Sustainability and Whatnot","Planet Partner in Crime",
        "A cool person for a cool planet","Enjoyable Results, Thanks",
      ],
      "81-100": [
        "Nature's Humble Savior","Damn! Larger than life habits","The Most Precious Award Goes to...",
        "A Reminder to Reward Yourself","Good Results, Keep It Up",
      ],
    };
    const secondaryPool = {
      "0-20": [
        "Earth would've needed you, You're surpass only",
        "Hug a tree. Effortlessly higher than only",
        "Planetary evacuation! You're ahead of only",
      ],
      "21-40": [
        "Hands down, it's not a crime, you surpass only",
        "Low-effort gives-key results, you're ahead of",
        "Humble beginnings, you're higher than",
      ],
      "41-60": [
        "You're getting there! -Ahead of",
        "I mean... You do you. You're ahead of",
        "Kind of in the middle, huh? You're higher than",
      ],
      "61-80": [
        "Spectacular and frenzy! You're higher",
        "Breathing, thriving, cooking. Ahead of",
        "Right on, left off, You're higher than",
      ],
      "81-100": [
        "You're ahead of almost everyone, higher than",
        "I'm Nature, appreciate ya' You're higher than",
        "WOW, that's rad. You're ahead of",
      ],
    };

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const pct = Number(percentage) || 0;
    const bucket =
      pct <= 20 ? "0-20" :
      pct <= 40 ? "21-40" :
      pct <= 60 ? "41-60" :
      pct <= 80 ? "61-80" : "81-100";

    setSelectedTitle(pick(titles[bucket]));
    setSecondaryText(pick(secondaryPool[bucket]));
  }, [percentage, userData]);

  if (!userData) return null;

  // --- color helpers (unchanged) ---
  const cubicBezier = (t, p0, p1, p2, p3) => {
    const c = (1 - t), c2 = c * c, c3 = c2 * c;
    const t2 = t * t, t3 = t2 * t;
    return (c3 * p0) + (3 * c2 * t * p1) + (3 * c * t2 * p2) + (t3 * p3);
  };
  const skewPercentage = (p) => cubicBezier(p/100, 0, 0.6, 0.85, 1) * 100;
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
    let lower = stops[0], upper = stops[stops.length-1];
    for (let i=0; i<stops.length-1; i++) {
      if (skewedT >= stops[i].stop && skewedT <= stops[i+1].stop) {
        lower = stops[i]; upper = stops[i+1]; break;
      }
    }
    const range = upper.stop - lower.stop;
    const t = range === 0 ? 0 : (skewedT - lower.stop) / range;
    const c = interpolateColor(t, lower.color, upper.color);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  };
  const skewedColor = getSkewedColor(percentage);

  // ids / labels
  const panelId = `gp-panel-${userData?._id || 'me'}`;
  const label = open ? 'Hide your result' : 'Show your result';
  const symbol = open ? '−' : '+';

  return (
    <div className="gp-root" /* wrapper so toggle stays when panel is gone */>
      {/* Toggle button: always rendered, independent of panel presence */}
    <button
      type="button"
      className="toggle-button gp-toggle"   // <- add "toggle-button"
      aria-controls={open ? panelId : undefined}
      aria-expanded={open}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      style={{ pointerEvents: 'auto' }}
    >
      <span className="gp-toggle-symbol">{symbol}</span>
    </button>

      {/* OUTER PANEL: only render when open → fully gone when closed */}
      {open && (
        <div
          id={panelId}
          className="personalized-result gp-container open"
          style={{ pointerEvents: 'none' }}  // panel never blocks graph
        >
          {/* First section: Text */}
          <div className="gamification-text">
            <h4 className="gam-title">Based on your habits, you're:</h4>
            <h1 className="personal-title">{selectedTitle}</h1>
            <p>
              {secondaryText}{' '}
              <strong
                style={{
                  textShadow: `0px 0px 12px ${color}, 0px 0px 22px ${skewedColor}`,
                }}
              >
                {percentage}%
              </strong>{' '}
              people!
            </p>
          </div>

          {/* Second section: SVG-like knob */}
          <div className="gamification-knob">
            <div className="percentage-knob">
              <div
                className="knob-arrow"
                style={{
                  bottom: `${percentage}%`,
                  borderBottom: `18px solid ${skewedColor}`,
                }}
              />
            </div>
          </div>

          {/* Third section: Bar */}
          <div className="gamification-bar">
            <div className="percentage-bar" />
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationPersonalized;
