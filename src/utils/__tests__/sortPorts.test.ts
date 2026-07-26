import { describe, it, expect } from "vitest";
import { comparePorts, sortFlatPorts, sortGroupedPorts } from "../sortPorts";
import type { PortGroup, PortInfo, TableSortConfig } from "../../types";

const portA: PortInfo = { port: 80, protocol: "TCP", pid: 500, processName: "apache" };
const portB: PortInfo = { port: 3000, protocol: "UDP", pid: 100, processName: "node" };
const portC: PortInfo = { port: 5173, protocol: "TCP", pid: 200, processName: "vite" };

describe("sortPorts utility", () => {
  describe("comparePorts & sortFlatPorts", () => {
    it("sorts by numeric port ascending and descending", () => {
      const ports = [portB, portA, portC];

      const ascConfig: TableSortConfig = { key: "port", direction: "asc", level: "child" };
      const sortedAsc = sortFlatPorts(ports, ascConfig);
      expect(sortedAsc.map((p) => p.port)).toEqual([80, 3000, 5173]);

      const descConfig: TableSortConfig = { key: "port", direction: "desc", level: "child" };
      const sortedDesc = sortFlatPorts(ports, descConfig);
      expect(sortedDesc.map((p) => p.port)).toEqual([5173, 3000, 80]);
    });

    it("sorts by numeric pid ascending and descending", () => {
      const ports = [portA, portB, portC];

      const ascConfig: TableSortConfig = { key: "pid", direction: "asc", level: "child" };
      const sortedAsc = sortFlatPorts(ports, ascConfig);
      expect(sortedAsc.map((p) => p.pid)).toEqual([100, 200, 500]);

      const descConfig: TableSortConfig = { key: "pid", direction: "desc", level: "child" };
      const sortedDesc = sortFlatPorts(ports, descConfig);
      expect(sortedDesc.map((p) => p.pid)).toEqual([500, 200, 100]);
    });

    it("sorts by string processName case-insensitively", () => {
      const ports = [
        { port: 1, protocol: "TCP", pid: 1, processName: "vite" },
        { port: 2, protocol: "TCP", pid: 2, processName: "Apache" },
        { port: 3, protocol: "TCP", pid: 3, processName: "node" },
      ];

      const config: TableSortConfig = { key: "processName", direction: "asc", level: "child" };
      const sorted = sortFlatPorts(ports, config);
      expect(sorted.map((p) => p.processName)).toEqual(["Apache", "node", "vite"]);
    });

    it("handles undefined or missing string fields without throwing", () => {
      const p1: PortInfo = { port: 1, protocol: "TCP", pid: 1, processName: "" };
      const p2: PortInfo = { port: 2, protocol: "TCP", pid: 2, processName: "a" };
      const config: TableSortConfig = { key: "processName", direction: "asc", level: "child" };

      expect(() => comparePorts(p1, p2, config)).not.toThrow();
    });
  });

  describe("sortGroupedPorts", () => {
    const group1: PortGroup = {
      groupKey: "node",
      processName: "node",
      ports: [portB],
      portCount: 1,
      pidCount: 1,
      uniquePids: [100],
    };

    const group2: PortGroup = {
      groupKey: "apache",
      processName: "apache",
      ports: [portA],
      portCount: 1,
      pidCount: 1,
      uniquePids: [500],
    };

    it("sorts group order when level === 'group'", () => {
      const groups = [group1, group2];
      const config: TableSortConfig = { key: "processName", direction: "asc", level: "group" };

      const sorted = sortGroupedPorts(groups, config);
      expect(sorted.map((g) => g.processName)).toEqual(["apache", "node"]);
    });

    it("sorts inner ports within each group when level === 'child'", () => {
      const multiPortGroup: PortGroup = {
        groupKey: "multi",
        processName: "multi",
        ports: [portC, portA],
        portCount: 2,
        pidCount: 2,
        uniquePids: [200, 500],
      };

      const config: TableSortConfig = { key: "port", direction: "asc", level: "child" };
      const sorted = sortGroupedPorts([multiPortGroup], config);

      expect(sorted[0].ports.map((p) => p.port)).toEqual([80, 5173]);
    });
  });
});
