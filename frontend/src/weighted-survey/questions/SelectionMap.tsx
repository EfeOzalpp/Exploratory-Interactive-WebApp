import React from 'react';
import { useSelectionState } from './selection-hooks/useSelectionState.ts';
import { HOVER_EVT, type HoverEvtDetail, type ShapeKey } from './hoverBus.ts';

const SET_WEIGHT_EVT = 'gp:list-set-weight';

function lightenHex(hex: string, t = 0.45) {
  const n = hex.replace('#', '');
  const s = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const v = parseInt(s, 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  const L = (x: number) => Math.round(x + (255 - x) * t);
  const toHex2 = (num: number) => num.toString(16).padStart(2, '0');
  return `#${toHex2(L(r))}${toHex2(L(g))}${toHex2(L(b))}`;
}

type Props = {
  size?: number;
  onWeightsChange?: (weights: Record<ShapeKey, number>) => void;
  borderWidth?: number;
};

function SelectionMapInner({ size = 380, onWeightsChange, borderWidth = 3 }: Props) {
  const [hovered, setHovered] = React.useState<ShapeKey | undefined>(undefined);
  const HOVER_SCALE = 1.1;
  const strokeWFor = (k: ShapeKey) => (hovered === k ? borderWidth * 1.2 : borderWidth);

  const {
    svgRef, sizeViewBox, half, R, OUTER_R, R_ACTIVE,
    triPoints, makeRingPath, pos, VW, colorFor,
    onDown, setWeight,
  } = useSelectionState({
    size,
    onWeightsChange,
    onDragHover: (shape) => {
      setHovered(shape);
      try { window.dispatchEvent(new CustomEvent(HOVER_EVT, { detail: { shape, source: 'map' } })); } catch {}
    },
  });

  React.useEffect(() => {
    const onHover = (e: Event) => {
      const { shape } = (e as CustomEvent<HoverEvtDetail>).detail || {};
      setHovered(shape);
    };
    window.addEventListener(HOVER_EVT, onHover as EventListener);
    return () => window.removeEventListener(HOVER_EVT, onHover as EventListener);
  }, []);

  // Listen for slider-driven updates
  React.useEffect(() => {
    const onSet = (e: Event) => {
      const d = (e as CustomEvent).detail as { shape?: ShapeKey; weight?: number };
      if (!d || !d.shape || typeof d.weight !== 'number') return;
      setWeight(d.shape, d.weight);
    };
    window.addEventListener(SET_WEIGHT_EVT, onSet as EventListener);
    return () => window.removeEventListener(SET_WEIGHT_EVT, onSet as EventListener);
  }, [setWeight]);

  // Match the inner pad used in the hook (recompute from R_ACTIVE)
  const R_INNER = Math.max(12, R_ACTIVE * 0.22);
  const R_SPAN  = Math.max(1, R_ACTIVE - R_INNER);

  // Connector fade: compute over [R_INNER..R_ACTIVE] so it “disconnects” sooner near the rim
  const lineIntensityFromPos = (x: number, y: number) => {
    const dx = x - half, dy = y - half;
    const r = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min((r - R_INNER) / R_SPAN, 1));
    const fadeStart = 0.70, fadeEnd = 0.85;
    const u = Math.max(0, Math.min((t - fadeStart) / (fadeEnd - fadeStart), 1));
    const smooth = u * u * (3 - 2 * u);
    return Math.max(0, Math.min(1 - smooth, 1));
  };

  const innerStyle: React.CSSProperties = { transformOrigin: 'center center', transformBox: 'fill-box', transition: 'transform 160ms ease' };
  const scaleVal = (k: ShapeKey) => (hovered === k ? HOVER_SCALE : 1);

  return (
    <div className="selection-map" style={{ userSelect: 'none', width: '100%', height: '100%' }}>
      <div className="selection-glass" style={{ width: '100%', height: '100%', borderRadius: 24 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${sizeViewBox} ${sizeViewBox}`}
          width="100%"
          height="100%"
          style={{ display: 'block', borderRadius: 'inherit', cursor: 'default', touchAction: 'none' }}
          onPointerUp={() => { try { window.dispatchEvent(new CustomEvent('gp:weights-commit')); } catch {} }}
        >
          <defs>
            <radialGradient id="centerGlow" cx={half} cy={half} r={OUTER_R} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <pattern id="deactivatedSquares" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
              <rect width="20" height="20" fill="#f6f8fb" />
              <line x1="0" y1="0" x2="0" y2="20" stroke="#cfd6df" strokeWidth="2" opacity="0.5" />
            </pattern>
            <mask id="ringMask">
              <rect x="0" y="0" width={sizeViewBox} height={sizeViewBox} fill="black" />
              <path d={makeRingPath(OUTER_R, R_ACTIVE)} fill="white" fillRule="evenodd" />
            </mask>
          </defs>

          <circle cx={half} cy={half} r={R} fill="url(#centerGlow)" pointerEvents="none" />
          <rect x="0" y="0" width={sizeViewBox} height={sizeViewBox} fill="url(#deactivatedSquares)" mask="url(#ringMask)" pointerEvents="none" />
          <circle cx={half} cy={half} r={OUTER_R} fill="none" stroke="#292929" strokeWidth={2} opacity={0.25} pointerEvents="none" />
          <circle cx={half} cy={half} r={R_ACTIVE} fill="none" stroke="#616161" strokeWidth={1} opacity={0.25} pointerEvents="none" />

          {(['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).map((key) => {
            const color = colorFor(key, (VW as any)[key]);
            const intensity = lineIntensityFromPos((pos as any)[key].x, (pos as any)[key].y);
            return (
              <line
                key={`line-${key}`}
                x1={half}
                y1={half}
                x2={(pos as any)[key].x}
                y2={(pos as any)[key].y}
                stroke={color}
                strokeOpacity={0.30 * intensity}
                strokeWidth={2 + 5 * intensity}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}

          {/* triangle */}
          <g
            data-shape="triangle"
            transform={`translate(${pos.triangle.x} ${pos.triangle.y})`}
            onPointerDown={onDown('triangle')}
            onPointerEnter={() => setHovered('triangle')}
            onPointerLeave={() => setHovered(h => (h === 'triangle' ? undefined : h))}
            cursor="grab"
          >
            <g style={innerStyle} transform={`scale(${scaleVal('triangle')})`}>
              {(() => {
                const fill = colorFor('triangle', (VW as any).triangle);
                const stroke = lightenHex(fill, 0.45);
                return <polygon points={triPoints} fill={fill} stroke={stroke} strokeWidth={strokeWFor('triangle')} strokeLinejoin="round" />;
              })()}
            </g>
          </g>

          {/* circle */}
          <g
            data-shape="circle"
            transform={`translate(${pos.circle.x} ${pos.circle.y})`}
            onPointerDown={onDown('circle')}
            onPointerEnter={() => setHovered('circle')}
            onPointerLeave={() => setHovered(h => (h === 'circle' ? undefined : h))}
            cursor="grab"
          >
            <g style={innerStyle} transform={`scale(${scaleVal('circle')})`}>
              {(() => {
                const fill = colorFor('circle', (VW as any).circle);
                const stroke = lightenHex(fill, 0.45);
                return <circle cx={0} cy={0} r={26} fill={fill} stroke={stroke} strokeWidth={strokeWFor('circle')} />;
              })()}
            </g>
          </g>

          {/* square */}
          <g
            data-shape="square"
            transform={`translate(${pos.square.x} ${pos.square.y})`}
            onPointerDown={onDown('square')}
            onPointerEnter={() => setHovered('square')}
            onPointerLeave={() => setHovered(h => (h === 'square' ? undefined : h))}
            cursor="grab"
          >
            <g style={innerStyle} transform={`scale(${scaleVal('square')})`}>
              {(() => {
                const fill = colorFor('square', (VW as any).square);
                const stroke = lightenHex(fill, 0.45);
                return <rect x={-22} y={-22} width={44} height={44} fill={fill} stroke={stroke} strokeWidth={strokeWFor('square')} strokeLinejoin="round" />;
              })()}
            </g>
          </g>

          {/* diamond */}
          <g
            data-shape="diamond"
            transform={`translate(${pos.diamond.x} ${pos.diamond.y})`}
            onPointerDown={onDown('diamond')}
            onPointerEnter={() => setHovered('diamond')}
            onPointerLeave={() => setHovered(h => (h === 'diamond' ? undefined : h))}
            cursor="grab"
          >
            <g style={innerStyle} transform={`rotate(45) scale(${scaleVal('diamond')})`}>
              {(() => {
                const fill = colorFor('diamond', (VW as any).diamond);
                const stroke = lightenHex(fill, 0.45);
                return <rect x={-22} y={-22} width={44} height={44} fill={fill} stroke={stroke} strokeWidth={strokeWFor('diamond')} strokeLinejoin="round" />;
              })()}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

export default React.memo(SelectionMapInner);
