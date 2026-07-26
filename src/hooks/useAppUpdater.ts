import { useState, useEffect, useCallback, useRef } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Toast } from "../types";
import { UPDATER_ENABLED } from "./updaterContainment";

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

export function useAppUpdater(
  showToast: (
    message: string,
    type: Toast["type"],
    options?: { permissionDenied?: boolean },
  ) => void,
) {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    downloaded: 0,
    total: null,
  });

  const relaunchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissUpdateModal = useCallback(() => {
    setShowUpdateModal(false);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fail-closed: no check/download/install while rotation is incomplete.
    if (!UPDATER_ENABLED || !isTauri()) return;

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update && update.available) {
          setUpdateAvailable(update);
          setShowUpdateModal(true);
          showToast(`New update v${update.version} is available!`, "warning");
        }
      } catch (err) {
        if (!import.meta.env.DEV) {
          console.error("Failed to check for updates:", err);
        }
      }
    };

    const timer = setTimeout(() => {
      checkForUpdates();
    }, 1500);

    return () => clearTimeout(timer);
  }, [showToast]);

  const startUpdate = useCallback(async () => {
    if (!UPDATER_ENABLED || !updateAvailable) return;
    setIsDownloading(true);
    setDownloadProgress({ downloaded: 0, total: null });

    try {
      await updateAvailable.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setDownloadProgress({
              downloaded: 0,
              total: event.data.contentLength ?? null,
            });
            break;
          case "Progress":
            setDownloadProgress((prev) => ({
              downloaded: prev.downloaded + event.data.chunkLength,
              total: prev.total,
            }));
            break;
          case "Finished":
            break;
        }
      });

      showToast("Update installed successfully. Restarting...", "success");

      relaunchTimerRef.current = setTimeout(async () => {
        try {
          await relaunch();
        } catch (err) {
          showToast(`Failed to restart automatically: ${err}`, "error");
          setIsDownloading(false);
        }
      }, 1500);
    } catch (err) {
      showToast(`Update failed: ${err}`, "error");
      setIsDownloading(false);
    }
  }, [updateAvailable, showToast]);

  useEffect(() => {
    return () => {
      if (relaunchTimerRef.current) {
        clearTimeout(relaunchTimerRef.current);
      }
    };
  }, []);

  return {
    appVersion,
    updateAvailable,
    showUpdateModal,
    dismissUpdateModal,
    isDownloading,
    downloadProgress,
    startUpdate,
  };
}
