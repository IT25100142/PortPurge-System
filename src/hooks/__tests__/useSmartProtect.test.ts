// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useSmartProtect } from "../useSmartProtect";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

describe("useSmartProtect hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with empty array when not in Tauri", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useSmartProtect());

    expect(result.current.protectedProcessNames).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fetches protected process names on mount in Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const mockNames = ["svchost.exe", "explorer.exe", "launchd"];
    vi.mocked(invoke).mockResolvedValue(mockNames);

    const { result } = renderHook(() => useSmartProtect());

    await waitFor(() => {
      expect(result.current.protectedProcessNames).toEqual(mockNames);
    });

    expect(invoke).toHaveBeenCalledWith("get_protected_process_names");
  });

  it("handles IPC rejection gracefully without throwing", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockRejectedValue(new Error("IPC failure"));

    const { result } = renderHook(() => useSmartProtect());

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_protected_process_names");
    });

    expect(result.current.protectedProcessNames).toEqual([]);
  });
});
