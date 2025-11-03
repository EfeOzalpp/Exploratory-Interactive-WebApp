// src/components/survey/questions/SelectionHooks/geometry.ts

export type Radii = {
  half: number;
  inset: number;
  R: number;
  OUTER_R: number;
  DEAD_BAND: number;
  R_ACTIVE: number;
};

export const calcRadii = (size: number) => {
  const half = size / 2;
  const inset = 12;
  const R = half - inset;
  const OUTER_R = R * 0.92;
  // Wider dead band per your latest change (22%)
  const DEAD_BAND = Math.max(8, OUTER_R * 0.22);
  const R_ACTIVE = OUTER_R - DEAD_BAND;
  return { half, inset, R, OUTER_R, DEAD_BAND, R_ACTIVE } as Radii;
};

export const pointOnCircle = (half: number, theta: number, r: number) => ({
  x: half + r * Math.cos(theta),
  y: half + r * Math.sin(theta),
});

export const makeRingPath = (half: number, outerR: number, innerR: number) => {
  const outerD = `
    M ${half} ${half}
    m -${outerR},0
    a ${outerR},${outerR} 0 1,0 ${outerR * 2},0
    a ${outerR},${outerR} 0 1,0 -${outerR * 2},0
  `;
  const innerD = `
    M ${half} ${half}
    m -${innerR},0
    a ${innerR},${innerR} 0 1,0 ${innerR * 2},0
    a ${innerR},${innerR} 0 1,0 -${innerR * 2},0
  `;
  return `${outerD} ${innerD}`;
};

export const triPointsPath = (R_TRI = 28) => {
  const a = -Math.PI / 2;
  const step = (2 * Math.PI) / 3;
  const x1 = R_TRI * Math.cos(a),         y1 = R_TRI * Math.sin(a);
  const x2 = R_TRI * Math.cos(a + step),  y2 = R_TRI * Math.sin(a + step);
  const x3 = R_TRI * Math.cos(a + 2*step),y3 = R_TRI * Math.sin(a + 2*step);
  return `${x1},${y1} ${x2},${y2} ${x3},${y3}`;
};

// Convert client -> SVG coords; robust across bounds
export const clientToSvg = (svg: SVGSVGElement, clientX: number, clientY: number) => {
  const ctm = svg.getScreenCTM();
  if (ctm && (svg as any).createSVGPoint) {
    const pt = (svg as any).createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const { x, y } = pt.matrixTransform(ctm.inverse());
    return { x, y };
  }
  const rect = svg.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
};
