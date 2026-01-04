// canvas-engine/CanvasEntry.tsx
import { EngineHost } from "./EngineHost.tsx";

export default function CanvasEntry({ visible=true, liveAvg=0.5, allocAvg=0.5 }) {
  return <EngineHost id="intro" open={true} visible={visible} liveAvg={liveAvg} allocAvg={allocAvg} />;
}
