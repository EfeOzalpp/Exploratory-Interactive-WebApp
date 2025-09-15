import React, { useEffect, useRef, useState } from 'react';
import '../../styles/gamification.css';

const STORAGE_VERSION = 'v1';
const FADE_MS = 200;          // root fade timing
const PROX_THRESHOLD = 0.02;  // ~18% of viewport diagonal

const GamificationPersonalized = ({ userData, percentage, color }) => {
  const [selectedTitle, setSelectedTitle] = useState('');
  const [secondaryText, setSecondaryText] = useState('');

  const [open, setOpen] = useState(true);  // logical open/close
  const [nearButton, setNearButton] = useState(false);

  // proximity-driven reveal
  const btnRef = useRef(null);
  const rafRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0, has: false });

  useEffect(() => {
    const onMouseMove = (e) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY, has: true };
      scheduleCheck();
    };
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

  // title + secondary selection
  useEffect(() => {
    if (percentage === undefined || !userData) return;

    const titles = {
      '0-20': ['Carbon Culprit', 'Planet Polluter', 'Sustainability Enemy'],
      '21-40': ['I Have a Backup Planet!', 'Nature? Is it Edible?'],
      '41-60': ['Middle Spot is Yours', 'Is it trendy to like nature?'],
      '61-80': ['Humble-Green MF', 'Sustainability and Whatnot'],
      '81-100': ["Nature's Humble Savior", 'Damn! Larger than life habits'],
    };
    const secondaryPool = {
      '0-20': ["Earth would've needed you, You're surpass only"],
      '21-40': ["Hands down, it's not a crime, you surpass only"],
      '41-60': ["You're getting there! -Ahead of"],
      '61-80': ['Spectacular and frenzy! You\'re higher'],
      '81-100': ["You're ahead of almost everyone, higher than"],
    };

    const pct = Number(percentage) || 0;
    const bucket =
      pct <= 20 ? '0-20' :
      pct <= 40 ? '21-40' :
      pct <= 60 ? '41-60' :
      pct <= 80 ? '61-80' : '81-100';

    const storageKey = `gp:${STORAGE_VERSION}:${userData._id}:${bucket}`;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const { title, secondary } = JSON.parse(cached);
        setSelectedTitle(title);
        setSecondaryText(secondary);
        return;
      }
    } catch (_) {}

    const title = pick(titles[bucket]);
    const secondary = pick(secondaryPool[bucket]);
    setSelectedTitle(title);
    setSecondaryText(secondary);

    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ title, secondary }));
    } catch (_) {}
  }, [percentage, userData]);

  if (!userData) return null;

  // color helpers (unchanged)
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
      { stop: 0.0, color: { r: 249, g: 14, b: 33 } },
      { stop: 0.46, color: { r: 252, g: 159, b: 29 } },
      { stop: 0.64, color: { r: 245, g: 252, b: 95 } },
      { stop: 0.8, color: { r: 0, g: 253, b: 156 } },
      { stop: 1.0, color: { r: 1, g: 238, b: 0 } },
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

  const panelId = `gp-panel-${userData?._id || 'me'}`;
  const label = open ? 'Hide your result' : 'Show your result';
  const symbol = open ? '−' : '+';

  const visible = open || nearButton;

  return (
    <div
      className="gp-root"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {/* Toggle button */}
      <button
        ref={btnRef}
        type="button"
        className="toggle-button gp-toggle"
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        style={{ pointerEvents: 'auto' }}
      >
        <span className="gp-toggle-symbol">{symbol}</span>
      </button>

      {/* Panel: unmounts immediately when closed */}
      {open && (
        <div
          id={panelId}
          className="personalized-result gp-container"
          style={{ pointerEvents: 'none' }}
        >
          <div className="gamification-text">
            <h4 className="gam-title">Compared to the pool you are:</h4>
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

          <div className="gamification-bar">
            <div className="percentage-bar" />
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationPersonalized;
