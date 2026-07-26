import { useState, useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

export function useSmartProtect() {
  const [protectedProcessNames, setProtectedProcessNames] = useState<string[]>([]);

  useEffect(() => {
    if (!isTauri()) return;

    invoke<string[]>("get_protected_process_names")
      .then((names) => {
        setProtectedProcessNames(names);
      })
      .catch(() => {});
  }, []);

  return { protectedProcessNames };
}
