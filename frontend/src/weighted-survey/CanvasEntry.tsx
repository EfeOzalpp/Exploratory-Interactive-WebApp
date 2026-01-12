// canvas-engine/CanvasEntry.tsx

import { EngineHost } from "../canvas-engine/EngineHost.tsx";

export default function CanvasEntry({
  visible = true,
  liveAvg = 0.5,
  allocAvg = 0.5,
  questionnaireOpen = false,
}: {
  visible?: boolean;
  liveAvg?: number;
  allocAvg?: number;
  questionnaireOpen?: boolean;
}) {
  return (
    <div style={{ width: "70vw", height: "75vh", position: "relative", zIndex: 6 }}>
      <div id="canvas-root" style={{ width: "100%", height: "100%" }} />
      <EngineHost id="start" open visible={visible} liveAvg={liveAvg} allocAvg={allocAvg} questionnaireOpen={questionnaireOpen} />
    </div>
  );
}