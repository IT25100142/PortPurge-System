import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Loader2, Search, Skull, X } from "lucide-react";
import type { PortInfo, ProcessDetails } from "../types";

interface ProcessDetailsModalProps {
  target: PortInfo | null;
  onClose: () => void;
  onRequestKill: (port: PortInfo) => void;
}

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "N/A";
}

function formatMemory(bytes: number | null): string {
  if (bytes === null) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className="text-slate-100 font-medium text-right break-all">{value}</span>
    </div>
  );
}

export function ProcessDetailsModal({ target, onClose, onRequestKill }: ProcessDetailsModalProps) {
  const [details, setDetails] = useState<ProcessDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetPid = target?.pid;

  useEffect(() => {
    if (targetPid === undefined) {
      setDetails(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      setDetails(null);

      try {
        const result = await invoke<ProcessDetails>("get_process_details", { pid: targetPid });
        if (!cancelled) {
          setDetails(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message = String(err);
          if (
            message.includes("Process not found") ||
            message.toLowerCase().includes("not found")
          ) {
            setError("This process has already exited.");
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [targetPid]);

  useEffect(() => {
    if (!target) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [target, isLoading, onClose]);

  if (!target) {
    return null;
  }

  const handleKill = () => {
    onRequestKill(target);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={isLoading ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg glass-panel bg-slate-900/95 p-6 shadow-2xl space-y-5 animate-slide-in relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspect-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 id="inspect-modal-title" className="text-lg font-bold text-white">
                Process Details
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {target.processName} · PID {target.pid} · Port {target.port} ({target.protocol})
              </p>
            </div>
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" aria-hidden />
            <p className="text-sm text-slate-400 font-medium">Fetching process details…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-200/90">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <p className="text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {!isLoading && !error && details && (
          <>
            {details.permissionsLimited && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-200/90">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  Some details are hidden due to OS permissions. Run PortPurge with elevated
                  privileges to view the executable path and command line.
                </p>
              </div>
            )}

            <div className="glass-control p-4 space-y-3 text-sm">
              <DetailRow label="Process" value={displayValue(details.processName)} />
              <DetailRow label="PID" value={String(details.pid)} />
              <DetailRow label="User" value={displayValue(details.user)} />
              <DetailRow label="Memory" value={formatMemory(details.memoryBytes)} />
              <DetailRow label="Started" value={displayValue(details.startedAt)} />
              <DetailRow label="Executable" value={displayValue(details.executablePath)} />
            </div>

            <div className="space-y-2">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Command Line
              </span>
              <div className="glass-control p-3 max-h-28 overflow-y-auto">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
                  {displayValue(details.commandLine)}
                </pre>
              </div>
              <p className="text-[10px] text-slate-500">
                Command lines may contain sensitive arguments.
              </p>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 rounded-lg"
          >
            Close
          </button>
          {!error && (
            <button
              type="button"
              onClick={handleKill}
              disabled={isLoading}
              className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl shadow-lg shadow-red-900/20 transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              <Skull className="w-3.5 h-3.5" />
              Kill Process
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
