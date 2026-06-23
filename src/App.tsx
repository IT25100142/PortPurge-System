import { useState, useEffect, useCallback, useRef } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { RotateCw } from "lucide-react";
import { PortTable } from "./components/PortTable";
import { ToastContainer } from "./components/ToastContainer";
import { UpdateModal } from "./components/UpdateModal";
import { KillConfirmModal } from "./components/KillConfirmModal";
import { ProcessDetailsModal } from "./components/ProcessDetailsModal";
import { MetricsBar } from "./components/MetricsBar";
import { SearchFilters } from "./components/SearchFilters";
import type { PortInfo, Toast } from "./types";

function formatLastRefreshed(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function App() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<"ALL" | "TCP" | "UDP">("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [killTarget, setKillTarget] = useState<PortInfo | null>(null);
  const [inspectTarget, setInspectTarget] = useState<PortInfo | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);

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
      if (killingPid === null) {
        fetchPorts();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchPorts, killingPid]);

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

  const killProcess = async (pid: number, port: number) => {
    setKillTarget(null);
    setKillingPid(pid);

    const previousPorts = [...ports];
    setPorts((prev) => prev.filter((p) => p.pid !== pid));

    try {
      await invoke("kill_process_by_pid", { pid });
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
      } else {
        showToast(`Failed to terminate PID ${pid}: ${errMsg}`, "error");
      }
    } finally {
      setKillingPid(null);
      fetchPorts();
    }
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

  const filteredPorts = ports.filter((p) => {
    const matchesSearch =
      p.processName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.port.toString().includes(searchQuery) ||
      p.pid.toString().includes(searchQuery);

    const matchesProtocol = protocolFilter === "ALL" || p.protocol.toUpperCase() === protocolFilter;

    return matchesSearch && matchesProtocol;
  });

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
          onSearchChange={setSearchQuery}
          onProtocolChange={setProtocolFilter}
        />

        <PortTable
          filteredPorts={filteredPorts}
          totalPortCount={ports.length}
          searchQuery={searchQuery}
          protocolFilter={protocolFilter}
          isRefreshing={isRefreshing}
          killingPid={killingPid}
          onRequestKill={setKillTarget}
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
            killProcess(killTarget.pid, killTarget.port);
          }
        }}
        onCancel={() => setKillTarget(null)}
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
    </div>
  );
}

export default App;
