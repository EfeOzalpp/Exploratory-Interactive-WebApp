// src/components/survey/questions/AnswersList.tsx
import React, { memo, useMemo } from 'react';
import type { Question } from '../types.ts';
import { HOVER_EVT, type ShapeKey } from './hoverBus.ts';

export type ShapeKeyLocal = 'circle' | 'square' | 'triangle' | 'diamond';

const SHAPE_COLORS: Record<ShapeKeyLocal, string> = {
  triangle: '#F4A42F',
  circle:   '#4498E6',
  square:   '#64B883',
  diamond:  '#9E82F1',
};
const OUTER_GRAY = '#6f7781';
const ease = (t: number) => t * t * (3 - 2 * t);
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
  const t = ease(Math.max(0, Math.min(1, factor)));
  return mix(OUTER_GRAY, SHAPE_COLORS[shape], t);
};
const fontScaleFor = (factor: number) => {
  const f = Math.max(0, Math.min(1, factor));
  const t = ease(Math.pow(f, 1.5));
  return 0.95 + (1.7 - 0.95) * t;
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
  factors: Record<ShapeKeyLocal, number>;
  className?: string;
};

const IS_OFF_EPS = 0.01;

const ShapeGlyph = ({ shape, color, size = 18 }: { shape: ShapeKeyLocal; color: string; size?: number }) => {
  const half = size / 2;
  const triR = size * 0.42, sqS = size * 0.75, cirR = size * 0.44, diaS = size * 0.74;
  if (shape === 'triangle') {
    const a = -Math.PI / 2, step = (2 * Math.PI) / 3;
    const p1 = `${half + triR * Math.cos(a)},${half + triR * Math.sin(a)}`;
    const p2 = `${half + triR * Math.cos(a + step)},${half + triR * Math.sin(a + step)}`;
    const p3 = `${half + triR * Math.cos(a + 2 * step)},${half + triR * Math.sin(a + 2 * step)}`;
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden><polygon points={`${p1} ${p2} ${p3}`} fill={color} /></svg>;
  }
  if (shape === 'square') {
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden><rect x={half - sqS / 2} y={half - sqS / 2} width={sqS} height={sqS} fill={color} rx={size * 0.06} /></svg>;
  }
  if (shape === 'diamond') {
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden><g transform={`translate(${half} ${half}) rotate(45)`}><rect x={-diaS / 2} y={-diaS / 2} width={diaS} height={diaS} fill={color} rx={size * 0.05} /></g></svg>;
  }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden><circle cx={half} cy={half} r={cirR} fill={color} /></svg>;
};

function AnswersListInner({ question, factors, className }: Props) {
  const [highlighted, setHighlighted] = React.useState<ShapeKey | undefined>();

  // React to map hover to toggle row highlight
  React.useEffect(() => {
    const onHover = (e: Event) => {
      const { shape, source } = (e as CustomEvent<{ shape?: ShapeKey; source?: 'map' | 'list' }>).detail || {};
      if (source === 'map') setHighlighted(shape);
    };
    window.addEventListener(HOVER_EVT, onHover as EventListener);
    return () => window.removeEventListener(HOVER_EVT, onHover as EventListener);
  }, []);

  const rows = useMemo(() => {
    const all = question.options.map((o) => {
      const shape = keyToShape(o.key);
      const factor = Number(factors[shape] ?? 0);
      const active = factor > IS_OFF_EPS;
      const base = Number(o.weight ?? 0);
      const score = active ? base * factor : 0;
      return { key: o.key, label: o.label, base, score, active, shape, factor };
    });
    return all.filter(r => r.active);
  }, [question.options, factors]);

  const send = (shape?: ShapeKey, source: 'map' | 'list' = 'list') =>
    window.dispatchEvent(new CustomEvent(HOVER_EVT, { detail: { shape, source } }));

  return (
    <div className={`answer-part ${className ?? ''}`.trim()} aria-live="polite">
      <div className="answers-stack">
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
            const fill = colorFor(row.shape, row.factor);
            const fontScale = fontScaleFor(row.factor);

            return (
              <div
                key={row.key}
                className={`answer-row shape--${row.shape}${highlighted === row.shape ? ' is-highlighted' : ''}`.trim()}
                role="button"
                tabIndex={0}
                onMouseEnter={() => { setHighlighted(row.shape as ShapeKey); send(row.shape as ShapeKey, 'list'); }}
                onMouseLeave={() => { setHighlighted(undefined); send(undefined, 'list'); }}
                onFocus={() => { setHighlighted(row.shape as ShapeKey); send(row.shape as ShapeKey, 'list'); }}
                onBlur={() => { setHighlighted(undefined); send(undefined, 'list'); }}
                onTouchStart={() => { setHighlighted(row.shape as ShapeKey); send(row.shape as ShapeKey, 'list'); }}
                onTouchEnd={() => { setHighlighted(undefined); send(undefined, 'list'); }}
              >
                <div className="answer-content">
                  <div className="q-option">
                    <span
                      className="q-option-label"
                      style={{ fontSize: `${fontScale}em`, lineHeight: 1.1, textOverflow: 'ellipsis', display: 'block', minWidth: 0, maxWidth: '100%' }}
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
            );
          })
        )}
      </div>
    </div>
  );
}

export default memo(AnswersListInner);
