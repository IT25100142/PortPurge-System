import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, History, Trash2, X, XCircle } from "lucide-react";
import type { LedgerEntry } from "../types";
import { formatKillSource, formatRelativeTime } from "../utils/formatLedger";

interface LedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LedgerEntry[];
  onCleared: () => void;
}

export function LedgerDrawer({ isOpen, onClose, entries, onCleared }: LedgerDrawerProps) {
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isClearing) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isClearing, onClose]);

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await invoke("clear_ledger_entries");
      onCleared();
    } catch {
      // Clear failures are non-blocking; drawer stays open.
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={isClearing ? undefined : onClose}
        role="presentation"
        aria-hidden={!isOpen}
      />

      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md glass-panel bg-slate-900/95 border-l border-slate-800/80 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-drawer-title"
        aria-hidden={!isOpen}
      >
        <header className="flex items-center justify-between gap-3 p-5 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 glass-control text-indigo-400 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ledger-drawer-title" className="text-lg font-bold text-white">
                History
              </h2>
              <p className="text-xs text-slate-400 font-medium">Purge audit trail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="p-2 text-slate-400 hover:text-white glass-control rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:opacity-50"
            aria-label="Close history"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-fade-in">
              <div className="p-3 glass-control rounded-2xl text-slate-500">
                <History className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-slate-300">No purge history yet</p>
                <p className="text-xs text-slate-500">
                  Terminated processes from the dashboard, tray, or group kill will appear here.
                </p>
              </div>
            </div>
          ) : (
            entries.map((entry) => (
              <article key={entry.id} className="glass-control p-4 space-y-2 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {entry.processName || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      PID {entry.pid}
                      {" · "}
                      Port {entry.port > 0 ? entry.port : "N/A"}
                      {" · "}
                      {entry.protocol}
                    </p>
                  </div>
                  {entry.success ? (
                    <CheckCircle
                      className="w-5 h-5 text-emerald-400 shrink-0"
                      aria-label="Success"
                    />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" aria-label="Failed" />
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 font-semibold">
                    {formatKillSource(entry.source)}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>

                {!entry.success && entry.errorMessage && (
                  <p className="text-xs text-red-400/90 leading-relaxed">{entry.errorMessage}</p>
                )}
              </article>
            ))
          )}
        </div>

        <footer className="p-4 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={isClearing || entries.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold glass-control text-slate-300 hover:text-white hover:bg-slate-900/60 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? "Clearing…" : "Clear History"}
          </button>
        </footer>
      </aside>
    </>
  );
}
