import React from "react";

/**
 * Fullscreen transparent overlay that ignores all input.
 * Shows a tiny Debug HUD only when ?debug=1 or localStorage.gp.debug==='1'.
 */
const Decoy: React.FC = () => {
  const debugEnabled = isDebugEnabled();
  return (
    <div
      id="decoy-container"
      style={{
        position: "absolute",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        touchAction: "auto",
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {debugEnabled ? <DebugHUD /> : null}
    </div>
  );
};

export default Decoy;

/* ----------------- helpers ----------------- */

function isDebugEnabled(): boolean {
  const search =
    (typeof window !== "undefined" && window.location?.search) || "";
  const ls =
    (typeof window !== "undefined" && window.localStorage) || null;

  const urlHasDebug = /[?&](debug|eruda)(=1|=true)?\b/i.test(search);
  const persisted = ls?.getItem("gp.debug") === "1";
  return urlHasDebug || persisted;
}

/* ----------------- HUD (minimal) ----------------- */

function DebugHUD() {
  const [open, setOpen] = React.useState(true);
  const [fps, setFps] = React.useState(0);
  const [stats, setStats] = React.useState({
    tex: 0,
    part: 0,
    qPending: 0,
    qInflight: 0,
    qPaused: false as boolean | string,
  });

  // FPS (very small, rAF + interval)
  React.useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let rafId = 0;
    let iv: number | undefined;

    const raf = () => {
      frames++;
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    iv = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.max(0.0001, (now - last) / 1000);
      setFps(Math.round(frames / dt));
      frames = 0;
      last = now;

      const g: any = window as any;
      const q =
        typeof g.__GP_GET_QUEUE_COUNTS === "function"
          ? g.__GP_GET_QUEUE_COUNTS()
          : { pending: 0, inflight: 0, paused: false };
      setStats({
        tex: g.__GP_TEX_REGISTRY?.size ?? 0,
        part: g.__GP_PARTICLE_TEX?.size ?? 0,
        qPending: q.pending || 0,
        qInflight: q.inflight || 0,
        qPaused: q.paused ?? false,
      });
    }, 500);

    return () => {
      cancelAnimationFrame(rafId);
      if (iv) clearInterval(iv);
    };
  }, []);

  const panic = () => {
    const g: any = window as any;
    try { g.__GP_DISPOSE_TEX?.(); } catch {}
    try { g.__GP_RESET_QUEUE?.(); } catch {}
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 99999,
        pointerEvents: "auto",
        font: "12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        role="button"
        onClick={() => setOpen(v => !v)}
        style={{
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          padding: "6px 8px",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 6,
        }}
      >
        🐞 Debug {open ? "▾" : "▸"}
      </div>

      {open && (
        <div
          style={{
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "8px 10px",
            borderRadius: 8,
            minWidth: 200,
          }}
        >
          <Row label="FPS" value={String(fps)} />
          <Row label="TEX" value={String(stats.tex)} />
          <Row label="PART" value={String(stats.part)} />
          <Row
            label="QUEUE"
            value={`${stats.qPending}/${stats.qInflight}${stats.qPaused ? " (paused)" : ""}`}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <Btn onClick={panic} label="Dispose+Reset" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function Btn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      style={{
        appearance: "none",
        border: "1px solid rgba(255,255,255,0.35)",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        borderRadius: 6,
        padding: "4px 8px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
