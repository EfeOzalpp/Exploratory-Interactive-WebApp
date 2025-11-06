// src/components/survey/questions/AnswersList.tsx
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '../types.ts';
import { HOVER_EVT, type ShapeKey } from './hoverBus.ts';

export type ShapeKeyLocal = 'circle' | 'square' | 'triangle' | 'diamond';

// Event name used to drive the SelectionMap programmatically
export const SET_WEIGHT_EVT = 'gp:list-set-weight';

const SHAPE_COLORS: Record<ShapeKeyLocal, string> = {
  triangle: '#F4A42F',
  circle:   '#4498E6',
  square:   '#64B883',
  diamond:  '#9E82F1',
};
const OUTER_GRAY = '#6f7781';
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
// keep in sync with map thresholds
const DEACTIVATE_EPS = 0.02;

// simple color utils
const hexToRgb = (hex: string) => {
  const n = hex.replace('#', '');
  const s = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const v = parseInt(s, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};
const toHex2 = (n: number) => n.toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgbToHex(lerp(A.r, B.r), lerp(A.g, B.g), lerp(A.b, B.b));
};
const colorFor = (shape: ShapeKeyLocal, factor: number) => {
  const t = ease(clamp01(factor));
  return mix(OUTER_GRAY, SHAPE_COLORS[shape], t);
};

const keyToShape = (key: string): ShapeKeyLocal => {
  const k = key.toUpperCase();
  if (k === 'A') return 'circle';
  if (k === 'B') return 'square';
  if (k === 'C') return 'triangle';
  return 'diamond';
};

type Props = {
  question: Question;
  factors: Record<ShapeKeyLocal, number>; // live factors from map (0..1)
  className?: string;
};

const ShapeGlyph = ({ shape, color, size = 18 }: { shape: ShapeKeyLocal; color: string; size?: number }) => {
  const half = size / 2;
  const triR = size * 0.42, sqS = size * 0.75, cirR = size * 0.44, diaS = size * 0.74;
  if (shape === 'triangle') {
    const a = -Math.PI / 2, step = (2 * Math.PI) / 3;
    const p1 = `${half + triR * Math.cos(a)},${half + triR * Math.sin(a)}`;
    const p2 = `${half + triR * Math.cos(a + step)},${half + triR * Math.sin(a + step)}`;
    const p3 = `${half + triR * Math.cos(a + 2 * step)},${half + triR * Math.sin(a + 2 * step)}`;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <polygon points={`${p1} ${p2} ${p3}`} fill={color} />
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <rect x={half - sqS / 2} y={half - sqS / 2} width={sqS} height={sqS} fill={color} rx={size * 0.06} />
      </svg>
    );
  }
  if (shape === 'diamond') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <g transform={`translate(${half} ${half}) rotate(45)`}>
          <rect x={-diaS / 2} y={-diaS / 2} width={diaS} height={diaS} fill={color} rx={size * 0.05} />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={half} cy={half} r={cirR} fill={color} />
    </svg>
  );
};

