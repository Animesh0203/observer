import React from "react";
import type { Activity } from '../AppContent';
import { DelModel } from '../../wailsjs/go/main/App';

type Props = {
    activities?: Activity[];
    onOpenLogs?: (activity?: Activity) => void;
    onClear?: () => void;
    className?: string;
};

/**
 * BottomBar
 *
 * A lightweight status bar meant to sit at the bottom of your app and show
 * background activity (like VS Code). Minimal styling and no external deps.
 *
 * Usage:
 * <BottomBar activities={activities} onOpenLogs={(a) => ...} onClear={() => ...} />
 */
export default function BottomBar({
  activities = [],
  onOpenLogs,
  onClear,
  className,
}: Readonly<Props>) {

  const running = activities.filter(a => a.status === "running");
  const queued = activities.filter(a => a.status === "idle");
  const last = activities.at(-1);

  // ⭐ NEW — logs
  const [logs, setLogs] = React.useState<string[]>([]);
  const [showLogs, setShowLogs] = React.useState(false);

  // ⭐ NEW — whenever activities change, append log
  React.useEffect(() => {
    if (!activities.length) return;

    const a = activities.at(-1);
    if (!a) return;

    const entry =
      `[${new Date().toLocaleTimeString()}] ` +
      `${a.status?.toUpperCase()}: ${a.label}` +
      (a.detail ? ` — ${a.detail}` : "");

    setLogs(prev => [...prev.slice(-9), entry]); // keep last 10 logs
  }, [activities]);

  const statusLabel = (() => {
    if (running.length) return `${running.length} running`;
    if (queued.length) return `${queued.length} queued`;
    if (last) {
      if (last.status === "success") return "Last task succeeded";
      if (last.status === "error") return "Last task failed";
      return last.label;
    }
    return "Idle";
  })();

  return (
    <output
      aria-live="polite"
      className={className}
      style={rootStyle}
    >
      {/* LEFT */} 
      <div style={leftStyle}>
        <span style={labelStyle}>{statusLabel}</span>

        {running[0] && (
          <span style={detailStyle}>
            {running[0].label}
            {running[0].detail ? ` — ${running[0].detail}` : ""}
          </span>
        )}

        {running[0] && typeof running[0].progress === "number" && (
          <div style={progressWrapper}>
            <div
              style={{
                ...progressBar,
                width: `${Math.max(0, Math.min(100, running[0].progress))}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* CENTER */}
      <div style={centerStyle}>
        {running.length > 0 ? (
          <Spinner small />
        ) : (
          <span style={timeStyle}>{formatSince(last?.startAt)}</span>
        )}
      </div>

      {/* RIGHT */}
      <div style={rightStyle}>
        <button style={btnStyle} onClick={() => DelModel()}>
          Unload Model
        </button>
        <button style={btnStyle} onClick={() => setShowLogs(!showLogs)}>
          Logs
        </button>
        <button style={btnStyle} onClick={() => onClear?.()}>
          Clear
        </button>
      </div>

      {/* ⭐ NEW — Logs Popup */}
      {showLogs && (
        <div style={logPopupStyle}>
          {logs.length === 0 ? (
            <div style={{ color: "#888" }}>No logs yet.</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} style={logLineStyle(line)}>
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </output>
  );
}
/* ---------- small helpers & styles ---------- */

function formatSince(startAt?: number) {
    if (!startAt) return "";
    const s = Math.floor((Date.now() - startAt) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
}

/* Inline styles so this file is self-contained */
const rootStyle: React.CSSProperties = {
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 8px",
  background: "#1e1e1e", // VS Code style
  color: "#cccccc",
  fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
  fontSize: 12,
  borderTop: "1px solid #333",
  boxSizing: "border-box",
};

const leftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  flex: 1,
};

const labelStyle: React.CSSProperties = {
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const detailStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
  color: "#aaa",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 200,
};

const progressWrapper: React.CSSProperties = {
  height: 3,
  width: 100,
  background: "rgba(255,255,255,0.15)",
  borderRadius: 2,
  overflow: "hidden",
};

const progressBar: React.CSSProperties = {
  height: "100%",
  background: "#0f9d58",
  transition: "width 150ms linear",
};

const centerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  width: 100,
  color: "#999",
};

const timeStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
};

const rightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #444",
  padding: "2px 6px",
  borderRadius: 3,
  color: "#ccc",
  cursor: "pointer",
  fontSize: 11,
  lineHeight: 1,
};

const logPopupStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "28px",
  right: "8px",
  width: "260px",
  background: "#1e1e1e",
  color: "#ccc",
  border: "1px solid #444",
  borderRadius: 4,
  padding: "8px",
  maxHeight: "200px",
  overflowY: "auto",
  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  zIndex: 9999,
  fontSize: 11,
};

const logLineStyle = (line: string): React.CSSProperties => ({
  padding: "2px 0",
  color: line.includes("ERROR")
    ? "#ff6b6b"
    : line.includes("SUCCESS") || line.includes("FINISH")
    ? "#7CFC7C"
    : "#8ab4f8",
  whiteSpace: "pre-wrap",
});


function Spinner({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? "12" : "14"}
      height={small ? "12" : "14"}
      viewBox="0 0 50 50"
      aria-hidden
      style={{ marginRight: 4 }}
    >
      <path
        fill="#999"
        d="M43.94 25.14c0-10.318..."
      >
        <animateTransform
          attributeType="xml"
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="0.7s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
