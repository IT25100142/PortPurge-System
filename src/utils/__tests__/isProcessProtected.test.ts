import { describe, it, expect } from "vitest";
import { normalizeProcessName, isProcessProtected } from "../isProcessProtected";

describe("isProcessProtected utility", () => {
  describe("normalizeProcessName", () => {
    it("trims whitespace, lowercases, and strips trailing .exe", () => {
      expect(normalizeProcessName("  Node.EXE  ")).toBe("node");
      expect(normalizeProcessName("explorer.exe")).toBe("explorer");
      expect(normalizeProcessName("launchd")).toBe("launchd");
    });

    it("handles empty or whitespace strings", () => {
      expect(normalizeProcessName("")).toBe("");
      expect(normalizeProcessName("   ")).toBe("");
    });

    it("does not strip .exe if it is not at the end of the string", () => {
      expect(normalizeProcessName("executable.exe.bak")).toBe("executable.exe.bak");
    });
  });

  describe("isProcessProtected", () => {
    const denylist = ["svchost.exe", "explorer.exe", "launchd", "System"];

    it("returns true when process matches a denylist entry", () => {
      expect(isProcessProtected("svchost.exe", denylist)).toBe(true);
      expect(isProcessProtected("SVCHOST.EXE", denylist)).toBe(true);
      expect(isProcessProtected("svchost", denylist)).toBe(true); // input missing .exe matches denylist with .exe
      expect(isProcessProtected("explorer", denylist)).toBe(true);
      expect(isProcessProtected("launchd", denylist)).toBe(true);
      expect(isProcessProtected("system.exe", denylist)).toBe(true);
    });

    it("returns false for unprotected process names", () => {
      expect(isProcessProtected("node.exe", denylist)).toBe(false);
      expect(isProcessProtected("vite", denylist)).toBe(false);
      expect(isProcessProtected("chrome.exe", denylist)).toBe(false);
    });

    it("returns false for empty, blank, or Unknown process names", () => {
      expect(isProcessProtected("", denylist)).toBe(false);
      expect(isProcessProtected("   ", denylist)).toBe(false);
      expect(isProcessProtected("Unknown", denylist)).toBe(false);
      expect(isProcessProtected("unknown", denylist)).toBe(false);
    });

    it("handles empty denylist without error", () => {
      expect(isProcessProtected("svchost.exe", [])).toBe(false);
    });
  });
});
