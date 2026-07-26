// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePurgeLedger } from "../usePurgeLedger";
import type { LedgerEntry } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

const mockEntry1: LedgerEntry = {
  id: "1",
  timestamp: "2026-07-26T10:00:00Z",
  pid: 1234,
  port: 3000,
  protocol: "TCP",
  processName: "node.exe",
  success: true,
  errorMessage: null,
  source: "ui",
};

const mockEntry2: LedgerEntry = {
  id: "2",
  timestamp: "2026-07-26T10:05:00Z",
  pid: 5678,
  port: 5173,
  protocol: "TCP",
  processName: "vite",
  success: false,
  errorMessage: "Access Denied",
  source: "tray",
};

describe("usePurgeLedger hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with default empty state when not in Tauri environment", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => usePurgeLedger());

    expect(result.current.ledgerOpen).toBe(false);
    expect(result.current.ledgerEntries).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it("fetches ledger entries and subscribes to ledger-updated when in Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue([mockEntry1]);
    const unlistenFn = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlistenFn);

    const { result } = renderHook(() => usePurgeLedger());

    await waitFor(() => {
      expect(result.current.ledgerEntries).toEqual([mockEntry1]);
    });

    expect(invoke).toHaveBeenCalledWith("get_ledger_entries");
    expect(listen).toHaveBeenCalledWith("ledger-updated", expect.any(Function));
  });

  it("prepends new entries on ledger-updated event and caps history at 100", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let eventHandler: ((event: { payload: LedgerEntry }) => void) | undefined;

    vi.mocked(invoke).mockResolvedValue([mockEntry1]);
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as (event: { payload: LedgerEntry }) => void;
      return () => {};
    });

    const { result } = renderHook(() => usePurgeLedger());

    await waitFor(() => {
      expect(result.current.ledgerEntries).toEqual([mockEntry1]);
    });

    expect(eventHandler).toBeDefined();

    act(() => {
      eventHandler!({ payload: mockEntry2 });
    });

    expect(result.current.ledgerEntries).toEqual([mockEntry2, mockEntry1]);
  });

  it("clears local ledger entries when clearLedger is called", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue([mockEntry1]);
    vi.mocked(listen).mockResolvedValue(vi.fn());

    const { result } = renderHook(() => usePurgeLedger());

    await waitFor(() => {
      expect(result.current.ledgerEntries).toEqual([mockEntry1]);
    });

    act(() => {
      result.current.clearLedger();
    });

    expect(result.current.ledgerEntries).toEqual([]);
  });

  it("handles rejected IPC fetch without crashing", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockRejectedValue(new Error("IPC Error"));
    vi.mocked(listen).mockResolvedValue(vi.fn());

    const { result } = renderHook(() => usePurgeLedger());

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_ledger_entries");
    });

    expect(result.current.ledgerEntries).toEqual([]);
  });

  it("invokes unlisten on unmount if listener resolved", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue([]);
    const unlistenFn = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlistenFn);

    const { unmount } = renderHook(() => usePurgeLedger());

    await waitFor(() => {
      expect(listen).toHaveBeenCalled();
    });

    unmount();

    expect(unlistenFn).toHaveBeenCalled();
  });

  it("immediately calls unlisten if unmount occurs before listen promise resolves", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue([]);

    let resolveListen: (fn: () => void) => void;
    const listenPromise = new Promise<() => void>((resolve) => {
      resolveListen = resolve;
    });
    vi.mocked(listen).mockReturnValue(listenPromise);

    const unlistenFn = vi.fn();
    const { unmount } = renderHook(() => usePurgeLedger());

    // Unmount before listen resolves
    unmount();

    // Now resolve listen promise
    await act(async () => {
      resolveListen(unlistenFn);
      await listenPromise;
    });

    expect(unlistenFn).toHaveBeenCalled();
  });
});
