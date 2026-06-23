import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
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
import type { KillSource, LedgerEntry, PortGroup, PortInfo, Toast } from "./types";
import { filterPortsByFuzzyQuery } from "./utils/fuzzySearch";
import { groupByProcessName } from "./utils/groupPorts";

const MAX_LEDGER_ENTRIES = 100;

function formatLastRefreshed(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function App() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<"ALL" | "TCP" | "UDP">("ALL");
  const [groupByProcess, setGroupByProcess] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [killTarget, setKillTarget] = useState<PortInfo | null>(null);
  const [killGroupTarget, setKillGroupTarget] = useState<PortGroup | null>(null);
  const [inspectTarget, setInspectTarget] = useState<PortInfo | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [isKillingGroup, setIsKillingGroup] = useState(false);

  const closeInspectModal = useCallback(() => setInspectTarget(null), []);

  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    downloaded: number;
    total: number | null;
  }>({
    downloaded: 0,
    total: null,
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isClearingLedger, setIsClearingLedger] = useState(false);

  const toastTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (toastTimeoutRefs.current[id]) {
      clearTimeout(toastTimeoutRefs.current[id]);
      delete toastTimeoutRefs.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: Toast["type"], options?: { permissionDenied?: boolean }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [
        ...prev,
        { id, message, type, permissionDenied: options?.permissionDenied },
      ]);

      const timeout = setTimeout(() => {
        removeToast(id);
      }, 4000);
      toastTimeoutRefs.current[id] = timeout;
    },
    [removeToast],
  );

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

    getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => {});
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

  useEffect(() => {
    if (!isTauri()) return;

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update && update.available) {
          setUpdateAvailable(update);
          setShowUpdateModal(true);
          showToast(`New update v${update.version} is available!`, "warning");
        }
      } catch (err) {
        if (!import.meta.env.DEV) {
          console.error("Failed to check for updates:", err);
        }
      }
    };

    const timer = setTimeout(() => {
      checkForUpdates();
    }, 1500);

    return () => clearTimeout(timer);
  }, [showToast]);

  useEffect(() => {
    if (!isTauri()) return;

    invoke<LedgerEntry[]>("get_ledger_entries")
      .then((entries) => setLedgerEntries(entries))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listen<LedgerEntry>("ledger-updated", (event) => {
      setLedgerEntries((prev) => {
        const withoutDuplicate = prev.filter((entry) => entry.id !== event.payload.id);
        return [event.payload, ...withoutDuplicate].slice(0, MAX_LEDGER_ENTRIES);
      });
    }).then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const clearLedger = useCallback(async () => {
    setIsClearingLedger(true);
    try {
      await invoke("clear_ledger_entries");
      setLedgerEntries([]);
      showToast("Purge ledger cleared.", "success");
    } catch (err) {
      showToast(String(err), "error");
    } finally {
      setIsClearingLedger(false);
    }
  }, [showToast]);

  const killProcess = async (target: PortInfo, source: KillSource = "ui") => {
    setKillTarget(null);
    setKillingPid(target.pid);

    const previousPorts = [...ports];
    setPorts((prev) => prev.filter((p) => p.pid !== target.pid));

    try {
      await invoke("kill_process_by_pid", {
        pid: target.pid,
        port: target.port,
        protocol: target.protocol,
        processName: target.processName,
        source,
      });
      showToast(
        `Process ${target.pid} on Port ${target.port} terminated successfully.`,
        "success",
      );
    } catch (err) {
      setPorts(previousPorts);

      const errMsg = String(err);
      if (errMsg.includes("Access Denied")) {
        showToast(
          `Permission Denied: Run as administrator/sudo to terminate PID ${target.pid}.`,
          "error",
          { permissionDenied: true },
        );
      } else {
        showToast(`Failed to terminate PID ${target.pid}: ${errMsg}`, "error");
      }
    } finally {
      setKillingPid(null);
      fetchPorts();
    }
  };

  const killProcessGroup = async (group: PortGroup) => {
    setKillGroupTarget(null);
    setIsKillingGroup(true);

    const previousPorts = [...ports];
    const pids = [...group.uniquePids];
    const processLabel = group.processName?.trim() || "Unknown";

    setPorts((prev) => prev.filter((port) => !pids.includes(port.pid)));

    let successCount = 0;
    const failures: string[] = [];
    let permissionDenied = false;

    for (const pid of pids) {
      setKillingPid(pid);
      const portRow = group.ports.find((port) => port.pid === pid);
      try {
        await invoke("kill_process_by_pid", {
          pid,
          port: portRow?.port ?? null,
          protocol: portRow?.protocol ?? null,
          processName: portRow?.processName ?? processLabel,
          source: "group" satisfies KillSource,
        });
        successCount++;
      } catch (err) {
        const errMsg = String(err);
        failures.push(`PID ${pid}`);
        if (errMsg.includes("Access Denied")) {
          permissionDenied = true;
        }
      }
    }

    setKillingPid(null);
    setIsKillingGroup(false);

    if (successCount === pids.length) {
      showToast(
        `Terminated ${successCount} process${successCount === 1 ? "" : "es"} (${processLabel}).`,
        "success",
      );
    } else if (successCount === 0) {
      setPorts(previousPorts);
      if (permissionDenied) {
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
        `Terminated ${successCount} of ${pids.length} processes in ${processLabel}. Failed: ${failures.join(", ")}.`,
        "warning",
      );
    }

    fetchPorts();
  };

  const startUpdate = async () => {
    if (!updateAvailable) return;
    setIsDownloading(true);
    setDownloadProgress({ downloaded: 0, total: null });

    try {
      await updateAvailable.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setDownloadProgress({
              downloaded: 0,
              total: event.data.contentLength ?? null,
            });
            break;
          case "Progress":
            setDownloadProgress((prev) => ({
              downloaded: prev.downloaded + event.data.chunkLength,
              total: prev.total,
            }));
            break;
          case "Finished":
            break;
        }
      });

      showToast("Update installed successfully. Restarting...", "success");

      setTimeout(async () => {
        try {
          await relaunch();
        } catch (err) {
          showToast(`Failed to restart automatically: ${err}`, "error");
          setIsDownloading(false);
        }
      }, 1500);
    } catch (err) {
      showToast(`Update failed: ${err}`, "error");
      setIsDownloading(false);
    }
  };

  const filteredPorts = useMemo(() => {
    const searchFiltered = filterPortsByFuzzyQuery(ports, searchQuery);
    return searchFiltered.filter(
      (port) => protocolFilter === "ALL" || port.protocol.toUpperCase() === protocolFilter,
    );
  }, [ports, searchQuery, protocolFilter]);

  const displayGroups = useMemo((): PortGroup[] | null => {
    if (!groupByProcess) {
      return null;
    }
    return groupByProcessName(filteredPorts);
  }, [filteredPorts, groupByProcess]);

  const tcpCount = ports.filter((p) => p.protocol.toUpperCase() === "TCP").length;
  const udpCount = ports.filter((p) => p.protocol.toUpperCase() === "UDP").length;

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
                className="relative flex items-center gap-2 px-4 py-2 text-sm font-semibold glass-control text-slate-200 hover:bg-slate-900/60 hover:text-white transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                aria-label="Open purge history"
              >
                <History className="w-4 h-4 text-indigo-400" />
                <span>History</span>
                {ledgerEntries.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white tabular-nums">
                    {ledgerEntries.length > 99 ? "99+" : ledgerEntries.length}
                  </span>
                )}
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
          onSearchChange={setSearchQuery}
          onProtocolChange={setProtocolFilter}
          onToggleGroupByProcess={() => setGroupByProcess((prev) => !prev)}
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
          onRequestKill={setKillTarget}
          onRequestKillGroup={setKillGroupTarget}
          onRequestInspect={setInspectTarget}
          onClearFilters={() => {
            setSearchQuery("");
            setProtocolFilter("ALL");
          }}
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
          onDismiss={() => setShowUpdateModal(false)}
          onInstall={startUpdate}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <LedgerDrawer
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        entries={ledgerEntries}
        onClear={clearLedger}
        isClearing={isClearingLedger}
      />
    </div>
  );
}

export default App;
