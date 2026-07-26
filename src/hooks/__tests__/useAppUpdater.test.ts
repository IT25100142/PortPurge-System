// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useAppUpdater } from "../useAppUpdater";
import { UPDATER_ENABLED } from "../updaterContainment";

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

describe("useAppUpdater hook (Phase 1 containment)", () => {
  const showToastMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps UPDATER_ENABLED false until restoration", () => {
    expect(UPDATER_ENABLED).toBe(false);
  });

  it("does not fetch version or check for updates when not in Tauri", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    expect(result.current.appVersion).toBeNull();
    expect(result.current.updateAvailable).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(getVersion).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });

  it("fetches app version in Tauri but never checks, downloads, or relaunches", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getVersion).mockResolvedValue("0.6.0");

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.appVersion).toBe("0.6.0");
    expect(getVersion).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(check).not.toHaveBeenCalled();
    expect(result.current.updateAvailable).toBeNull();
    expect(result.current.showUpdateModal).toBe(false);
    expect(showToastMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(relaunch).not.toHaveBeenCalled();
    expect(result.current.isDownloading).toBe(false);
  });

  it("clears timers on unmount without invoking check", () => {
    vi.mocked(isTauri).mockReturnValue(true);

    const { unmount } = renderHook(() => useAppUpdater(showToastMock));

    unmount();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(check).not.toHaveBeenCalled();
  });
});
