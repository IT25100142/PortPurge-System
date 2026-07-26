import { useState, useEffect, useCallback, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { History, RotateCw } from "lucide-react";
import { PortTable } from "./components/PortTable";
import { ToastContainer } from "./components/ToastContainer";
import { UpdateModal } from "./components/UpdateModal";
import { KillConfirmModal } from "./components/KillConfirmModal";
import { KillGroupConfirmModal } from "./components/KillGroupConfirmModal";
import { ProcessDetailsModal } from "./components/ProcessDetailsModal";
import { LedgerDrawer } from "./components/LedgerDrawer";
import { MetricsBar } from "./components/MetricsBar";
import { SearchFilters } from "./components/SearchFilters";
import type { PortGroup, PortInfo } from "./types";
import { useToasts } from "./hooks/useToasts";
import { usePurgeLedger } from "./hooks/usePurgeLedger";
import { useSmartProtect } from "./hooks/useSmartProtect";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { usePortViewModel } from "./hooks/usePortViewModel";
import { usePortScanner } from "./hooks/usePortScanner";
import { useProcessTermination } from "./hooks/useProcessTermination";

function formatLastRefreshed(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function App() {
  const { toasts, showToast, removeToast } = useToasts();

  const [killTarget, setKillTarget] = useState<PortInfo | null>(null);
  const [killGroupTarget, setKillGroupTarget] = useState<PortGroup | null>(null);
  const [inspectTarget, setInspectTarget] = useState<PortInfo | null>(null);
  const [pollingPaused, setPollingPaused] = useState(false);

  const {
    ports,
    setPorts,
    autoRefresh,
    setAutoRefresh,
    isRefreshing,
    lastRefreshedAt,
    fetchPorts,
  } = usePortScanner(showToast, pollingPaused);

  const { protectedProcessNames } = useSmartProtect();

  const { killProcess, killProcessGroup, killingPid, isKillingGroup } = useProcessTermination(
    ports,
    setPorts,
    fetchPorts,
    showToast,
    protectedProcessNames,
  );

  const nextPollingPaused = killingPid !== null || isKillingGroup;
  if (pollingPaused !== nextPollingPaused) {
    setPollingPaused(nextPollingPaused);
  }

  const {
    searchQuery,
    setSearchQuery,
    protocolFilter,
    setProtocolFilter,
    groupByProcess,
    toggleGroupByProcess,
    clearFilters,
    filteredPorts,
    displayGroups,
    tcpCount,
    udpCount,
  } = usePortViewModel(ports);

  const closeInspectModal = useCallback(() => setInspectTarget(null), []);

  const {
    appVersion,
    updateAvailable,
    showUpdateModal,
    dismissUpdateModal,
    isDownloading,
    downloadProgress,
    startUpdate,
  } = useAppUpdater(showToast);

  const { ledgerOpen, setLedgerOpen, ledgerEntries, clearLedger } = usePurgeLedger();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    const subscribe = async () => {
      unlisten = await listen("window-summoned", () => {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      });
    };

    subscribe();

    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-base text-text-primary font-sans antialiased overflow-x-hidden p-6 select-none relative">
      <div className="ambient-orb top-[-20%] left-[-20%] w-[60%] h-[60%] bg-violet-600/6" />
      <div className="ambient-orb bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-600/6" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        <header className="glass-panel flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 btn-primary rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center w-12 h-12">
              <img
                src="/illustrations/empty-ports.webp"
                alt=""
                width={28}
                height={28}
                className="illustration-blend w-7 h-7 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                  PortPurge
                </h1>
                {appVersion !== null && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800/80 text-slate-400 select-none">
                    v{appVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Localhost Port Management & Process Purger
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 px-3.5 py-2 glass-control">
              <span className="text-xs text-slate-400 font-semibold">Auto-Refresh (3s)</span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                  autoRefresh ? "bg-indigo-600" : "bg-slate-800"
                }`}
                aria-pressed={autoRefresh}
                aria-label="Toggle auto-refresh"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoRefresh ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="text-[11px] text-slate-500 font-medium tabular-nums min-w-[7.5rem] text-right"
                title="Last port scan completion time"
              >
                Updated {formatLastRefreshed(lastRefreshedAt)}
              </span>
              <button
                type="button"
                onClick={() => setLedgerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold glass-control text-slate-200 hover:bg-slate-900/60 hover:text-white transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                aria-label="Open purge history"
              >
                <History className="w-4 h-4 text-indigo-400" />
                <span>History</span>
              </button>
              <button
                type="button"
                onClick={() => fetchPorts(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold glass-control text-slate-200 hover:bg-slate-900/60 hover:text-white transition duration-200 disabled:opacity-50 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <RotateCw
                  className={`w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition duration-300 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <MetricsBar totalCount={ports.length} tcpCount={tcpCount} udpCount={udpCount} />

        <SearchFilters
          searchQuery={searchQuery}
          protocolFilter={protocolFilter}
          groupByProcess={groupByProcess}
          inputRef={searchInputRef}
          onSearchChange={setSearchQuery}
          onProtocolChange={setProtocolFilter}
          onToggleGroupByProcess={toggleGroupByProcess}
        />

        <PortTable
          filteredPorts={filteredPorts}
          displayGroups={displayGroups}
          groupByProcess={groupByProcess}
          totalPortCount={ports.length}
          searchQuery={searchQuery}
          protocolFilter={protocolFilter}
          isRefreshing={isRefreshing}
          killingPid={killingPid}
          protectedProcessNames={protectedProcessNames}
          onRequestKill={setKillTarget}
          onRequestKillGroup={setKillGroupTarget}
          onRequestInspect={setInspectTarget}
          onClearFilters={clearFilters}
        />
      </div>

      <KillConfirmModal
        target={killTarget}
        isKilling={killTarget !== null && killingPid === killTarget.pid}
        onConfirm={() => {
          if (killTarget) {
            const target = killTarget;
            setKillTarget(null);
            void killProcess(target);
          }
        }}
        onCancel={() => setKillTarget(null)}
      />

      <KillGroupConfirmModal
        target={killGroupTarget}
        isKilling={isKillingGroup}
        onConfirm={() => {
          if (killGroupTarget) {
            const group = killGroupTarget;
            setKillGroupTarget(null);
            void killProcessGroup(group);
          }
        }}
        onCancel={() => setKillGroupTarget(null)}
      />

      <ProcessDetailsModal
        target={inspectTarget}
        protectedProcessNames={protectedProcessNames}
        onClose={closeInspectModal}
        onRequestKill={setKillTarget}
      />

      {updateAvailable && (
        <UpdateModal
          update={updateAvailable}
          currentVersion={appVersion}
          show={showUpdateModal}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          onDismiss={dismissUpdateModal}
          onInstall={startUpdate}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <LedgerDrawer
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        entries={ledgerEntries}
        onCleared={clearLedger}
      />
    </div>
  );
}

export default App;
