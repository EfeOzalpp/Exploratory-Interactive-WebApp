// canvas-engine/EngineHost.tsx
import React from "react";
import { useCanvasEngine } from "./hooks/useCanvasEngine.ts";
import { useViewportKey } from "./hooks/useViewportKey.ts";
import { useSceneField } from "./hooks/useSceneField.ts";
import { stopCanvasEngine } from "./runtime/index.ts";
import type { HostId } from "./multi-canvas-setup/ids.ts";
import { resolveHost } from "./multi-canvas-setup/resolveHost.ts";

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
  const host = React.useMemo(() => resolveHost(id), [id]);

  React.useEffect(() => {
    if (!open) return;
    for (const mount of host.stopOnOpenMounts) {
      try { stopCanvasEngine(mount); } catch {}
    }
  }, [open, host.stopOnOpenMounts]);

  const engine = useCanvasEngine({
    visible: open && visible,
    dprMode: host.dprMode,
    mount: host.mount,
    zIndex: host.zIndex,
  });

  const viewportKey = useViewportKey(120);

  useSceneField(
    engine,
    host.id,
    allocAvg,
    { questionnaireOpen },
    viewportKey,
    { baseMode: host.sceneBaseMode, overlay: host.sceneBaseMode === "overlay" }
  );

  React.useEffect(() => {
    if (!engine.ready.current) return;
    engine.controls.current?.setInputs?.({ liveAvg });
  }, [engine, liveAvg]);

  return null;
}
