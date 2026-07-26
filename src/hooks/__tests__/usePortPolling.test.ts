// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePortPolling } from "../usePortPolling";

describe("usePortPolling hook", () => {
  const fetchPortsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not invoke fetchPorts immediately on mount", () => {
    renderHook(() => usePortPolling(fetchPortsMock, true, false));

    expect(fetchPortsMock).not.toHaveBeenCalled();
  });

  it("polls every 3000ms while autoRefresh is enabled and not paused", () => {
    renderHook(() => usePortPolling(fetchPortsMock, true, false));

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(fetchPortsMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
    expect(fetchPortsMock).toHaveBeenCalledWith();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(fetchPortsMock).toHaveBeenCalledTimes(2);
  });

  it("autoRefresh=false prevents interval-triggered fetches", () => {
    const { rerender } = renderHook(
      ({ autoRefresh }: { autoRefresh: boolean }) =>
        usePortPolling(fetchPortsMock, autoRefresh, false),
      { initialProps: { autoRefresh: true } },
    );

    rerender({ autoRefresh: false });
    fetchPortsMock.mockClear();

    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(fetchPortsMock).not.toHaveBeenCalled();
  });

  it("pollingPaused skips interval fetches and resume restores polling without leaking intervals", () => {
    const { rerender } = renderHook(
      ({ paused }: { paused: boolean }) => usePortPolling(fetchPortsMock, true, paused),
      { initialProps: { paused: true } },
    );

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(fetchPortsMock).not.toHaveBeenCalled();

    rerender({ paused: false });
    fetchPortsMock.mockClear();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);

    rerender({ paused: true });
    fetchPortsMock.mockClear();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(fetchPortsMock).not.toHaveBeenCalled();

    rerender({ paused: false });
    fetchPortsMock.mockClear();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(fetchPortsMock).toHaveBeenCalledTimes(1);
  });

  it("changing autoRefresh or pause does not trigger an immediate fetch", () => {
    const { rerender } = renderHook(
      ({
        autoRefresh,
        paused,
      }: {
        autoRefresh: boolean;
        paused: boolean;
      }) => usePortPolling(fetchPortsMock, autoRefresh, paused),
      { initialProps: { autoRefresh: true, paused: false } },
    );

    fetchPortsMock.mockClear();
    rerender({ autoRefresh: true, paused: true });
    expect(fetchPortsMock).not.toHaveBeenCalled();

    rerender({ autoRefresh: false, paused: true });
    expect(fetchPortsMock).not.toHaveBeenCalled();

    rerender({ autoRefresh: true, paused: false });
    expect(fetchPortsMock).not.toHaveBeenCalled();
  });

  it("clears the polling interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() => usePortPolling(fetchPortsMock, true, false));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
