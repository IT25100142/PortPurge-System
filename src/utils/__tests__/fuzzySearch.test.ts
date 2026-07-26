import { describe, it, expect } from "vitest";
import { portMatchesFuzzyQuery, filterPortsByFuzzyQuery } from "../fuzzySearch";
import type { PortInfo } from "../../types";

const mockPort1: PortInfo = {
  port: 3000,
  protocol: "TCP",
  pid: 1234,
  processName: "node.exe",
};

const mockPort2: PortInfo = {
  port: 5173,
  protocol: "UDP",
  pid: 5678,
  processName: "vite",
};

const mockPortUnknown: PortInfo = {
  port: 8080,
  protocol: "TCP",
  pid: 9999,
  processName: "",
};

describe("fuzzySearch utility", () => {
  describe("portMatchesFuzzyQuery", () => {
    it("returns true for empty or whitespace-only queries", () => {
      expect(portMatchesFuzzyQuery(mockPort1, "")).toBe(true);
      expect(portMatchesFuzzyQuery(mockPort1, "   ")).toBe(true);
    });

    it("matches single characters in process name, port, pid, or protocol", () => {
      expect(portMatchesFuzzyQuery(mockPort1, "n")).toBe(true);
      expect(portMatchesFuzzyQuery(mockPort1, "3")).toBe(true);
      expect(portMatchesFuzzyQuery(mockPort1, "t")).toBe(true);
    });

    it("matches full exact substrings case-insensitively", () => {
      expect(portMatchesFuzzyQuery(mockPort1, "NODE")).toBe(true);
      expect(portMatchesFuzzyQuery(mockPort1, "3000")).toBe(true);
      expect(portMatchesFuzzyQuery(mockPort1, "tcp")).toBe(true);
    });

    it("matches fuzzy ordered subsequences", () => {
      expect(portMatchesFuzzyQuery(mockPort1, "nde")).toBe(true); // n-d-e in node.exe
      expect(portMatchesFuzzyQuery(mockPort1, "n30")).toBe(true); // n in node, 30 in 3000
    });

    it("ignores spaces inside query", () => {
      expect(portMatchesFuzzyQuery(mockPort1, "no de")).toBe(true);
    });

    it("handles empty/blank processName gracefully by falling back to Unknown", () => {
      expect(portMatchesFuzzyQuery(mockPortUnknown, "Unknown")).toBe(true);
      expect(portMatchesFuzzyQuery(mockPortUnknown, "8080")).toBe(true);
    });

    it("returns false when query does not match haystack", () => {
      expect(portMatchesFuzzyQuery(mockPort1, "xyz")).toBe(false);
      expect(portMatchesFuzzyQuery(mockPort1, "9999")).toBe(false);
    });
  });

  describe("filterPortsByFuzzyQuery", () => {
    const ports = [mockPort1, mockPort2, mockPortUnknown];

    it("returns all ports when query is empty", () => {
      const result = filterPortsByFuzzyQuery(ports, "");
      expect(result).toHaveLength(3);
    });

    it("filters correctly by port number query", () => {
      const result = filterPortsByFuzzyQuery(ports, "5173");
      expect(result).toEqual([mockPort2]);
    });

    it("filters correctly by process name query", () => {
      const result = filterPortsByFuzzyQuery(ports, "node");
      expect(result).toEqual([mockPort1]);
    });

    it("returns empty array if no ports match", () => {
      const result = filterPortsByFuzzyQuery(ports, "nonexistent");
      expect(result).toEqual([]);
    });
  });
});
