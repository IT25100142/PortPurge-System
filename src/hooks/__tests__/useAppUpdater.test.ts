// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useAppUpdater } from "../useAppUpdater";

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

describe("useAppUpdater hook", () => {
  const showToastMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("fetches app version on mount in Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getVersion).mockResolvedValue("0.6.0");

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.appVersion).toBe("0.6.0");
    expect(getVersion).toHaveBeenCalled();
  });

  it("checks for updates after 1500ms delay and handles no available update", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getVersion).mockResolvedValue("0.6.0");
    vi.mocked(check).mockResolvedValue({ available: false, version: "0.6.0" } as unknown as Update);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    expect(check).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(check).toHaveBeenCalled();
    expect(result.current.updateAvailable).toBeNull();
    expect(result.current.showUpdateModal).toBe(false);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("shows modal and toast when an update is available", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getVersion).mockResolvedValue("0.6.0");
    const mockUpdate = {
      available: true,
      version: "0.7.0",
      downloadAndInstall: vi.fn(),
    };
    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.updateAvailable).toEqual(mockUpdate);
    expect(result.current.showUpdateModal).toBe(true);
    expect(showToastMock).toHaveBeenCalledWith("New update v0.7.0 is available!", "warning");
  });

  it("allows dismissing the update modal", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(check).mockResolvedValue({
      available: true,
      version: "0.7.0",
    } as unknown as Update);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.showUpdateModal).toBe(true);

    act(() => {
      result.current.dismissUpdateModal();
    });

    expect(result.current.showUpdateModal).toBe(false);
  });

  it("downloads, installs, and triggers relaunch on startUpdate", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const mockDownloadAndInstall = vi.fn().mockImplementation(async (onProgress) => {
      onProgress({ event: "Started", data: { contentLength: 1000 } });
      onProgress({ event: "Progress", data: { chunkLength: 500 } });
      onProgress({ event: "Finished", data: {} });
    });

    const mockUpdate = {
      available: true,
      version: "0.7.0",
      downloadAndInstall: mockDownloadAndInstall,
    };
    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(mockDownloadAndInstall).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(
      "Update installed successfully. Restarting...",
      "success",
    );

    // Fast-forward 1500ms relaunch delay
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(relaunch).toHaveBeenCalled();
  });

  it("handles update installation failure gracefully", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const mockDownloadAndInstall = vi
      .fn()
      .mockRejectedValue(new Error("Network connection lost"));

    const mockUpdate = {
      available: true,
      version: "0.7.0",
      downloadAndInstall: mockDownloadAndInstall,
    };
    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(result.current.isDownloading).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith(
      "Update failed: Error: Network connection lost",
      "error",
    );
  });

  it("handles relaunch failure gracefully", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const mockDownloadAndInstall = vi.fn().mockResolvedValue(undefined);
    vi.mocked(relaunch).mockRejectedValue(new Error("Relaunch permission denied"));

    const mockUpdate = {
      available: true,
      version: "0.7.0",
      downloadAndInstall: mockDownloadAndInstall,
    };
    vi.mocked(check).mockResolvedValue(mockUpdate as unknown as Update);

    const { result } = renderHook(() => useAppUpdater(showToastMock));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.startUpdate();
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(showToastMock).toHaveBeenCalledWith(
      "Failed to restart automatically: Error: Relaunch permission denied",
      "error",
    );
    expect(result.current.isDownloading).toBe(false);
  });

  it("clears startup update-check timer on unmount", () => {
    vi.mocked(isTauri).mockReturnValue(true);

    const { unmount } = renderHook(() => useAppUpdater(showToastMock));

    unmount();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(check).not.toHaveBeenCalled();
  });
});
