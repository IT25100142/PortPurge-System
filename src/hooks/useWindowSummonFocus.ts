import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function useWindowSummonFocus(): RefObject<HTMLInputElement | null> {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    let isUnmounted = false;
    const pendingFrameIds = new Set<number>();

    const subscribe = async () => {
      try {
        const unlistenFn = await listen("window-summoned", () => {
          const frameId = requestAnimationFrame(() => {
            pendingFrameIds.delete(frameId);
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          });
          pendingFrameIds.add(frameId);
        });

        if (isUnmounted) {
          unlistenFn();
        } else {
          unlisten = unlistenFn;
        }
      } catch {
        // Safe catch if listener registration fails
      }
    };

    subscribe();

    return () => {
      isUnmounted = true;
      unlisten?.();
      for (const frameId of pendingFrameIds) {
        cancelAnimationFrame(frameId);
      }
      pendingFrameIds.clear();
    };
  }, []);

  return searchInputRef;
}
