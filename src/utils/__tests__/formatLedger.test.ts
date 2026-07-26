import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime, formatKillSource } from "../formatLedger";

describe("formatLedger utility", () => {
  describe("formatRelativeTime", () => {
    const fixedNow = new Date("2026-07-26T12:00:00Z").getTime();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 'Just now' for timestamps less than 60 seconds ago", () => {
      const tenSecsAgo = new Date(fixedNow - 10 * 1000).toISOString();
      expect(formatRelativeTime(tenSecsAgo)).toBe("Just now");
    });

    it("returns 'Just now' for future timestamps (negative diff)", () => {
      const tenSecsFuture = new Date(fixedNow + 10 * 1000).toISOString();
      expect(formatRelativeTime(tenSecsFuture)).toBe("Just now");
    });

    it("formats minutes correctly (singular vs plural)", () => {
      const oneMinAgo = new Date(fixedNow - 60 * 1000).toISOString();
      expect(formatRelativeTime(oneMinAgo)).toBe("1 min ago");

      const fiveMinsAgo = new Date(fixedNow - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinsAgo)).toBe("5 mins ago");
    });

    it("formats hours correctly (singular vs plural)", () => {
      const oneHrAgo = new Date(fixedNow - 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(oneHrAgo)).toBe("1 hr ago");

      const threeHrsAgo = new Date(fixedNow - 3 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(threeHrsAgo)).toBe("3 hrs ago");
    });

    it("formats days correctly (singular vs plural)", () => {
      const oneDayAgo = new Date(fixedNow - 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(oneDayAgo)).toBe("1 day ago");

      const fourDaysAgo = new Date(fixedNow - 4 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fourDaysAgo)).toBe("4 days ago");
    });

    it("returns raw input string if string is invalid date", () => {
      expect(formatRelativeTime("not-a-valid-date")).toBe("not-a-valid-date");
    });
  });

  describe("formatKillSource", () => {
    it("maps KillSource values to human-readable strings", () => {
      expect(formatKillSource("ui")).toBe("UI");
      expect(formatKillSource("tray")).toBe("Tray");
      expect(formatKillSource("group")).toBe("Group");
      expect(formatKillSource("inspect")).toBe("Inspect");
    });
  });
});
