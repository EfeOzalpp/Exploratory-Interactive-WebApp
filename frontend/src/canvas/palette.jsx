// src/canvas/palette.js
// Central place for visual tokens. Expand as you add more glyphs/effects.

export const DOT_COLORS = {
  primary: 'rgba(46, 134, 255, 0.95)',   // vivid light blue
  success: 'rgba(16, 180, 120, 0.95)',
  warning: 'rgba(255, 180, 0, 0.95)',
  danger:  'rgba(240, 70,  80, 0.95)',
  neutral: 'rgba(255, 255, 255, 0.95)',  // white
};

// Small accessor; lets you centralize mapping logic later (e.g., dark mode)
export function getDotColor(key = 'primary') {
  return DOT_COLORS[key] || DOT_COLORS.primary;
}
