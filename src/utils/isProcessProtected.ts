/** Mirrors `config::normalize_process_name` in the Rust backend. */
export function normalizeProcessName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  return trimmed.endsWith(".exe") ? trimmed.slice(0, -4) : trimmed;
}

export const SMART_PROTECT_KILL_TITLE =
  "Protected by Smart Protect — edit config.json in the app data directory to change";

export function isProcessProtected(processName: string, denylist: string[]): boolean {
  const normalized = normalizeProcessName(processName);
  if (!normalized || normalized === "unknown") {
    return false;
  }

  return denylist.some((entry) => normalizeProcessName(entry) === normalized);
}
