import { useEffect } from "react";
import { AlertTriangle, Skull, X } from "lucide-react";
import type { PortGroup } from "../types";

interface KillGroupConfirmModalProps {
  target: PortGroup | null;
  isKilling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function KillGroupConfirmModal({
  target,
  isKilling,
  onConfirm,
  onCancel,
}: KillGroupConfirmModalProps) {
  useEffect(() => {
    if (!target) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isKilling) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [target, isKilling, onCancel]);

  if (!target) {
    return null;
  }

  const processLabel = target.processName?.trim() || "Unknown";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={isKilling ? undefined : onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-lg glass-panel bg-slate-900/95 p-6 shadow-2xl space-y-5 animate-slide-in relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kill-group-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h3 id="kill-group-modal-title" className="text-lg font-bold text-white">
                Terminate All Processes?
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {target.pidCount} unique PID{target.pidCount === 1 ? "" : "s"} across{" "}
                {target.portCount} port{target.portCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          {!isKilling && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="glass-control p-4 space-y-2 text-sm max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Process
            </span>
            <span className="text-slate-100 font-medium truncate">{processLabel}</span>
          </div>
          {target.ports.map((port) => (
            <div
              key={`${port.port}-${port.protocol}-${port.pid}`}
              className="flex items-center justify-between gap-4 text-xs py-1"
            >
              <span className="text-slate-300 font-mono">
                :{port.port} · {port.protocol.toUpperCase()}
              </span>
              <span className="text-slate-400 font-mono">PID {port.pid}</span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-200/90">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs leading-relaxed">
            This will terminate{" "}
            <span className="font-semibold">{target.pidCount}</span> unique process
            {target.pidCount === 1 ? "" : "es"} named{" "}
            <span className="font-semibold">{processLabel}</span>. Protected processes may require
            administrator privileges.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isKilling}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isKilling}
            className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl shadow-lg shadow-red-900/20 transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <Skull className="w-3.5 h-3.5" />
            {isKilling ? "Terminating..." : `Kill All (${target.pidCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
