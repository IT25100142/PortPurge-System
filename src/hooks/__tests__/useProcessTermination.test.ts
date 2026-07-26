// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProcessTermination } from "../useProcessTermination";
import type { PortGroup, PortInfo } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const initialPorts: PortInfo[] = [
  { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
  { pid: 200, port: 3000, protocol: "TCP", processName: "vite" },
  { pid: 300, port: 5353, protocol: "UDP", processName: "node.exe" },
];

function createGroup(overrides?: Partial<PortGroup>): PortGroup {
  const ports = overrides?.ports ?? [
    { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
    { pid: 300, port: 5353, protocol: "UDP", processName: "node.exe" },
  ];
  const uniquePids = overrides?.uniquePids ?? [...new Set(ports.map((p) => p.pid))];
  return {
    groupKey: "node.exe",
    processName: "node.exe",
    ports,
    portCount: ports.length,
    pidCount: uniquePids.length,
    uniquePids,
    ...overrides,
  };
}

describe("useProcessTermination hook", () => {
  const showToastMock = vi.fn();
  const fetchPortsMock = vi.fn();

  function useHarness(
    protectedNames: string[] = [],
    startingPorts: PortInfo[] = initialPorts,
  ) {
    const [ports, setPorts] = useState<PortInfo[]>(startingPorts);
    const termination = useProcessTermination(
      ports,
      setPorts,
      fetchPortsMock,
      showToastMock,
      protectedNames,
    );
    return { ports, setPorts, ...termination };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it("defaults killingPid to null and isKillingGroup to false", () => {
    const { result } = renderHook(() => useHarness());

    expect(result.current.killingPid).toBeNull();
    expect(result.current.isKillingGroup).toBe(false);
  });

  it("single success: optimistic removal, exact IPC args, default source ui, toast, cleanup", async () => {
    let resolveKill!: () => void;
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveKill = resolve;
        }),
    );

    const { result } = renderHook(() => useHarness());
    const target = initialPorts[0];

    let killPromise!: Promise<void>;
    act(() => {
      killPromise = result.current.killProcess(target);
    });

    expect(result.current.killingPid).toBe(100);
    expect(result.current.ports.every((p) => p.pid !== 100)).toBe(true);
    expect(invoke).toHaveBeenCalledWith("kill_process_by_pid", {
      pid: 100,
      port: 8080,
      protocol: "TCP",
      processName: "node.exe",
      source: "ui",
    });

    await act(async () => {
      resolveKill();
      await killPromise;
    });

    expect(showToastMock).toHaveBeenCalledWith(
      "Process 100 on Port 8080 terminated successfully.",
      "success",
    );
    expect(result.current.killingPid).toBeNull();
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
    expect(fetchPortsMock).toHaveBeenCalledWith();
  });

  it("passes an explicit supported source unchanged without substituting inspect", async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.killProcess(initialPorts[0], "tray");
    });

    expect(invoke).toHaveBeenCalledWith(
      "kill_process_by_pid",
      expect.objectContaining({ source: "tray" }),
    );
    expect(invoke).not.toHaveBeenCalledWith(
      "kill_process_by_pid",
      expect.objectContaining({ source: "inspect" }),
    );
  });

  it("single Access Denied failure restores snapshot and shows exact toast", async () => {
    const { result } = renderHook(() => useHarness());

    vi.mocked(invoke).mockRejectedValueOnce(new Error("Access Denied"));

    await act(async () => {
      await result.current.killProcess(initialPorts[0]);
    });

    expect(result.current.ports).toEqual(initialPorts);
    expect(showToastMock).toHaveBeenCalledWith(
      "Permission Denied: Run as administrator/sudo to terminate PID 100.",
      "error",
      { permissionDenied: true },
    );
    expect(result.current.killingPid).toBeNull();
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("single Smart Protect failure restores snapshot and shows exact toast", async () => {
    const { result } = renderHook(() => useHarness());

    vi.mocked(invoke).mockRejectedValueOnce(new Error("Protected process: node.exe"));

    await act(async () => {
      await result.current.killProcess(initialPorts[0]);
    });

    expect(result.current.ports).toEqual(initialPorts);
    expect(showToastMock).toHaveBeenCalledWith(
      "Smart Protect blocked termination of node.exe.",
      "warning",
    );
    expect(result.current.killingPid).toBeNull();
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("single generic failure restores snapshot and shows exact toast", async () => {
    const { result } = renderHook(() => useHarness());

    vi.mocked(invoke).mockRejectedValueOnce(new Error("boom"));

    await act(async () => {
      await result.current.killProcess(initialPorts[0]);
    });

    expect(result.current.ports).toEqual(initialPorts);
    expect(showToastMock).toHaveBeenCalledWith("Failed to terminate PID 100: Error: boom", "error");
    expect(result.current.killingPid).toBeNull();
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("group all success skips protected PIDs, invokes sequentially with source group", async () => {
    const protectedNames = ["svchost.exe"];
    const ports: PortInfo[] = [
      { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
      { pid: 400, port: 445, protocol: "TCP", processName: "svchost.exe" },
      { pid: 300, port: 5353, protocol: "UDP", processName: "node.exe" },
    ];
    const group = createGroup({
      ports: [
        { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
        { pid: 400, port: 445, protocol: "TCP", processName: "svchost.exe" },
        { pid: 300, port: 5353, protocol: "UDP", processName: "node.exe" },
      ],
      uniquePids: [100, 400, 300],
      processName: "mixed",
      groupKey: "mixed",
    });

    const { result } = renderHook(() => useHarness(protectedNames, ports));

    const seenPids: number[] = [];
    vi.mocked(invoke).mockImplementation(async (_cmd, args) => {
      seenPids.push((args as { pid: number }).pid);
    });

    await act(async () => {
      await result.current.killProcessGroup(group);
    });

    expect(seenPids).toEqual([100, 300]);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, "kill_process_by_pid", {
      pid: 100,
      port: 8080,
      protocol: "TCP",
      processName: "node.exe",
      source: "group",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "kill_process_by_pid", {
      pid: 300,
      port: 5353,
      protocol: "UDP",
      processName: "node.exe",
      source: "group",
    });
    expect(showToastMock).toHaveBeenCalledWith(
      "Terminated 2 processes (mixed); 1 skipped by Smart Protect.",
      "success",
    );
    expect(result.current.killingPid).toBeNull();
    expect(result.current.isKillingGroup).toBe(false);
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("group partial failure keeps optimistic removals and shows exact warning", async () => {
    const group = createGroup();
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.killProcessGroup(group);
    });

    expect(result.current.ports.every((p) => p.pid !== 100 && p.pid !== 300)).toBe(true);
    expect(result.current.ports).toEqual([
      { pid: 200, port: 3000, protocol: "TCP", processName: "vite" },
    ]);
    expect(showToastMock).toHaveBeenCalledWith(
      "Terminated 1 of 2 processes in node.exe. Failed: PID 300.",
      "warning",
    );
    expect(result.current.killingPid).toBeNull();
    expect(result.current.isKillingGroup).toBe(false);
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("group complete failure restores snapshot and shows exact error toast", async () => {
    const group = createGroup();
    vi.mocked(invoke).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.killProcessGroup(group);
    });

    expect(result.current.ports).toEqual(initialPorts);
    expect(showToastMock).toHaveBeenCalledWith(
      "Failed to terminate processes in node.exe.",
      "error",
    );
    expect(result.current.killingPid).toBeNull();
    expect(result.current.isKillingGroup).toBe(false);
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("all-protected group warns only with no invoke, mutation, flags, or fetchPorts", async () => {
    const group = createGroup({
      ports: [{ pid: 400, port: 445, protocol: "TCP", processName: "svchost.exe" }],
      uniquePids: [400],
      processName: "svchost.exe",
      groupKey: "svchost.exe",
      portCount: 1,
      pidCount: 1,
    });

    const { result } = renderHook(() => useHarness(["svchost.exe"]));

    await act(async () => {
      await result.current.killProcessGroup(group);
    });

    expect(showToastMock).toHaveBeenCalledWith(
      "Smart Protect: all processes in svchost.exe are protected.",
      "warning",
    );
    expect(invoke).not.toHaveBeenCalled();
    expect(result.current.ports).toEqual(initialPorts);
    expect(result.current.killingPid).toBeNull();
    expect(result.current.isKillingGroup).toBe(false);
    expect(fetchPortsMock).not.toHaveBeenCalled();
  });

  it("group sequential execution updates killingPid between deferred invokes", async () => {
    const group = createGroup();
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;

    vi.mocked(invoke)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result } = renderHook(() => useHarness());

    let groupPromise!: Promise<void>;
    act(() => {
      groupPromise = result.current.killProcessGroup(group);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isKillingGroup).toBe(true);
    expect(result.current.killingPid).toBe(100);

    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });
    expect(result.current.killingPid).toBe(300);

    await act(async () => {
      resolveSecond();
      await groupPromise;
    });
    expect(result.current.killingPid).toBeNull();
    expect(result.current.isKillingGroup).toBe(false);
  });

  it("exposes killing flags during single kill for polling pause derivation", async () => {
    let resolveKill!: () => void;
    vi.mocked(invoke).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveKill = resolve;
        }),
    );

    const { result } = renderHook(() => useHarness());

    let killPromise!: Promise<void>;
    act(() => {
      killPromise = result.current.killProcess(initialPorts[0]);
    });

    expect(result.current.killingPid !== null || result.current.isKillingGroup).toBe(true);

    await act(async () => {
      resolveKill();
      await killPromise;
    });

    expect(result.current.killingPid !== null || result.current.isKillingGroup).toBe(false);
  });
});
