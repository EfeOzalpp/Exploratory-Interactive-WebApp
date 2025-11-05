import React from 'react';
import { useSelectionState } from './SelectionHooks/useSelectionState.ts';
import { HOVER_EVT, type HoverEvtDetail, type ShapeKey } from './hoverBus.ts';

type Props = {
  size?: number;
  onWeightsChange?: (weights: Record<ShapeKey, number>) => void;
};

function SelectionMapInner({ size = 380, onWeightsChange }: Props) {
  const [hovered, setHovered] = React.useState<ShapeKey | undefined>(undefined);
  const HOVER_SCALE = 1.1;

  const {
    svgRef, sizeViewBox, half, R, OUTER_R, R_ACTIVE,
    triPoints, makeRingPath, pos, VW, colorFor,
    onDown,
  } = useSelectionState({
    size,
    onWeightsChange,
    // NEW: keep highlight while dragging and notify the list
    onDragHover: (shape) => {
      setHovered(shape);
      try {
        window.dispatchEvent(new CustomEvent(HOVER_EVT, { detail: { shape, source: 'map' } }));
      } catch {}
    },
  });

  // Also react to list hovers
  React.useEffect(() => {
    const onHover = (e: Event) => {
      const { shape } = (e as CustomEvent<HoverEvtDetail>).detail || {};
      setHovered(shape);
    };
    window.addEventListener(HOVER_EVT, onHover as EventListener);
    return () => window.removeEventListener(HOVER_EVT, onHover as EventListener);
  }, []);

  // Visual helper: line intensity based on current position
  const lineIntensityFromPos = (x: number, y: number) => {
    const dx = x - half, dy = y - half;
    const r = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(r / R_ACTIVE, 1));
    const fadeStart = 0.9, fadeEnd = 1;
    const u = Math.max(0, Math.min((t - fadeStart) / (fadeEnd - fadeStart), 1));
    const smooth = u * u * (3 - 2 * u);
    return Math.max(0, Math.min(1 - smooth, 1));
  };

  // Smooth centered scale for shapes
  const innerStyle: React.CSSProperties = {
    transformOrigin: 'center center',
    transformBox: 'fill-box',
    transition: 'transform 160ms ease',
  };
  const scaleVal = (k: ShapeKey) => (hovered === k ? HOVER_SCALE : 1);

  // helper: plain hover (non-drag) still works
  const enter = (key: ShapeKey) => () => {
    setHovered(key);
    try { window.dispatchEvent(new CustomEvent(HOVER_EVT, { detail: { shape: key, source: 'map' } })); } catch {}
  };
  const leave = (key: ShapeKey) => () => {
    setHovered(h => (h === key ? undefined : h));
    try { window.dispatchEvent(new CustomEvent(HOVER_EVT, { detail: { shape: undefined, source: 'map' } })); } catch {}
  };

  return (
    <div className="selection-map" style={{ userSelect: 'none', width: '100%', height: '100%' }}>
      <div className="selection-glass" style={{ width: '100%', height: '100%', borderRadius: 24 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${sizeViewBox} ${sizeViewBox}`}
          width="100%"
          height="100%"
          style={{ display: 'block', borderRadius: 'inherit', cursor: 'default', touchAction: 'none' }}
          onPointerUp={() => {
            try { window.dispatchEvent(new CustomEvent('gp:weights-commit')); } catch {}
          }}
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

          {/* background / guides */}
          <circle cx={half} cy={half} r={R} fill="url(#centerGlow)" pointerEvents="none" />
          <rect x="0" y="0" width={sizeViewBox} height={sizeViewBox} fill="url(#deactivatedSquares)" mask="url(#ringMask)" pointerEvents="none" />
          <circle cx={half} cy={half} r={OUTER_R} fill="none" stroke="#292929" strokeWidth={2} opacity={0.25} pointerEvents="none" />
          <circle cx={half} cy={half} r={R_ACTIVE} fill="none" stroke="#616161" strokeWidth={1} opacity={0.25} pointerEvents="none" />

          {/* crosshair */}
          {(() => {
            const L = OUTER_R;
            return (
              <>
                <line x1={half} y1={half - L} x2={half} y2={half + L} stroke="#a9a9a9" strokeWidth={1.5} opacity={0.6} pointerEvents="none" />
                <line x1={half - L} y1={half} x2={half + L} y2={half} stroke="#a9a9a9" strokeWidth={1.5} opacity={0.6} pointerEvents="none" />
              </>
            );
          })()}

          {/* radial lines */}
          {(['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).map((key) => {
            const color = colorFor(key, (VW as any)[key]);
            const intensity = lineIntensityFromPos((pos as any)[key].x, (pos as any)[key].y);
            return (
              <RadialLine
                key={`line-${key}`}
                cx={half}
                cy={half}
                x={(pos as any)[key].x}
                y={(pos as any)[key].y}
                color={color}
                intensity={intensity}
              />
            );
          })}

          {/* shapes (outer translates, inner scales) */}
          <g
            data-shape="triangle"
            transform={`translate(${pos.triangle.x} ${pos.triangle.y})`}
            onPointerDown={onDown('triangle')}
            onPointerEnter={enter('triangle')}
            onPointerLeave={leave('triangle')}
            cursor="grab"
          >
            <g style={innerStyle} transform={`scale(${scaleVal('triangle')})`}>
              <polygon points={triPoints} fill={colorFor('triangle', VW.triangle)} />
            </g>
          </g>

          <g
            data-shape="circle"
            transform={`translate(${pos.circle.x} ${pos.circle.y})`}
            onPointerDown={onDown('circle')}
            onPointerEnter={enter('circle')}
            onPointerLeave={leave('circle')}
            cursor="grab"
          >
            <g style={innerStyle} transform={`scale(${scaleVal('circle')})`}>
              <circle cx={0} cy={0} r={26} fill={colorFor('circle', VW.circle)} />
            </g>
          </g>

          <g
            data-shape="square"
            transform={`translate(${pos.square.x} ${pos.square.y})`}
            onPointerDown={onDown('square')}
            onPointerEnter={enter('square')}
            onPointerLeave={leave('square')}
            cursor="grab"
          >
            <g style={innerStyle} transform={`scale(${scaleVal('square')})`}>
              <rect x={-22} y={-22} width={44} height={44} fill={colorFor('square', VW.square)} />
            </g>
          </g>

          <g
            data-shape="diamond"
            transform={`translate(${pos.diamond.x} ${pos.diamond.y})`}
            onPointerDown={onDown('diamond')}
            onPointerEnter={enter('diamond')}
            onPointerLeave={leave('diamond')}
            cursor="grab"
          >
            <g style={innerStyle} transform={`rotate(45) scale(${scaleVal('diamond')})`}>
              <rect x={-22} y={-22} width={44} height={44} fill={colorFor('diamond', VW.diamond)} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function RadialLine({
  cx, cy, x, y, color, intensity,
}: { cx: number; cy: number; x: number; y: number; color: string; intensity: number }) {
  if (intensity <= 0.01) return null;
  const alpha = 0.05 + 0.35 * intensity;
  const width = 2 + 5 * intensity;
  return (
    <line
      x1={cx}
      y1={cy}
      x2={x}
      y2={y}
      stroke={color}
      strokeOpacity={alpha}
      strokeWidth={width}
      strokeLinecap="round"
      pointerEvents="none"
    />
  );
}

export default React.memo(SelectionMapInner);
