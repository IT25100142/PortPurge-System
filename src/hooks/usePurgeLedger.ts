import { useState, useEffect, useCallback } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LedgerEntry } from "../types";

const MAX_LEDGER_ENTRIES = 100;

export function usePurgeLedger() {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  const clearLedger = useCallback(() => {
    setLedgerEntries([]);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    invoke<LedgerEntry[]>("get_ledger_entries")
      .then((entries) => {
        setLedgerEntries(entries);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    let isUnmounted = false;

    const subscribe = async () => {
      try {
        const unlistenFn = await listen<LedgerEntry>("ledger-updated", (event) => {
          setLedgerEntries((prev) => [event.payload, ...prev].slice(0, MAX_LEDGER_ENTRIES));
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
    };
  }, []);

  return {
    ledgerOpen,
    setLedgerOpen,
    ledgerEntries,
    setLedgerEntries,
    clearLedger,
  };
}
