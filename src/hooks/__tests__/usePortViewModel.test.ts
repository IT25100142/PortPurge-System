// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePortViewModel } from "../usePortViewModel";
import type { PortInfo } from "../../types";

const mockPorts: PortInfo[] = [
  { pid: 100, port: 8080, protocol: "TCP", processName: "node.exe" },
  { pid: 200, port: 3000, protocol: "TCP", processName: "vite" },
  { pid: 300, port: 5353, protocol: "UDP", processName: "node.exe" },
  { pid: 400, port: 8081, protocol: "UDP", processName: "python.exe" },
];

describe("usePortViewModel hook", () => {
  it("initializes with default control state and computes initial metrics", () => {
    const { result } = renderHook(() => usePortViewModel(mockPorts));

    expect(result.current.searchQuery).toBe("");
    expect(result.current.protocolFilter).toBe("ALL");
    expect(result.current.groupByProcess).toBe(false);
    expect(result.current.filteredPorts).toHaveLength(4);
    expect(result.current.displayGroups).toBeNull();
    expect(result.current.tcpCount).toBe(2);
    expect(result.current.udpCount).toBe(2);
  });

  it("filters ports using fuzzy search query", () => {
    const { result } = renderHook(() => usePortViewModel(mockPorts));

    act(() => {
      result.current.setSearchQuery("3000");
    });

    expect(result.current.filteredPorts).toHaveLength(1);
    expect(result.current.filteredPorts[0].port).toBe(3000);
  });

  it("filters ports by protocol", () => {
    const { result } = renderHook(() => usePortViewModel(mockPorts));

    act(() => {
      result.current.setProtocolFilter("UDP");
    });

    expect(result.current.filteredPorts).toHaveLength(2);
    expect(result.current.filteredPorts.every((p) => p.protocol === "UDP")).toBe(true);
  });

  it("groups filtered ports by process name when groupByProcess is true", () => {
    const { result } = renderHook(() => usePortViewModel(mockPorts));

    act(() => {
      result.current.setGroupByProcess(true);
    });

    expect(result.current.displayGroups).not.toBeNull();
    expect(result.current.displayGroups!).toHaveLength(3); // node.exe, vite, python.exe

    const nodeGroup = result.current.displayGroups!.find((g) => g.processName === "node.exe");
    expect(nodeGroup).toBeDefined();
    expect(nodeGroup!.ports).toHaveLength(2); // 8080 (TCP) and 5353 (UDP)
  });

  it("toggles groupByProcess using toggleGroupByProcess helper", () => {
    const { result } = renderHook(() => usePortViewModel(mockPorts));

    expect(result.current.groupByProcess).toBe(false);

    act(() => {
      result.current.toggleGroupByProcess();
    });

    expect(result.current.groupByProcess).toBe(true);
    expect(result.current.displayGroups).not.toBeNull();

    act(() => {
      result.current.toggleGroupByProcess();
    });

    expect(result.current.groupByProcess).toBe(false);
    expect(result.current.displayGroups).toBeNull();
  });

  it("resets searchQuery and protocolFilter on clearFilters", () => {
    const { result } = renderHook(() => usePortViewModel(mockPorts));

    act(() => {
      result.current.setSearchQuery("node");
      result.current.setProtocolFilter("TCP");
    });

    expect(result.current.searchQuery).toBe("node");
    expect(result.current.protocolFilter).toBe("TCP");

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.protocolFilter).toBe("ALL");
  });

  it("recomputes filtered ports and metrics when ports prop changes", () => {
    let currentPorts = mockPorts;
    const { result, rerender } = renderHook(() => usePortViewModel(currentPorts));

    expect(result.current.tcpCount).toBe(2);
    expect(result.current.udpCount).toBe(2);

    currentPorts = [
      ...mockPorts,
      { pid: 500, port: 9000, protocol: "TCP", processName: "java.exe" },
    ];
    rerender();

    expect(result.current.filteredPorts).toHaveLength(5);
    expect(result.current.tcpCount).toBe(3);
    expect(result.current.udpCount).toBe(2);
  });
});
