import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { KillSource, PortGroup, PortInfo, Toast } from "../types";
import { isProcessProtected } from "../utils/isProcessProtected";

type ShowToast = (
  message: string,
  type: Toast["type"],
  options?: { permissionDenied?: boolean },
) => void;

type FetchPorts = (showNotification?: boolean) => void | Promise<void>;

export function useProcessTermination(
  ports: PortInfo[],
  setPorts: Dispatch<SetStateAction<PortInfo[]>>,
  fetchPorts: FetchPorts,
  showToast: ShowToast,
  protectedProcessNames: string[],
) {
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [isKillingGroup, setIsKillingGroup] = useState(false);

  const killProcess = useCallback(
    async (target: PortInfo, source: KillSource = "ui") => {
      const { pid, port } = target;
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
    },
    [ports, setPorts, fetchPorts, showToast],
  );

  const killProcessGroup = useCallback(
    async (group: PortGroup) => {
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
    },
    [ports, setPorts, fetchPorts, showToast, protectedProcessNames],
  );

  return {
    killProcess,
    killProcessGroup,
    killingPid,
    isKillingGroup,
  };
}
