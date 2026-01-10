// src/canvas-engine/EngineHost.tsx
// View CanvasEntry to see how a canvas is imported via EngineHost API

import React from "react";
import { useCanvasEngine } from "./hooks/useCanvasEngine.ts";
import { useViewportKey } from "./hooks/useViewportKey.ts";
import { useSceneField } from "./hooks/useSceneField.ts";
import { stopCanvasEngine } from "./runtime/index.ts";

import { HOST_DEFS, type HostId, type HostDef } from "./multi-canvas-setup/hostDefs.ts";

export function EngineHost({
  id,
  open = true,
  visible = true,
  liveAvg = 0.5,
  allocAvg = 0.5,
  questionnaireOpen = false,
}: {
  id: HostId;
  open?: boolean;
  visible?: boolean;
  liveAvg?: number;
  allocAvg?: number;
  questionnaireOpen?: boolean;
}) {
  const hostDef = React.useMemo(() => {
    const def = HOST_DEFS[id];
    if (!def) throw new Error(`Unknown hostId "${id}"`);
    return def as HostDef; 
  }, [id]);

  const stopOnOpenMounts = React.useMemo(() => {
    const ids = hostDef.stopOnOpen ?? [];
    return ids.map((otherId) => HOST_DEFS[otherId].mount);
  }, [hostDef]);



  React.useEffect(() => {
    if (!open) return;
    for (const mount of stopOnOpenMounts) {
      try {
        stopCanvasEngine(mount);
      } catch {}
    }
  }, [open, stopOnOpenMounts]);

  const engine = useCanvasEngine({
    visible: open && visible,
    dprMode: hostDef.dprMode,
    mount: hostDef.mount,
    zIndex: hostDef.zIndex,
  });

  const viewportKey = useViewportKey(120);

  // useSceneField should read baseMode from HOST_DEFS itself.
  useSceneField(engine, id, allocAvg, { questionnaireOpen }, viewportKey);

  React.useEffect(() => {
    if (!engine.ready.current) return;
    engine.controls.current?.setInputs?.({ liveAvg });
  }, [engine, liveAvg]);

  return null;
}
