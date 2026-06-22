import { useEffect } from "react";
import { Activity, RotateCw } from "lucide-react";
import type { Update } from "@tauri-apps/plugin-updater";
import type { DownloadProgress } from "../types";

interface UpdateModalProps {
  update: Update;
  show: boolean;
  isDownloading: boolean;
  downloadProgress: DownloadProgress;
  onDismiss: () => void;
  onInstall: () => void;
}

export function UpdateModal({
  update,
  show,
  isDownloading,
  downloadProgress,
  onDismiss,
  onInstall,
}: UpdateModalProps) {
  useEffect(() => {
    if (!show || isDownloading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, isDownloading, onDismiss]);

  if (!show) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={isDownloading ? undefined : onDismiss}
      role="presentation"
    >
      <div
        className="w-full max-w-lg glass-panel bg-slate-900/90 p-6 shadow-2xl space-y-5 animate-slide-in relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 id="update-modal-title" className="text-lg font-bold text-white">
              Update Available
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              A new version of PortPurge is ready for install
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 glass-control font-mono text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-500 block font-sans font-semibold">Current Version</span>
            <span className="text-slate-300 font-bold">v0.1.0</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="space-y-0.5 text-right">
            <span className="text-indigo-400 block font-sans font-semibold">New Version</span>
            <span className="text-indigo-400 font-bold">v{update.version}</span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Release Notes
          </span>
          <div className="max-h-40 overflow-y-auto p-4 glass-panel-inset text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
            {update.body || "No release notes provided."}
          </div>
        </div>

        {isDownloading && (
          <div className="space-y-2 animate-slide-in">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400">Downloading update...</span>
              <span className="text-indigo-400 font-mono">
                {downloadProgress.total
                  ? `${Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%`
                  : `${(downloadProgress.downloaded / 1024 / 1024).toFixed(2)} MB`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-150"
                style={{
                  width: downloadProgress.total
                    ? `${(downloadProgress.downloaded / downloadProgress.total) * 100}%`
                    : "30%",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {!isDownloading && (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 rounded-lg"
              >
                Later
              </button>
              <button
                type="button"
                onClick={onInstall}
                className="px-5 py-2.5 text-xs font-bold btn-primary rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Install Update
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
