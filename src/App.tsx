import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
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
import type { KillSource, PortGroup, PortInfo } from "./types";
import { isProcessProtected } from "./utils/isProcessProtected";
import { useToasts } from "./hooks/useToasts";
import { usePurgeLedger } from "./hooks/usePurgeLedger";
import { useSmartProtect } from "./hooks/useSmartProtect";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { usePortViewModel } from "./hooks/usePortViewModel";

function formatLastRefreshed(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function App() {
  const { toasts, showToast, removeToast } = useToasts();

  const [ports, setPorts] = useState<PortInfo[]>([]);
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

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const [killTarget, setKillTarget] = useState<PortInfo | null>(null);
  const [killGroupTarget, setKillGroupTarget] = useState<PortGroup | null>(null);
  const [inspectTarget, setInspectTarget] = useState<PortInfo | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [isKillingGroup, setIsKillingGroup] = useState(false);

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
  const { protectedProcessNames } = useSmartProtect();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchPorts = useCallback(
    async (showNotification = false) => {
      setIsRefreshing(true);
      try {
        const activePorts = await invoke<PortInfo[]>("get_active_ports");
        setPorts(activePorts);
        setLastRefreshedAt(new Date());
        if (showNotification) {
          showToast(`Retrieved ${activePorts.length} active ports`, "success");
        }
      } catch (err) {
        showToast(String(err), "error");
      } finally {
        setIsRefreshing(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

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

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      if (killingPid === null && !isKillingGroup) {
        fetchPorts();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchPorts, killingPid, isKillingGroup]);

  const killProcess = async (target: PortInfo, source: KillSource = "ui") => {
    const { pid, port } = target;
    setKillTarget(null);
    setKillingPid(pid);

    const previousPorts = [...ports];
    setPorts((prev) => prev.filter((p) => p.pid !== pid));

    try {
      await invoke("kill_process_by_pid", {
        pid: target.pid,
        port: target.port,
        protocol: target.protocol,
        processName: target.processName,
        source,
      });
      showToast(`Process ${pid} on Port ${port} terminated successfully.`, "success");
    } catch (err) {
      setPorts(previousPorts);

      const errMsg = String(err);
      if (errMsg.includes("Access Denied")) {
        showToast(
          `Permission Denied: Run as administrator/sudo to terminate PID ${pid}.`,
          "error",
          { permissionDenied: true },
        );
      } else if (errMsg.includes("Smart Protect") || errMsg.includes("Protected process")) {
        showToast(
          `Smart Protect blocked termination of ${target.processName?.trim() || "Unknown"}.`,
          "warning",
        );
      } else {
        showToast(`Failed to terminate PID ${pid}: ${errMsg}`, "error");
      }
    } finally {
      setKillingPid(null);
      fetchPorts();
    }
  };

  const killProcessGroup = async (group: PortGroup) => {
    setKillGroupTarget(null);

    const processLabel = group.processName?.trim() || "Unknown";
    const pids = [...group.uniquePids];
    const killablePids = pids.filter((pid) => {
      const portInfo = group.ports.find((p) => p.pid === pid) ?? group.ports[0];
      return !isProcessProtected(portInfo.processName, protectedProcessNames);
    });
    const skippedCount = pids.length - killablePids.length;

    if (killablePids.length === 0) {
      showToast(`Smart Protect: all processes in ${processLabel} are protected.`, "warning");
      return;
    }

    setIsKillingGroup(true);

    const previousPorts = [...ports];
    setPorts((prev) => prev.filter((port) => !killablePids.includes(port.pid)));

    let successCount = 0;
    const failures: string[] = [];
    let permissionDenied = false;
    let smartProtectBlocked = false;

    for (const pid of killablePids) {
      setKillingPid(pid);
      const portInfo = group.ports.find((p) => p.pid === pid) ?? group.ports[0];
      try {
        await invoke("kill_process_by_pid", {
          pid,
          port: portInfo.port,
          protocol: portInfo.protocol,
          processName: portInfo.processName,
          source: "group",
        });
        successCount++;
      } catch (err) {
        const errMsg = String(err);
        failures.push(`PID ${pid}`);
        if (errMsg.includes("Access Denied")) {
          permissionDenied = true;
        } else if (errMsg.includes("Smart Protect") || errMsg.includes("Protected process")) {
          smartProtectBlocked = true;
        }
      }
    }

    setKillingPid(null);
    setIsKillingGroup(false);

    const skipSuffix = skippedCount > 0 ? `; ${skippedCount} skipped by Smart Protect` : "";

    if (successCount === killablePids.length) {
      showToast(
        `Terminated ${successCount} process${successCount === 1 ? "" : "es"} (${processLabel})${skipSuffix}.`,
        "success",
      );
    } else if (successCount === 0) {
      setPorts(previousPorts);
      if (smartProtectBlocked) {
        showToast(`Smart Protect blocked termination of processes in ${processLabel}.`, "warning");
      } else if (permissionDenied) {
        showToast(
          `Permission Denied: Run as administrator/sudo to terminate processes in ${processLabel}.`,
          "error",
          { permissionDenied: true },
        );
      } else {
        showToast(`Failed to terminate processes in ${processLabel}.`, "error");
      }
    } else {
      showToast(
        `Terminated ${successCount} of ${killablePids.length} processes in ${processLabel}. Failed: ${failures.join(", ")}${skipSuffix}.`,
        "warning",
      );
    }

    fetchPorts();
  };

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
            killProcess(killTarget);
          }
        }}
        onCancel={() => setKillTarget(null)}
      />

      <KillGroupConfirmModal
        target={killGroupTarget}
        isKilling={isKillingGroup}
        onConfirm={() => {
          if (killGroupTarget) {
            killProcessGroup(killGroupTarget);
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
