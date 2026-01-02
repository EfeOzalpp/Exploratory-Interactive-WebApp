// src/components/survey/questions/hoverBus.ts
export type ShapeKey = 'triangle' | 'circle' | 'square' | 'diamond';

export type HoverEvtDetail = {
  shape?: ShapeKey;           // undefined clears highlight
  source?: 'map' | 'list';    // who emitted (prevents loops if you need)
};

export const HOVER_EVT = 'gp:hover-shape';
