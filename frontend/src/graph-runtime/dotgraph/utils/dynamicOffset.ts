// src/components/dotgraph/utils/dynamicOffset.ts

type Viewport = { width: number; height: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Bezier curve for fine-grained control
const cubicBezier = (t: number, p0: number, p1: number, p2: number, p3: number): number => {
  const u = 1 - t;
  return u ** 3 * p0 + 3 * u ** 2 * t * p1 + 3 * u * t ** 2 * p2 + t ** 3 * p3;
};

export function computeDynamicOffset(width: number, height: number): number {
  // Define minimum and maximum viewport dimensions
  const landscapeMinViewport: Viewport = { width: 100, height: 66 };
  const landscapeMaxViewport: Viewport = { width: 5000, height: 3067 };

  const portraitMinViewport: Viewport = { width: 66, height: 100 };
  const portraitMaxViewport: Viewport = { width: 3067, height: 5000 };

  // Set the range for dynamic offset (landscape mode)
  const landscapeMinOffset = 50;
  const landscapeMaxOffset = 250;

  // Normalize width/height to [0, 1]
  const landscapeNormalizedWidth = clamp01(
    (width - landscapeMinViewport.width) / (landscapeMaxViewport.width - landscapeMinViewport.width)
  );

  // (You computed height too; keeping it here in case you later want 2D influence)
  const _landscapeNormalizedHeight = clamp01(
    (height - landscapeMinViewport.height) / (landscapeMaxViewport.height - landscapeMinViewport.height)
  );
  void _landscapeNormalizedHeight;

  const _portraitNormalizedWidth = clamp01(
    (width - portraitMinViewport.width) / (portraitMaxViewport.width - portraitMinViewport.width)
  );
  const _portraitNormalizedHeight = clamp01(
    (height - portraitMinViewport.height) / (portraitMaxViewport.height - portraitMinViewport.height)
  );
  void _portraitNormalizedWidth;
  void _portraitNormalizedHeight;

  const isPortrait = height > width;

  // Calculate dynamic offset based on orientation
  let offset: number;

  if (isPortrait) {
    // Portrait mode with conditional ranges for width
    if (width >= 66 && width <= 675) {
      // First range: 66px to 675px width
      const minOffset = 80;
      const maxOffset = 165;
      const t = clamp01((width - 66) / (675 - 66));
      offset = lerp(minOffset, maxOffset, t);
    } else if (width > 675 && width <= 900) {
      // Second range: 675px to 900px width
      const minOffset = 30;
      const maxOffset = 100;
      const t = clamp01((width - 675) / (900 - 675));
      offset = lerp(minOffset, maxOffset, t);
    } else if (width > 900 && width <= 1350) {
      // Third range: 900px to 1350px width
      const minOffset = 75;
      const maxOffset = 85;
      const t = clamp01((width - 675) / (1350 - 675));
      offset = lerp(minOffset, maxOffset, t);
    } else {
      // Default range for larger widths
      const minOffset = 85;
      const maxOffset = 160;
      const t = clamp01((width - 1350) / (portraitMaxViewport.width - 1350));
      offset = lerp(minOffset, maxOffset, t);
    }
  } else {
    // Landscape mode: Use normalized width
    offset = cubicBezier(landscapeNormalizedWidth, landscapeMinOffset, 80, 150, landscapeMaxOffset);
  }

  return offset;
}
