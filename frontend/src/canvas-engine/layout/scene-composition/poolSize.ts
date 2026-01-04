// src/canvas/layout/scene-composition/poolSizing.ts
export type WidthBucket = 'sm' | 'md' | 'lg';

export const POOL_SIZES = {
  start: { sm: 18, md: 26, lg: 28 },
  questionnaire: { sm: 24, md: 32, lg: 28 },
  overlay: { sm: 60, md: 80, lg: 100 },
} as const;

export function widthBucket(width?: number): WidthBucket {
  if (width == null) return 'lg';
  if (width <= 768) return 'sm';
  if (width <= 1024) return 'md';
  return 'lg';
}

export function targetPoolSize(opts: {
  questionnaireOpen: boolean;
  overlay: boolean;
  width?: number;
}) {
  const bucket = widthBucket(opts.width);

  if (opts.overlay) return POOL_SIZES.overlay[bucket];
  if (opts.questionnaireOpen) return POOL_SIZES.questionnaire[bucket];
  return POOL_SIZES.start[bucket];
}

export function ensurePoolSize<T extends { id: number }>(
  pool: T[] | null | undefined,
  desired: number,
  makeItem: (id: number) => T
): T[] {
  if (desired <= 0) return [];

  if (!pool) {
    return Array.from({ length: desired }, (_, i) => makeItem(i + 1));
  }

  if (pool.length === desired) return pool;

  if (pool.length > desired) {
    return pool.slice(0, desired);
  }

  const maxId = pool.reduce((m, p) => Math.max(m, p.id), 0);
  const toAdd = desired - pool.length;
  const extra = Array.from({ length: toAdd }, (_, k) => makeItem(maxId + k + 1));
  return pool.concat(extra);
}
