// src/canvas-engine/adjustable-rules/responsiveness.ts

export type DeviceType = 'mobile' | 'tablet' | 'laptop';

export function deviceType(w: number): DeviceType {
  if (w <= 767) return 'mobile';
  if (w <= 1024) return 'tablet';
  return 'laptop';
}
