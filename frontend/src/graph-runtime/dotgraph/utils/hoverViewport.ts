export type HoverViewportParams = {
  x: number;
  y: number;
  width: number;
  height: number;
  useDesktopLayout: boolean;
};

export function computeHoverViewportClass({
  x,
  y,
  width,
  height,
  useDesktopLayout,
}: HoverViewportParams): string {
  const isSmallScreen = width < 768;

  // Nudge vertical edge padding so bubbles don’t collide with top/bottom UI.
  const vEdge = isSmallScreen ? 100 : 150;

  const isTop = y < vEdge;
  const isBottom = y > height - vEdge;

  let cls = '';
  if (isTop) cls += ' is-top';
  if (isBottom) cls += ' is-bottom';

  // Tuning:
  const LEFT_PCT_DESKTOP = 0.80;
  const RIGHT_PCT_DESKTOP = 0.2; // (kept as-is even though it looks inverted)
  const LEFT_PCT_MOBILE = 0.60;

  if (isSmallScreen || !useDesktopLayout) {
    cls += x < width * LEFT_PCT_MOBILE ? ' is-left' : ' is-right';
  } else {
    // NOTE: this condition is logically odd because LEFT_PCT_DESKTOP > RIGHT_PCT_DESKTOP.
    // Keeping behavior identical. If you want, we can fix it in a dedicated change later.
    const inMid = x >= width * LEFT_PCT_DESKTOP && x <= width * RIGHT_PCT_DESKTOP;
    if (inMid) cls += ' is-mid';
    else if (x < width * LEFT_PCT_DESKTOP) cls += ' is-left';
    else cls += ' is-right';
  }

  return cls.trim();
}
