import { useEffect } from "react";
import { CheckCircle, History, ScrollText, Trash2, X, XCircle } from "lucide-react";
import type { LedgerEntry } from "../types";
import { formatKillSource, formatRelativeTime } from "../utils/formatLedger";

interface LedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LedgerEntry[];
  onClear: () => void;
  isClearing: boolean;
}

export function LedgerDrawer({
  isOpen,
  onClose,
  entries,
  onClear,
  isClearing,
}: LedgerDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
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
            <div className="p-2.5 btn-primary rounded-xl shadow-lg shadow-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ledger-drawer-title" className="text-lg font-bold text-white">
                History
              </h2>
              <p className="text-xs text-slate-400 font-medium">Purge Ledger — last 100 actions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            aria-label="Close history"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="p-4 rounded-2xl glass-control text-slate-500">
                <ScrollText className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No purge history yet</p>
              <p className="text-xs text-slate-500 max-w-[16rem]">
                Terminated processes from the dashboard or system tray will appear here.
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.id}
                className="glass-control p-4 space-y-3 animate-fade-in"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {entry.processName}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatRelativeTime(entry.timestamp)}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                      entry.success
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}
                  >
                    {entry.success ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {entry.success ? "Success" : "Failed"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="glass-panel-inset px-3 py-2">
                    <span className="text-label block mb-1">PID</span>
                    <span className="font-mono font-semibold text-slate-200">{entry.pid}</span>
                  </div>
                  <div className="glass-panel-inset px-3 py-2">
                    <span className="text-label block mb-1">Port</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {entry.port ?? "N/A"}
                    </span>
                  </div>
                  <div className="glass-panel-inset px-3 py-2">
                    <span className="text-label block mb-1">Source</span>
                    <span className="font-semibold text-indigo-300">
                      {formatKillSource(entry.source)}
                    </span>
                  </div>
                  <div className="glass-panel-inset px-3 py-2">
                    <span className="text-label block mb-1">Protocol</span>
                    <span className="font-semibold text-slate-200">
                      {entry.protocol ?? "—"}
                    </span>
                  </div>
                </div>

                {!entry.success && entry.errorMessage && (
                  <p className="text-[11px] leading-relaxed text-red-300/90 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                    {entry.errorMessage}
                  </p>
                )}
              </article>
            ))
          )}
        </div>

        <footer className="p-4 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={onClear}
            disabled={isClearing || entries.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold glass-control text-slate-300 hover:text-white hover:bg-slate-900/60 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isClearing ? "Clearing..." : "Clear History"}
          </button>
        </footer>
      </aside>
    </>
  );
}
