// canvas-engine/EngineHost.tsx
import React from "react";
import { useCanvasEngine } from "./hooks/useCanvasEngine.ts";
import { useViewportKey } from "./hooks/useViewportKey.ts";
import { useSceneField } from "./hooks/useSceneField.ts";
import { stopCanvasEngine } from "./runtime/index.ts";
import { HOST_PRESETS, type HostId } from "./multi-canvas-setup/hostPresets.ts";

export function EngineHost({
  id,
  open = true,
  visible = true,
  liveAvg = 0.5,
  allocAvg = 0.5,
}: {
  id: HostId;
  open?: boolean;     // whether this host is active (for overlay use-cases)
  visible?: boolean;  // engine visibility
  liveAvg?: number;
  allocAvg?: number;
}) {
  const preset = HOST_PRESETS[id];

  // stop other engines when this one opens
  React.useEffect(() => {
    if (!open) return;
    for (const m of preset.stopOnOpen ?? []) {
      try { stopCanvasEngine(m); } catch {}
    }
  }, [open, preset]);

  const engine = useCanvasEngine({
    visible: open && visible,
    dprMode: preset.dprMode,
    mount: preset.mount,
    zIndex: preset.zIndex,
  });

  const viewportKey = useViewportKey(120);

  // allocAvg drives items
  useSceneField(engine, allocAvg, viewportKey, preset.scene);

  // liveAvg drives rendering
  React.useEffect(() => {
    if (!engine?.ready?.current) return;
    engine.controls.current?.setInputs?.({ liveAvg });
  }, [engine, liveAvg]);

  return null;
}
