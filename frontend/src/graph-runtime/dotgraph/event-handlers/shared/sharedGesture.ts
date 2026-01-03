// sharedGesture.ts
export type GestureState = {
  pinching: boolean;
  touchCount: number;
  pinchCooldownUntil: number; // ms timestamp
};

export const createGestureState = (): GestureState => ({
  pinching: false,
  touchCount: 0,
  pinchCooldownUntil: 0,
});
