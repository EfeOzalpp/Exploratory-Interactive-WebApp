// ─────────────────────────────────────────────────────────────
// src/graph-runtime/dotgraph/event-handlers/index.ts
// DotGraph interaction / camera control system
// This file is the public surface of event-handlers.
// ─────────────────────────────────────────────────────────────

// Composition root (the orchestrator)
export { default as useOrbitController } from './useOrbitController.ts';

// Core interaction hooks (internal but reusable)
export { default as useZoom } from './hooks/useZoom.ts';
export { default as useRotation } from './hooks/useRotation.ts';
export { default as useActivity } from './hooks/useActivity.ts';
export { default as useIdleDrift } from './hooks/useIdleDrift.ts';
export { default as usePixelOffsets } from './hooks/usePixelOffsets.ts';

// Controllers
export { useEdgeCueController } from './controller/edgeCue.controller.ts';

// Pure computations
export { computeTooltipOffsetPx } from './compute/tooltipOffset.ts';
export { computeInitialZoomTarget } from './compute/zoomTarget.ts';

// Shared state helpers
export { createGestureState } from './shared/sharedGesture.ts';
