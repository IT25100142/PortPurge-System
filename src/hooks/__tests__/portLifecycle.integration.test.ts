// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePortScanner } from "../usePortScanner";
import { useProcessTermination } from "../useProcessTermination";
import { usePortPolling } from "../usePortPolling";
import type { PortGroup, PortInfo, Toast } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const scanPorts: PortInfo[] = [
  { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
  { pid: 200, port: 3000, protocol: "TCP", processName: "vite" },
];

const EMPTY_PROTECTED: string[] = [];
const SVCHOST_PROTECTED: string[] = ["svchost.exe"];

type ShowToast = (
  message: string,
  type: Toast["type"],
  options?: { permissionDenied?: boolean },
) => void;

function countActivePortInvokes(): number {
  return vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command === "get_active_ports").length;
}

/** Faithful App-level composition: scanner → termination → derived pause → polling. */
function useAppPortLifecycle(protectedNames: string[] = EMPTY_PROTECTED) {
  const [showToast] = useState<ShowToast>(() => vi.fn());
  const scanner = usePortScanner(showToast);
  const termination = useProcessTermination(
    scanner.ports,
    scanner.setPorts,
    scanner.fetchPorts,
    showToast,
    protectedNames,
  );
  usePortPolling(
    scanner.fetchPorts,
    scanner.autoRefresh,
    termination.killingPid !== null || termination.isKillingGroup,
  );
  return { scanner, termination, showToast };
}

describe("port scanner + termination + polling composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_active_ports") {
        return scanPorts;
      }
      return undefined;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauses interval polling for the full unresolved single kill and resumes after cleanup", async () => {
    let resolveKill!: () => void;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_active_ports") {
        return scanPorts;
      }
      if (command === "kill_process_by_pid") {
        return new Promise<void>((resolve) => {
          resolveKill = resolve;
        });
      }
      return undefined;
    });

    const { result } = renderHook(() => useAppPortLifecycle());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.scanner.autoRefresh).toBe(true);
    const mountScanCount = countActivePortInvokes();
    expect(mountScanCount).toBeGreaterThanOrEqual(1);

    vi.mocked(invoke).mockClear();

    let killPromise!: Promise<void>;
    act(() => {
      killPromise = result.current.termination.killProcess(scanPorts[0]);
    });
    expect(result.current.termination.killingPid).toBe(100);

    await act(async () => {
      vi.advanceTimersByTime(9000);
      await Promise.resolve();
    });
    expect(countActivePortInvokes()).toBe(0);

    await act(async () => {
      resolveKill();
      await killPromise;
    });
    expect(result.current.termination.killingPid).toBeNull();
    expect(result.current.termination.isKillingGroup).toBe(false);

    // Termination cleanup calls fetchPorts once (explicit, not interval).
    expect(countActivePortInvokes()).toBe(1);
    vi.mocked(invoke).mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(countActivePortInvokes()).toBe(1);
  });

  it("keeps polling paused across grouped PID transitions while isKillingGroup is true", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    let killCall = 0;

    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_active_ports") {
        return scanPorts;
      }
      if (command === "kill_process_by_pid") {
        killCall += 1;
        if (killCall === 1) {
          return new Promise<void>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return new Promise<void>((resolve) => {
          resolveSecond = resolve;
        });
      }
      return undefined;
    });

    const group: PortGroup = {
      groupKey: "node.exe",
      processName: "node.exe",
      ports: [
        { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
        { pid: 300, port: 5353, protocol: "UDP", processName: "node.exe" },
      ],
      portCount: 2,
      pidCount: 2,
      uniquePids: [100, 300],
    };

    const { result } = renderHook(() => useAppPortLifecycle());

    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(invoke).mockClear();

    let groupPromise!: Promise<void>;
    act(() => {
      groupPromise = result.current.termination.killProcessGroup(group);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.termination.isKillingGroup).toBe(true);
    expect(result.current.termination.killingPid).toBe(100);

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    expect(countActivePortInvokes()).toBe(0);

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });
    expect(result.current.termination.isKillingGroup).toBe(true);
    expect(result.current.termination.killingPid).toBe(300);

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    expect(countActivePortInvokes()).toBe(0);

    await act(async () => {
      resolveSecond();
      await groupPromise;
    });
    expect(result.current.termination.killingPid).toBeNull();
    expect(result.current.termination.isKillingGroup).toBe(false);

    // Explicit post-group fetchPorts once.
    expect(countActivePortInvokes()).toBe(1);
    vi.mocked(invoke).mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(countActivePortInvokes()).toBe(1);
  });

  it("all-protected group does not pause polling or call kill IPC", async () => {
    const { result } = renderHook(() => useAppPortLifecycle(SVCHOST_PROTECTED));

    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(invoke).mockClear();

    const group: PortGroup = {
      groupKey: "svchost.exe",
      processName: "svchost.exe",
      ports: [{ pid: 400, port: 445, protocol: "TCP", processName: "svchost.exe" }],
      portCount: 1,
      pidCount: 1,
      uniquePids: [400],
    };

    await act(async () => {
      await result.current.termination.killProcessGroup(group);
    });

    expect(result.current.termination.killingPid).toBeNull();
    expect(result.current.termination.isKillingGroup).toBe(false);
    expect(
      vi.mocked(invoke).mock.calls.some(([command]) => command === "kill_process_by_pid"),
    ).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(countActivePortInvokes()).toBe(1);
  });
});
