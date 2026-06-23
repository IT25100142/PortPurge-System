export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  processName: string;
}

/** Normalized key for expand/collapse persistence (lowercase trimmed processName). */
export type PortGroupKey = string;

export interface PortGroup {
  groupKey: PortGroupKey;
  processName: string;
  ports: PortInfo[];
  portCount: number;
  pidCount: number;
  uniquePids: number[];
}

export type TableViewMode = "flat" | "grouped";

export type SortLevel = "group" | "child";

export interface TableSortConfig {
  level: SortLevel;
  key: keyof PortInfo;
  direction: "asc" | "desc";
}

export interface ProcessDetails {
  pid: number;
  processName: string;
  executablePath: string | null;
  commandLine: string | null;
  memoryBytes: number | null;
  user: string | null;
  startedAt: string | null;
  permissionsLimited: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
  permissionDenied?: boolean;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}
