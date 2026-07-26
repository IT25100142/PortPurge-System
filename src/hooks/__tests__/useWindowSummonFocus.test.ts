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

type FrameCallback = FrameRequestCallback;

/** Queues RAF callbacks until the test flushes them — does not run synchronously. */
function createDeferredFrameHarness() {
  let nextId = 1;
  const pending = new Map<number, FrameCallback>();
  const cancelAnimationFrame = vi.fn((id: number) => {
    pending.delete(id);
  });
  const requestAnimationFrame = vi.fn((cb: FrameCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });

  return {
    requestAnimationFrame,
    cancelAnimationFrame,
    pendingIds: () => [...pending.keys()],
    pendingCount: () => pending.size,
    flushOne: (id: number) => {
      const cb = pending.get(id);
      if (!cb) return false;
      pending.delete(id);
      cb(0);
      return true;
    },
    flushAll: () => {
      const ids = [...pending.keys()];
      for (const id of ids) {
        const cb = pending.get(id);
        if (!cb) continue;
        pending.delete(id);
        cb(0);
      }
      return ids;
    },
    tryFlushAll: () => {
      const ids = [...pending.keys()];
      for (const id of ids) {
        const cb = pending.get(id);
        if (!cb) continue;
        pending.delete(id);
        cb(0);
      }
      return ids.length;
    },
  };
}

describe("useWindowSummonFocus hook", () => {
  let frames: ReturnType<typeof createDeferredFrameHarness>;

  beforeEach(() => {
    vi.clearAllMocks();
    frames = createDeferredFrameHarness();
    vi.stubGlobal("requestAnimationFrame", frames.requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", frames.cancelAnimationFrame);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("defers focus and select until the queued animation frame runs", async () => {
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

    expect(frames.pendingCount()).toBe(1);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();

    const [frameId] = frames.pendingIds();
    act(() => {
      frames.flushOne(frameId);
    });

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy.mock.invocationCallOrder[0]).toBeLessThan(
      selectSpy.mock.invocationCallOrder[0],
    );
    expect(frames.pendingCount()).toBe(0);
  });

  it("does nothing safely when the ref current is null after the frame runs", async () => {
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

    act(() => {
      eventHandler!();
    });
    expect(frames.pendingCount()).toBe(1);

    expect(() => {
      act(() => {
        frames.flushAll();
      });
    }).not.toThrow();
  });

  it("cancels a pending frame on unmount and never focuses afterward", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let eventHandler: (() => void) | undefined;
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as () => void;
      return () => {};
    });

    const { result, unmount } = renderHook(() => useWindowSummonFocus());

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
    expect(frames.pendingCount()).toBe(1);
    const [pendingId] = frames.pendingIds();

    unmount();

    expect(frames.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.cancelAnimationFrame).toHaveBeenCalledWith(pendingId);
    expect(frames.pendingCount()).toBe(0);

    act(() => {
      frames.tryFlushAll();
    });
    expect(focusSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("does not cancel an already executed frame on unmount", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let eventHandler: (() => void) | undefined;
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as () => void;
      return () => {};
    });

    const { result, unmount } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(eventHandler).toBeDefined();
    });

    const input = document.createElement("input");
    result.current.current = input;

    act(() => {
      eventHandler!();
    });
    const [frameId] = frames.pendingIds();
    act(() => {
      frames.flushOne(frameId);
    });
    expect(frames.pendingCount()).toBe(0);

    unmount();

    expect(frames.cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it("schedules one distinct frame per rapid event and runs focus-then-select pairs", async () => {
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
      eventHandler!();
      eventHandler!();
    });

    expect(frames.requestAnimationFrame).toHaveBeenCalledTimes(3);
    expect(frames.pendingCount()).toBe(3);
    const pendingIds = frames.pendingIds();
    expect(new Set(pendingIds).size).toBe(3);

    act(() => {
      frames.flushAll();
    });

    expect(focusSpy).toHaveBeenCalledTimes(3);
    expect(selectSpy).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) {
      expect(focusSpy.mock.invocationCallOrder[i]).toBeLessThan(
        selectSpy.mock.invocationCallOrder[i],
      );
    }
  });

  it("cancels only remaining pending frames after a partial rapid-event flush", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    let eventHandler: (() => void) | undefined;
    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      eventHandler = handler as () => void;
      return () => {};
    });

    const { result, unmount } = renderHook(() => useWindowSummonFocus());

    await waitFor(() => {
      expect(eventHandler).toBeDefined();
    });

    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");
    result.current.current = input;

    act(() => {
      eventHandler!();
      eventHandler!();
      eventHandler!();
    });
    const [firstId, secondId, thirdId] = frames.pendingIds();

    act(() => {
      frames.flushOne(firstId);
    });
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);

    unmount();

    expect(frames.cancelAnimationFrame).toHaveBeenCalledTimes(2);
    expect(frames.cancelAnimationFrame).toHaveBeenCalledWith(secondId);
    expect(frames.cancelAnimationFrame).toHaveBeenCalledWith(thirdId);
    expect(frames.cancelAnimationFrame).not.toHaveBeenCalledWith(firstId);

    act(() => {
      frames.tryFlushAll();
    });
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);
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
    expect(frames.cancelAnimationFrame).not.toHaveBeenCalled();
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

  it("swallows listen rejection without unhandled rejection or pending frames", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(listen).mockRejectedValue(new Error("listen failed"));

    const onUnhandled = vi.fn();
    window.addEventListener("unhandledrejection", onUnhandled);

    const { unmount } = renderHook(() => useWindowSummonFocus());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    window.removeEventListener("unhandledrejection", onUnhandled);

    expect(onUnhandled).not.toHaveBeenCalled();
    expect(frames.pendingCount()).toBe(0);
    expect(frames.requestAnimationFrame).not.toHaveBeenCalled();

    unmount();
    expect(frames.cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
