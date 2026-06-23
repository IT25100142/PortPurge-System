import { useEffect } from "react";
import { AlertTriangle, Skull, X } from "lucide-react";
import type { PortInfo } from "../types";

interface KillConfirmModalProps {
  target: PortInfo | null;
  isKilling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function KillConfirmModal({
  target,
  isKilling,
  onConfirm,
  onCancel,
}: KillConfirmModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={isKilling ? undefined : onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-md glass-panel bg-slate-900/95 p-6 shadow-2xl space-y-5 animate-slide-in relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kill-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h3 id="kill-modal-title" className="text-lg font-bold text-white">
                Terminate Process?
              </h3>
              <p className="text-xs text-slate-400 font-medium">This action cannot be undone</p>
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

        <div className="glass-control p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Process
            </span>
            <span className="text-slate-100 font-medium truncate">{target.processName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              PID
            </span>
            <span className="text-slate-200 font-mono font-semibold">{target.pid}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Port
            </span>
            <span className="text-slate-200 font-mono font-semibold">{target.port}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Protocol
            </span>
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                target.protocol.toUpperCase() === "TCP"
                  ? "bg-violet-500/5 border-violet-500/20 text-violet-400"
                  : "bg-pink-500/5 border-pink-500/20 text-pink-400"
              }`}
            >
              {target.protocol}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-200/90">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Terminating PID {target.pid} will immediately stop{" "}
            <span className="font-semibold">{target.processName}</span> and free port {target.port}.
            System or protected processes may require administrator privileges.
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
            {isKilling ? "Terminating..." : "Confirm Kill"}
          </button>
        </div>
      </div>
    </div>
  );
}
