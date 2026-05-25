import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  Activity, 
  RotateCw, 
  Search, 
  Skull, 
  AlertCircle, 
  CheckCircle2, 
  Terminal, 
  Hash, 
  WifiOff, 
  X,
  ShieldAlert,
  Server
} from "lucide-react";

interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  process_name: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

function App() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<"ALL" | "TCP" | "UDP">("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // States for inline action workflow
  const [confirmPid, setConfirmPid] = useState<number | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);

  // Keep a ref of toasts for timeout cleanup
  const toastTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const showToast = useCallback((message: string, type: "success" | "error" | "warning") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    const timeout = setTimeout(() => {
      removeToast(id);
    }, 4000);
    toastTimeoutRefs.current[id] = timeout;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (toastTimeoutRefs.current[id]) {
      clearTimeout(toastTimeoutRefs.current[id]);
      delete toastTimeoutRefs.current[id];
    }
  }, []);

  const fetchPorts = useCallback(async (showNotification = false) => {
    setIsRefreshing(true);
    try {
      const activePorts = await invoke<PortInfo[]>("get_active_ports");
      setPorts(activePorts);
      if (showNotification) {
        showToast(`Retrieved ${activePorts.length} active ports`, "success");
      }
    } catch (err) {
      showToast(String(err), "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  // Initial fetch
  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      // Don't poll while a kill operation is active to prevent layout flicker
      if (killingPid === null) {
        fetchPorts();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchPorts, killingPid]);

  const killProcess = async (pid: number, port: number) => {
    setConfirmPid(null);
    setKillingPid(pid);
    
    // Save original state for optimistic rollback if error occurs
    const previousPorts = [...ports];
    
    // Optimistic UI update: Remove the row immediately to feel incredibly snappy
    setPorts((prev) => prev.filter((p) => p.pid !== pid));

    try {
      await invoke("kill_process_by_pid", { pid });
      showToast(`Process ${pid} on Port ${port} terminated successfully.`, "success");
    } catch (err) {
      // Rollback optimistic update
      setPorts(previousPorts);
      
      const errMsg = String(err);
      if (errMsg.includes("Access Denied")) {
        showToast(`Permission Denied: Run as administrator/sudo to terminate PID ${pid}.`, "error");
      } else {
        showToast(`Failed to terminate PID ${pid}: ${errMsg}`, "error");
      }
    } finally {
      setKillingPid(null);
      // Re-fetch to ensure the system is in sync
      fetchPorts();
    }
  };

  // Filtered port list
  const filteredPorts = ports.filter((p) => {
    const matchesSearch = 
      p.process_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.port.toString().includes(searchQuery) ||
      p.pid.toString().includes(searchQuery);
    
    const matchesProtocol = 
      protocolFilter === "ALL" || 
      p.protocol.toUpperCase() === protocolFilter;
    
    return matchesSearch && matchesProtocol;
  });

  // Calculate metrics
  const tcpCount = ports.filter((p) => p.protocol.toUpperCase() === "TCP").length;
  const udpCount = ports.filter((p) => p.protocol.toUpperCase() === "UDP").length;

  return (
    <div className="min-h-screen bg-[#070b14] text-[#eceff4] font-sans antialiased overflow-x-hidden p-6 select-none relative">
      {/* Background gradients for stunning aesthetics */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl bg-slate-900/45 border border-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Skull className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                PortPurge
              </h1>
              <p className="text-xs text-slate-400 font-medium">Localhost Port Management & Process Purger</p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-4">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
              <span className="text-xs text-slate-400 font-semibold">Auto-Refresh (3s)</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoRefresh ? "bg-indigo-600" : "bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoRefresh ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchPorts(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-950/60 border border-slate-800 text-slate-250 hover:bg-slate-900/60 hover:text-white transition duration-205 disabled:opacity-50 group cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition duration-300 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Metrics Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Active Sockets */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between group hover:border-slate-700/60 transition duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Active Sockets</span>
              <h2 className="text-3xl font-extrabold text-white">{ports.length}</h2>
            </div>
            <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/60 text-indigo-400 group-hover:scale-110 transition duration-300">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: TCP Listeners */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between group hover:border-slate-700/60 transition duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">TCP Listeners</span>
              <h2 className="text-3xl font-extrabold text-white">{tcpCount}</h2>
            </div>
            <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/60 text-violet-400 group-hover:scale-110 transition duration-300">
              <Server className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: UDP Binds */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between group hover:border-slate-700/60 transition duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">UDP Binds</span>
              <h2 className="text-3xl font-extrabold text-white">{udpCount}</h2>
            </div>
            <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/60 text-pink-400 group-hover:scale-110 transition duration-300">
              <Terminal className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Search and Filters Bar */}
        <section className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Port, PID, or Process Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none transition duration-200"
            />
          </div>

          {/* Protocol Filters */}
          <div className="flex gap-1.5 p-1 bg-slate-950/40 border border-slate-800/60 rounded-xl w-full sm:w-auto">
            {(["ALL", "TCP", "UDP"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setProtocolFilter(filter)}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider transition duration-200 cursor-pointer ${
                  protocolFilter === filter
                    ? "bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        {/* Port Table Container */}
        <main className="rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-950/30">
                  <th className="px-6 py-4">Protocol</th>
                  <th className="px-6 py-4">Port</th>
                  <th className="px-6 py-4">PID</th>
                  <th className="px-6 py-4">Process Name</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
                {filteredPorts.length > 0 ? (
                  filteredPorts.map((portInfo) => {
                    const isConfirming = confirmPid === portInfo.pid;
                    const isKilling = killingPid === portInfo.pid;

                    return (
                      <tr 
                        key={`${portInfo.port}-${portInfo.protocol}`}
                        className={`hover:bg-slate-900/30 transition duration-150 ${isKilling ? "opacity-40" : ""}`}
                      >
                        {/* Protocol badge */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase border ${
                            portInfo.protocol.toUpperCase() === "TCP"
                              ? "bg-violet-500/5 border-violet-500/20 text-violet-400"
                              : "bg-pink-500/5 border-pink-500/20 text-pink-400"
                          }`}>
                            {portInfo.protocol}
                          </span>
                        </td>

                        {/* Port Number */}
                        <td className="px-6 py-4 font-bold text-white font-mono flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{portInfo.port}</span>
                        </td>

                        {/* PID */}
                        <td className="px-6 py-4 font-semibold text-slate-300 font-mono">
                          {portInfo.pid}
                        </td>

                        {/* Process name */}
                        <td className="px-6 py-4 font-medium text-slate-100 flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-slate-500" />
                          <span>{portInfo.process_name}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {isConfirming ? (
                              <div className="flex items-center gap-1 bg-red-950/20 border border-red-800/40 rounded-lg p-0.5 animate-pulse">
                                <button
                                  onClick={() => killProcess(portInfo.pid, portInfo.port)}
                                  className="px-3 py-1 text-xs font-extrabold bg-red-650 hover:bg-red-500 text-white rounded-md transition duration-150 flex items-center gap-1 cursor-pointer"
                                >
                                  <Skull className="w-3 h-3" />
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmPid(null)}
                                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800/60 transition duration-150 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmPid(portInfo.pid)}
                                className="px-3 py-1.5 text-xs font-bold bg-slate-950/60 border border-slate-800 text-slate-300 hover:bg-red-950/20 hover:border-red-900/40 hover:text-red-400 rounded-lg transition duration-200 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Skull className="w-3.5 h-3.5 text-slate-500 hover:text-inherit" />
                                <span>Kill</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <WifiOff className="w-8 h-8 text-slate-600 animate-bounce" />
                        <span>No active connections found matching criteria.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xl backdrop-blur-xl pointer-events-auto animate-slide-in transition duration-300 ${
              toast.type === "success"
                ? "bg-[#0b1c14]/90 border-green-800/50 text-green-300"
                : toast.type === "error"
                ? "bg-[#250d0d]/90 border-red-800/50 text-red-300"
                : "bg-[#1f150b]/90 border-[#855223]/50 text-amber-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
            ) : toast.type === "error" ? (
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
            )}
            
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
