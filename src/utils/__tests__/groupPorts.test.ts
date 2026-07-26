import { describe, it, expect } from "vitest";
import { groupByProcessName } from "../groupPorts";
import type { PortInfo } from "../../types";

describe("groupPorts utility", () => {
  it("returns an empty array when given an empty port list", () => {
    const result = groupByProcessName([]);
    expect(result).toEqual([]);
  });

  it("groups single port correctly", () => {
    const ports: PortInfo[] = [
      { port: 3000, protocol: "TCP", pid: 100, processName: "node.exe" },
    ];
    const groups = groupByProcessName(ports);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      groupKey: "node.exe",
      processName: "node.exe",
      ports,
      portCount: 1,
      pidCount: 1,
      uniquePids: [100],
    });
  });

  it("groups multiple ports sharing the same process name case-insensitively", () => {
    const ports: PortInfo[] = [
      { port: 3000, protocol: "TCP", pid: 100, processName: "node.exe" },
      { port: 3001, protocol: "TCP", pid: 100, processName: "NODE.EXE" },
      { port: 8080, protocol: "UDP", pid: 200, processName: "Node.exe" },
    ];

    const groups = groupByProcessName(ports);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupKey).toBe("node.exe");
    expect(groups[0].processName).toBe("node.exe"); // Preserves first seen display name
    expect(groups[0].portCount).toBe(3);
    expect(groups[0].pidCount).toBe(2);
    expect(groups[0].uniquePids).toEqual([100, 200]);
  });

  it("separates ports with different process names into distinct groups", () => {
    const ports: PortInfo[] = [
      { port: 3000, protocol: "TCP", pid: 100, processName: "node.exe" },
      { port: 5173, protocol: "TCP", pid: 101, processName: "vite" },
      { port: 8080, protocol: "TCP", pid: 102, processName: "node.exe" },
    ];

    const groups = groupByProcessName(ports);
    expect(groups).toHaveLength(2);

    const nodeGroup = groups.find((g) => g.groupKey === "node.exe");
    const viteGroup = groups.find((g) => g.groupKey === "vite");

    expect(nodeGroup?.portCount).toBe(2);
    expect(viteGroup?.portCount).toBe(1);
  });

  it("handles empty or whitespace process names by normalizing to Unknown", () => {
    const ports: PortInfo[] = [
      { port: 1234, protocol: "TCP", pid: 50, processName: "" },
      { port: 5678, protocol: "UDP", pid: 51, processName: "   " },
    ];

    const groups = groupByProcessName(ports);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupKey).toBe("unknown");
    expect(groups[0].processName).toBe("Unknown");
    expect(groups[0].portCount).toBe(2);
    expect(groups[0].pidCount).toBe(2);
    expect(groups[0].uniquePids).toEqual([50, 51]);
  });
});
