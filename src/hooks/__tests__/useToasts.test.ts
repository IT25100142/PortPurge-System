// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToasts } from "../useToasts";

describe("useToasts hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with an empty toasts array", () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current.toasts).toEqual([]);
  });

  it("adds a toast with a 7-character ID when showToast is called", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast("Test message", "success");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Test message");
    expect(result.current.toasts[0].type).toBe("success");
    expect(result.current.toasts[0].id).toHaveLength(7);
  });

  it("preserves optional permissionDenied metadata", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast("Access Denied", "error", { permissionDenied: true });
    });

    expect(result.current.toasts[0].permissionDenied).toBe(true);
  });

  it("auto-dismisses toast after 4000ms", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast("Auto dismiss toast", "warning");
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("clears pending timeout when manually removed", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast("Manual remove toast", "warning");
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);

    // Advancing timers should not throw or alter state
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("clears all timeouts on unmount", () => {
    const { result, unmount } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast("Toast 1", "success");
      result.current.showToast("Toast 2", "error");
    });

    expect(result.current.toasts).toHaveLength(2);

    unmount();

    // Advancing timers after unmount should not trigger state updates or errors
    act(() => {
      vi.advanceTimersByTime(4000);
    });
  });
});
