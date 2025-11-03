// src/components/survey/questions/SelectionMap.tsx
import React from 'react';
import { useSelectionState } from './SelectionHooks/useSelectionState.ts';

type ShapeKey = 'triangle' | 'circle' | 'square' | 'diamond';

function SelectionMapInner({
  // `size` only affects internal geometry (viewBox) via the hook.
  // Rendering size is fully controlled by the parent container.
  size = 380,
  onWeightsChange,
}: {
  size?: number;
  onWeightsChange?: (weights: Record<ShapeKey, number>) => void;
}) {
  const {
    // refs & constants
    svgRef, sizeViewBox, half, inset, R, OUTER_R, R_ACTIVE,
    // visuals
    triPoints, makeRingPath, pos, VW, colorFor, easeFn,
    // events
    onDown,
  } = useSelectionState({ size, onWeightsChange });

  // Keep radial line visible until very near the rim
  const lineIntensityFromPos = (x: number, y: number) => {
    const dx = x - half, dy = y - half;
    const r = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(r / R_ACTIVE, 1)); // 0..1

    const fadeStart = 0.9;
    const fadeEnd = 1;
    const u = Math.max(0, Math.min((t - fadeStart) / (fadeEnd - fadeStart), 1));
    const smooth = u * u * (3 - 2 * u); // smoothstep
    const intensity = 1 - smooth;

    const floor = 0;
    return Math.max(floor, Math.min(intensity, 1));
  };

  return (
    <div className="selection-map" style={{ userSelect: 'none', width: '100%', height: '100%' }}>
      {/* Glass wrapper for the SVG — now fully responsive */}
      <div
        className="selection-glass"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 24,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${sizeViewBox} ${sizeViewBox}`}
          width="100%"
          height="100%"
          style={{
            display: 'block',
            borderRadius: 'inherit',
            cursor: 'default',
            touchAction: 'none', 
          }}
          onPointerUp={() => {
            try {
              window.dispatchEvent(new CustomEvent('gp:weights-commit'));
            } catch {}
          }}
        >
          <defs>
            {/* Center glow constrained to OUTER_R via userSpaceOnUse */}
            <radialGradient
              id="centerGlow"
              cx={half}
              cy={half}
              r={OUTER_R}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>

            {/* Subtle diagonal hatch for inactive ring */}
            <pattern
              id="deactivatedSquares"
              patternUnits="userSpaceOnUse"
              width="20"
              height="20"
              patternTransform="rotate(45)"
            >
              <rect width="20" height="20" fill="#f6f8fb" />
              <line x1="0" y1="0" x2="0" y2="20" stroke="#cfd6df" strokeWidth="2" opacity="0.5" />
            </pattern>

            {/* Mask to confine pattern to the annulus R_ACTIVE..OUTER_R */}
            <mask id="ringMask">
              <rect x="0" y="0" width={sizeViewBox} height={sizeViewBox} fill="black" />
              <path d={makeRingPath(OUTER_R, R_ACTIVE)} fill="white" fillRule="evenodd" />
            </mask>
          </defs>

          {/* Soft center glow */}
          <circle cx={half} cy={half} r={R} fill="url(#centerGlow)" pointerEvents="none" />

          {/* Dead-band visuals (ALL non-interactive) */}
          <rect
            x="0"
            y="0"
            width={sizeViewBox}
            height={sizeViewBox}
            fill="url(#deactivatedSquares)"
            mask="url(#ringMask)"
            pointerEvents="none"
          />
          <circle
            cx={half}
            cy={half}
            r={OUTER_R}
            fill="none"
            stroke="#292929"
            strokeWidth={2}
            opacity={0.25}
            pointerEvents="none"
          />
          <circle
            cx={half}
            cy={half}
            r={R_ACTIVE}
            fill="none"
            stroke="#616161"
            strokeWidth={1}
            opacity={0.25}
            pointerEvents="none"
          />

          {/* Crosshair (shortened) */}
          {(() => {
            const crosshairLength = OUTER_R;
            return (
              <>
                <line
                  x1={half}
                  y1={half - crosshairLength}
                  x2={half}
                  y2={half + crosshairLength}
                  stroke="#a9a9a9"
                  strokeWidth={1.5}
                  opacity={0.6}
                  pointerEvents="none"
                />
                <line
                  x1={half - crosshairLength}
                  y1={half}
                  x2={half + crosshairLength}
                  y2={half}
                  stroke="#a9a9a9"
                  strokeWidth={1.5}
                  opacity={0.6}
                  pointerEvents="none"
                />
              </>
            );
          })()}

          {/* Radial lines (intensity based on position, not weight) */}
          {(['triangle', 'circle', 'square', 'diamond'] as ShapeKey[]).map((key) => {
            const color = colorFor(key, VW[key]);
            const intensity = lineIntensityFromPos(pos[key].x, pos[key].y);
            return (
              <RadialLine
                key={`line-${key}`}
                cx={half}
                cy={half}
                x={pos[key].x}
                y={pos[key].y}
                color={color}
                intensity={intensity}
              />
            );
          })}

          {/* Draggables (start drag on pointer down) */}
          <g transform={`translate(${pos.triangle.x} ${pos.triangle.y})`} onPointerDown={onDown('triangle')} cursor="grab">
            <polygon points={triPoints} fill={colorFor('triangle', VW.triangle)} />
          </g>

          <g transform={`translate(${pos.circle.x} ${pos.circle.y})`} onPointerDown={onDown('circle')} cursor="grab">
            <circle cx={0} cy={0} r={26} fill={colorFor('circle', VW.circle)} />
          </g>

          <g transform={`translate(${pos.square.x} ${pos.square.y})`} onPointerDown={onDown('square')} cursor="grab">
            <rect x={-22} y={-22} width={44} height={44} fill={colorFor('square', VW.square)} />
          </g>

          <g transform={`translate(${pos.diamond.x} ${pos.diamond.y}) rotate(45)`} onPointerDown={onDown('diamond')} cursor="grab">
            <rect x={-22} y={-22} width={44} height={44} fill={colorFor('diamond', VW.diamond)} />
          </g>
        </svg>
      </div>
    </div>
  );
}

function RadialLine({
  cx,
  cy,
  x,
  y,
  color,
  intensity,
}: {
  cx: number;
  cy: number;
  x: number;
  y: number;
  color: string;
  intensity: number;
}) {
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
