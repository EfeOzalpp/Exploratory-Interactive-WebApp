// canvas-engine/hosts/hostPresets.ts
export type HostId = "intro" | "city";

export type HostPreset = {
  mount: string;
  zIndex: number;
  dprMode: "auto" | "cap2" | "cap1_5" | "fixed1";
  stopOnOpen?: string[];          // mounts to stop
  scene?: { overlay?: boolean };  // passes into useSceneField
};

export const HOST_PRESETS: Record<HostId, HostPreset> = {
  intro: {
    mount: "#canvas-root",
    zIndex: 2,
    dprMode: "auto",
  },
  city: {
    mount: "#city-canvas-root",
    zIndex: 60,
    dprMode: "auto",
    stopOnOpen: ["#canvas-root"],
    scene: { overlay: true },
  },
};