function AnswersListInner({ question, factors, className }: Props) {
  const [highlighted, setHighlighted] = useState<ShapeKey | undefined>();
  const [openedKey, setOpenedKey] = useState<string | null>(null);

  // local slider mirror of live factors so the bar/shape color fades with the user's current value
  const [sliderVals, setSliderVals] = useState<Record<ShapeKeyLocal, number>>({
    circle: 0, square: 0, triangle: 0, diamond: 0,
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevQidRef = useRef<string | number | undefined>(undefined);

  // Fire a reset event when the question changes (SelectionMap recenters)
  useEffect(() => {
    if (prevQidRef.current !== question?.id) {
      prevQidRef.current = question?.id;
      try {
        window.dispatchEvent(new CustomEvent('gp:question-changed', { detail: { id: question?.id } }));
      } catch {}
    }
  }, [question?.id]);

  // Sync sliders with live map factors (ensures bar & glyph color fade with the *current* value)
  useEffect(() => {
    setSliderVals({
      circle:   Number(factors.circle ?? 0),
      square:   Number(factors.square ?? 0),
      triangle: Number(factors.triangle ?? 0),
      diamond:  Number(factors.diamond ?? 0),
    });
  }, [factors.circle, factors.square, factors.triangle, factors.diamond]);

  // Hover coming from the map
  useEffect(() => {
    const onHover = (e: Event) => {
      const { shape, source } = (e as CustomEvent<{ shape?: ShapeKey; source?: 'map' | 'list' }>).detail || {};
      if (source === 'map') {
        setHighlighted(shape);
        if (shape) {
          const key = question.options.find(o => keyToShape(o.key) === shape)?.key ?? null;
          setOpenedKey(key);
        }
      }
    };
    window.addEventListener(HOVER_EVT, onHover as EventListener);
    return () => window.removeEventListener(HOVER_EVT, onHover as EventListener);
  }, [question.options]);

  // Close on outside click/tap — robust Node guard
  useEffect(() => {
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = (e as any).target as EventTarget | null;
      if (!target || !(target instanceof Node)) {
        setOpenedKey(null);
        setHighlighted(undefined);
        return;
      }
      if (!root.contains(target)) {
        setOpenedKey(null);
        setHighlighted(undefined);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  const rows = useMemo(() => {
    // Keep rows visible even when factor is 0
    return question.options.map((o) => {
      const shape = keyToShape(o.key);
      const factor = Number(factors[shape] ?? 0);
      const base = Number(o.weight ?? 0);
      const score = base * factor;
      return { key: o.key, label: o.label, base, score, shape };
    });
  }, [question.options, factors]);

  const send = (shape?: ShapeKey, source: 'map' | 'list' = 'list') =>
    window.dispatchEvent(new CustomEvent(HOVER_EVT, { detail: { shape, source } }));

  const onSliderChange = (shape: ShapeKeyLocal) => (val: number) => {
    const v = clamp01(val);
    setSliderVals(s => ({ ...s, [shape]: v }));
    try {
      window.dispatchEvent(
        new CustomEvent(SET_WEIGHT_EVT, { detail: { shape, weight: v } })
      );
    } catch {}
  };

  const safelyClose = (e: React.MouseEvent) => {
    const current = e.currentTarget as HTMLElement;
    const next = (e as any).relatedTarget as EventTarget | null;
    if (next && next instanceof Node && current.contains(next)) return;
    setHighlighted(undefined);
    setOpenedKey(null);
    send(undefined, 'list');
  };

  const isRowOpen = (rowShape: ShapeKeyLocal, rowKey: string) =>
    (highlighted === rowShape) || (openedKey === rowKey);

  return (
    <div
      ref={rootRef}
      className={`answer-part ${className ?? ''}`.trim()}
      aria-live="polite"
    >
      {/* Scoped slider styling: thumb color + shape mirrors the glyph */}
      <style>{`
        .q-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 999px;
          outline: none;
          background: #D7DDE4; /* track is replaced inline with gradient */
        }
        .q-slider:focus { outline: none; }

        /* WebKit thumb (Chrome, Edge, Safari) */
        .q-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px; height: 18px;
          border: 2px solid #fff;
          background: var(--thumb-color, #999);
          box-shadow: 0 1px 3px rgba(0,0,0,.15);
          border-radius: 50%;
        }
        .q-slider[data-shape="square"]::-webkit-slider-thumb {
          border-radius: 4px;
        }
        .q-slider[data-shape="diamond"]::-webkit-slider-thumb {
          border-radius: 4px;
          transform: rotate(45deg);
        }
        .q-slider[data-shape="triangle"]::-webkit-slider-thumb {
          border-radius: 0;
          /* triangle via clip-path */
          -webkit-clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          background: var(--thumb-color, #999);
        }

        /* Firefox thumb */
        .q-slider::-moz-range-thumb {
          width: 18px; height: 18px;
          border: 2px solid #fff;
          background: var(--thumb-color, #999);
          box-shadow: 0 1px 3px rgba(0,0,0,.15);
          border-radius: 50%;
        }
        .q-slider[data-shape="square"]::-moz-range-thumb {
          border-radius: 4px;
        }
        .q-slider[data-shape="diamond"]::-moz-range-thumb {
          border-radius: 4px;
          transform: rotate(45deg);
        }
        .q-slider[data-shape="triangle"]::-moz-range-thumb {
          border-radius: 0;
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          background: var(--thumb-color, #999);
        }

        /* Hide default track in Firefox so our gradient shows */
        .q-slider::-moz-range-track { background: transparent; }
      `}</style>

      <div className="answers-stack" style={{ position: 'relative', overflow: 'visible' }}>
        {rows.length === 0 ? (
          <div className="answer-row is-placeholder" aria-hidden>
            <div className="answer-content">
              <div className="q-option">
                <span className="q-option-label">Make a selection on the map</span>
                <span className="q-option-meter" data-weight="0.00" />
              </div>
            </div>
          </div>
        ) : (
          rows.map(row => {
            const live = clamp01(sliderVals[row.shape] ?? 0);
            const fill = colorFor(row.shape, live);   // slider + glyph tint
            const pct = Math.round(live * 100);
            const isDeactivated = live <= DEACTIVATE_EPS;

            return (
              <div
                key={row.key}
                className="answer-row-wrap"
                style={{ position: 'relative', zIndex: isRowOpen(row.shape, row.key) ? 3 : 1 }}
                onMouseLeave={safelyClose}
              >
                <div
                  className={`answer-row shape--${row.shape}${isRowOpen(row.shape, row.key) ? ' is-highlighted' : ''}`.trim()}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => {
                    setHighlighted(row.shape as ShapeKey);
                    setOpenedKey(row.key);
                    send(row.shape as ShapeKey, 'list');
                  }}
                  onFocus={() => {
                    setHighlighted(row.shape as ShapeKey);
                    setOpenedKey(row.key);
                    send(row.shape as ShapeKey, 'list');
                  }}
                  onTouchStart={() => {
                    setOpenedKey(row.key);
                    setHighlighted(row.shape as ShapeKey);
                    send(row.shape as ShapeKey, 'list');
                  }}
                  onClick={() => {
                    setOpenedKey(k => (k === row.key ? null : row.key));
                  }}
                >
                  <div className="answer-content">
                    <div className="q-option">
                      <span
                        className="q-option-label"
                        style={{
                          color: isDeactivated ? '#97A1AF' : undefined, // lighter gray when "off"
                          textOverflow: 'ellipsis',
                          display: 'block',
                          minWidth: 0,
                          maxWidth: '100%',
                        }}
                        title={row.label}
                      >
                        {row.label}
                      </span>
                      <span className="q-option-meter" data-weight={row.score.toFixed(2)} />
                    </div>
                    <div className="q-option-shape" aria-hidden>
                      <ShapeGlyph shape={row.shape} color={fill} />
                    </div>
                  </div>
                </div>

                {isRowOpen(row.shape, row.key) && (
                  <div
                    className="q-option-slider"
                    onMouseEnter={() => {
                      setHighlighted(row.shape as ShapeKey);
                      setOpenedKey(row.key);
                    }}
                  >
                    <div className="slider-inner">
                      <p className="none" style={{ margin: 0, whiteSpace: 'nowrap' }}>none</p>

                      <input
                        id={`slider-${row.key}`}
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={live}
                        onInput={(e) => onSliderChange(row.shape)((e.target as HTMLInputElement).valueAsNumber)}
                        onChange={(e) => onSliderChange(row.shape)((e.target as HTMLInputElement).valueAsNumber)}
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={Number(live.toFixed(2))}
                        className="q-slider"
                        data-shape={row.shape}
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 999,
                          outline: 'none',
                          background: `linear-gradient(to right, ${fill} ${pct}%, #D7DDE4 ${pct}%)`,
                          ['--thumb-color' as any]: fill,
                        }}
                      />

                      <p className="alot" style={{ margin: 0, whiteSpace: 'nowrap' }}>a lot</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default memo(AnswersListInner);
