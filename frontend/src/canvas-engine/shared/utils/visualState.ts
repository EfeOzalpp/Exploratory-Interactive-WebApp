// Minimal global visual state for shapes.
// Shapes import getVisualState() and use only what they need.

let _state = {
  gradientRGB: null,   // {r,g,b} or null
  liveAvg: 0.5,        // 0..1
  timeMs: 0,           // updated each frame
};

export function setVisualState(patch = {}) {
  _state = { ..._state, ...patch };
}

export function getVisualState() {
  return _state;
}
