// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { usePortScanner } from "../usePortScanner";
import type { PortInfo } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockPorts: PortInfo[] = [
  { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
  { pid: 200, port: 3000, protocol: "UDP", processName: "vite" },
];

describe("usePortScanner hook", () => {
  const showToastMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(invoke).mockResolvedValue(mockPorts);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with empty ports, autoRefresh enabled, and null timestamp before load settles", () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => usePortScanner(showToastMock));

    expect(result.current.ports).toEqual([]);
    expect(result.current.autoRefresh).toBe(true);
    expect(result.current.lastRefreshedAt).toBeNull();
    // Mount fetch starts in the same effect cycle as the parent implementation.
    expect(result.current.isRefreshing).toBe(true);
  });

  it("invokes get_active_ports on mount and stores returned ports with a timestamp", async () => {
    const { result } = renderHook(() => usePortScanner(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith("get_active_ports");
    expect(result.current.ports).toEqual(mockPorts);
    expect(result.current.lastRefreshedAt).toBeInstanceOf(Date);
    expect(result.current.isRefreshing).toBe(false);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("fetchPorts(true) shows the exact success notification", async () => {
    const { result } = renderHook(() => usePortScanner(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });
    showToastMock.mockClear();

    await act(async () => {
      await result.current.fetchPorts(true);
    });

    expect(showToastMock).toHaveBeenCalledWith(
      `Retrieved ${mockPorts.length} active ports`,
      "success",
    );
  });

  it("failed invoke shows the exact error notification and leaves previous ports and timestamp intact", async () => {
    const { result } = renderHook(() => usePortScanner(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.ports).toEqual(mockPorts);
    expect(result.current.lastRefreshedAt).toBeInstanceOf(Date);
    const establishedTimestamp = result.current.lastRefreshedAt;
    showToastMock.mockClear();

    const failure = new Error("scan failed");
    vi.mocked(invoke).mockRejectedValueOnce(failure);

    await act(async () => {
      await result.current.fetchPorts();
    });

    expect(showToastMock).toHaveBeenCalledWith(String(failure), "error");
    expect(result.current.ports).toEqual(mockPorts);
    expect(result.current.lastRefreshedAt).toBe(establishedTimestamp);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("setPorts supports functional updates used by kill optimistic flows", async () => {
    const { result } = renderHook(() => usePortScanner(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setPorts((prev) => prev.filter((p) => p.pid !== 100));
    });

    expect(result.current.ports).toEqual([
      { pid: 200, port: 3000, protocol: "UDP", processName: "vite" },
    ]);
  });

  it("preserves overlapping-request last-completion-wins behaviour", async () => {
    let resolveFirst!: (value: PortInfo[]) => void;
    let resolveSecond!: (value: PortInfo[]) => void;

    const firstPorts: PortInfo[] = [
      { pid: 1, port: 1111, protocol: "TCP", processName: "first" },
    ];
    const secondPorts: PortInfo[] = [
      { pid: 2, port: 2222, protocol: "TCP", processName: "second" },
    ];

    vi.mocked(invoke)
      .mockImplementationOnce(
        () =>
          new Promise<PortInfo[]>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<PortInfo[]>((resolve) => {
            resolveSecond = resolve;
          }),
      )
      .mockResolvedValue(mockPorts);

    const { result } = renderHook(() => usePortScanner(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });

    let secondFetch!: Promise<void>;
    act(() => {
      secondFetch = result.current.fetchPorts();
    });

    await act(async () => {
      resolveSecond(secondPorts);
      await secondFetch;
    });
    expect(result.current.ports).toEqual(secondPorts);

    await act(async () => {
      resolveFirst(firstPorts);
      await Promise.resolve();
    });
    expect(result.current.ports).toEqual(firstPorts);
  });

  it("clears isRefreshing in finally after both success and failure", async () => {
    const { result } = renderHook(() => usePortScanner(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.fetchPorts();
    });
    expect(result.current.isRefreshing).toBe(false);

    vi.mocked(invoke).mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      await result.current.fetchPorts();
    });
    expect(result.current.isRefreshing).toBe(false);
  });
});
