// src/canvas-engine/grid-layout/resolveCanvasPadding.ts

import { deviceType } from '../shared/utils/responsiveness.ts';
import { CANVAS_PADDING } from '../shared/scene-schema/canvasPadding.ts';
import type { CanvasPaddingSpec } from '../shared/scene-schema/canvasPadding.ts';

export function resolveCanvasPaddingSpec(
  width: number,
  questionnaireOpen: boolean,
  opts?: { overlay?: boolean }
): CanvasPaddingSpec {
  const band = deviceType(width);
  if (opts?.overlay) return CANVAS_PADDING.overlay[band];
  return (questionnaireOpen ? CANVAS_PADDING.questionnaire : CANVAS_PADDING.start)[band];
}
