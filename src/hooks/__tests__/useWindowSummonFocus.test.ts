// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useWindowSummonFocus } from "../useWindowSummonFocus";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("useWindowSummonFocus hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a mutable HTMLInputElement ref compatible with SearchFilters", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useWindowSummonFocus());

    expect(result.current).toEqual({ current: null });
    const input = document.createElement("input");
    result.current.current = input;
    expect(result.current.current).toBe(input);
  });

  it("does not register a listener outside Tauri", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    renderHook(() => useWindowSummonFocus());

    expect(listen).not.toHaveBeenCalled();
  });

  it("registers listen with exactly window-summoned", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(listen).mockResolvedValue(vi.fn());

    renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith("window-summoned", expect.any(Function));
    });
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it("focuses then selects the current input when the event fires", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let eventHandler: (() => void) | undefined;
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as () => void;
      return () => {};
    });

    const { result } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(eventHandler).toBeDefined();
    });

    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");
    result.current.current = input;

    act(() => {
      eventHandler!();
    });

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy.mock.invocationCallOrder[0]).toBeLessThan(
      selectSpy.mock.invocationCallOrder[0],
    );
  });

  it("does nothing safely when the ref current is null", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let eventHandler: (() => void) | undefined;
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as () => void;
      return () => {};
    });

    const { result } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(eventHandler).toBeDefined();
    });
    expect(result.current.current).toBeNull();

    expect(() => {
      act(() => {
        eventHandler!();
      });
    }).not.toThrow();
    expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
  });

  it("calls the resolved unlisten exactly once on unmount", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const unlistenFn = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlistenFn);

    const { unmount } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(listen).toHaveBeenCalled();
    });

    unmount();

    expect(unlistenFn).toHaveBeenCalledTimes(1);
  });

  it("immediately unlistens when listen resolves after unmount", async () => {
    vi.mocked(isTauri).mockReturnValue(true);

    let resolveListen!: (fn: () => void) => void;
    const listenPromise = new Promise<() => void>((resolve) => {
      resolveListen = resolve;
    });
    vi.mocked(listen).mockReturnValue(listenPromise);

    const unlistenFn = vi.fn();
    const { unmount } = renderHook(() => useWindowSummonFocus());

    unmount();

    await act(async () => {
      resolveListen(unlistenFn);
      await listenPromise;
    });

    expect(unlistenFn).toHaveBeenCalledTimes(1);
  });

  it("cleans each resolved registration exactly once across remount cycles", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const unlistenFirst = vi.fn();
    const unlistenSecond = vi.fn();
    vi.mocked(listen)
      .mockResolvedValueOnce(unlistenFirst)
      .mockResolvedValueOnce(unlistenSecond);

    const { unmount } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(listen).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(unlistenFirst).toHaveBeenCalledTimes(1);

    const remounted = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(listen).toHaveBeenCalledTimes(2);
    });

    remounted.unmount();
    expect(unlistenSecond).toHaveBeenCalledTimes(1);
    expect(unlistenFirst).toHaveBeenCalledTimes(1);
  });

  it("does not register additional listeners on rerender", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(listen).mockResolvedValue(vi.fn());

    const { rerender } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(listen).toHaveBeenCalledTimes(1);
    });

    rerender();
    rerender();

    expect(listen).toHaveBeenCalledTimes(1);
  });
});
