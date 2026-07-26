import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PortInfo, Toast } from "../types";

type ShowToast = (
  message: string,
  type: Toast["type"],
  options?: { permissionDenied?: boolean },
) => void;

export function usePortScanner(showToast: ShowToast, pollingPaused: boolean) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

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
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      if (!pollingPaused) {
        fetchPorts();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchPorts, pollingPaused]);

  return {
    ports,
    setPorts,
    autoRefresh,
    setAutoRefresh,
    isRefreshing,
    lastRefreshedAt,
    fetchPorts,
  };
}
