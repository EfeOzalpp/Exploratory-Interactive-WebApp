// navigation/CityOverlay.tsx
import { EngineHost } from "../canvas-engine/EngineHost.tsx";

type CityOverlayProps = {
  open: boolean;
  liveAvg?: number;
  allocAvg?: number;
};

export default function CityOverlay({ open, liveAvg = 0.5, allocAvg }: CityOverlayProps) {
  return (
    <div
      id="city-overlay-root"
      className={`city-overlay ${open ? "open" : ""}`}
      aria-hidden={!open}
    >
      <div id="city-canvas-root" className="city-canvas-host" />

      <EngineHost id="city" open={open} liveAvg={liveAvg} allocAvg={allocAvg ?? liveAvg} />
    </div>
  );
}
