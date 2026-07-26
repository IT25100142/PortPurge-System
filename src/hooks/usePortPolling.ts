import { useEffect } from "react";

type FetchPorts = (showNotification?: boolean) => void | Promise<void>;

const POLL_INTERVAL_MS = 3000;

export function usePortPolling(
  fetchPorts: FetchPorts,
  autoRefresh: boolean,
  pollingPaused: boolean,
) {
  useEffect(() => {
    if (!autoRefresh || pollingPaused) return;
    const timer = setInterval(() => {
      fetchPorts();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchPorts, pollingPaused]);
}
