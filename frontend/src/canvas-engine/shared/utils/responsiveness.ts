// src/canvas-engine/shared/utils/responsiveness.ts

export type DeviceType = 'small' | 'medium' | 'large';

export function deviceType(w: number): DeviceType {
  if (w <= 767) return 'small';
  if (w <= 1024) return 'medium';
  return 'large';
}
